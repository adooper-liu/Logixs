import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shallowRef } from "vue";
import { flushPromises } from "@vue/test-utils";
import { usePickupCommands } from "./usePickupCommands";

const registerEvidence = vi.fn();
const recordDateFact = vi.fn();

vi.mock("../api/evidence", () => ({
  isEvidenceUuid: () => false,
  registerAndVerifyFloorEvidence: (...args: unknown[]) =>
    registerEvidence(...args),
}));
vi.mock("../api/lifecycleDateFacts", () => ({
  recordLifecycleDateFact: (...args: unknown[]) => recordDateFact(...args),
}));

describe("usePickupCommands", () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    registerEvidence.mockReset().mockResolvedValue("evidence-1");
    recordDateFact.mockReset().mockResolvedValue({
      factId: "fact-2",
      recordState: "recorded",
      applicationState: "review_required",
      reasonCode: "SOURCE_AUTHORITY_REVIEW_REQUIRED",
      canonicalEventId: null,
      projectionVersion: 4,
    });
    let sequence = 0;
    vi.stubGlobal("crypto", { randomUUID: () => `idempotency-${++sequence}` });
  });

  it("records terminal evidence and submits a versioned gate-out fact", async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    const commands = usePickupCommands(reload, shallowRef("container-1"));

    await commands.submit("container-1", 3, {
      kind: "gate_out",
      localDateTime: "2026-09-21T10:30",
      evidenceInputs: ["EIR-1"],
      location: {
        locationType: "terminal",
        unlocode: "USLAX",
        timezone: "America/Los_Angeles",
      },
      supersedesFactId: "fact-1",
    });

    expect(registerEvidence).toHaveBeenCalledWith(
      "container-1",
      "EIR-1",
      expect.objectContaining({
        evidenceType: "receipt",
        authoritySystem: "terminal-operator",
      }),
    );
    expect(recordDateFact).toHaveBeenCalledWith(
      "container-1",
      expect.objectContaining({
        nodeCode: "container_pickup",
        eventCode: "gate_out",
        timeKind: "actual",
        occurredAt: "2026-09-21T17:30:00.000Z",
        sourceUtcOffset: "-07:00",
        evidenceRefs: ["evidence-1"],
        expectedVersion: 3,
        supersedesFactId: "fact-1",
        idempotencyKey: "idempotency-1",
      }),
    );
    expect(commands.results.value.gate_out?.factId).toBe("fact-2");
    expect(reload).toHaveBeenCalledOnce();
  });

  it.each(["evidence", "record"] as const)(
    "isolates late %s success from B and a new B request's finally",
    async (stage) => {
      const context = shallowRef("container-a");
      const reload = vi.fn().mockResolvedValue(undefined);
      const commands = usePickupCommands(reload, context);
      const old = deferred<unknown>();
      const next = deferred<unknown>();
      if (stage === "evidence")
        registerEvidence.mockImplementationOnce(() => old.promise);
      else recordDateFact.mockImplementationOnce(() => old.promise);
      const a = commands.submit(context.value, 3, draft);
      await flushPromises();
      context.value = "container-b";
      expect(commands.submitting.value).toBeNull();
      recordDateFact.mockImplementationOnce(() => next.promise);
      const b = commands.submit(context.value, 8, draft);
      await flushPromises();
      // Evidence success must continue against its original container/version.
      if (stage === "evidence") recordDateFact.mockResolvedValueOnce(receipt);
      old.resolve(stage === "evidence" ? "old-evidence" : receipt);
      await a;
      expect(commands.results.value).toEqual({});
      expect(commands.error.value).toBe("");
      expect(commands.submitting.value).toBe("gate_out");
      expect(reload).not.toHaveBeenCalled();
      next.resolve(receipt);
      await b;
      expect(recordDateFact).toHaveBeenCalledWith(
        "container-a",
        expect.objectContaining({ expectedVersion: 3, eventCode: "gate_out" }),
      );
      expect(recordDateFact).toHaveBeenCalledWith(
        "container-b",
        expect.objectContaining({ expectedVersion: 8, eventCode: "gate_out" }),
      );
      expect(commands.results.value.gate_out).toEqual(receipt);
      expect(commands.submitting.value).toBeNull();
      expect(reload).toHaveBeenCalledOnce();
    },
  );

  it.each(["evidence", "record", "reload"] as const)(
    "ignores late %s failure across A→B→A",
    async (stage) => {
      const context = shallowRef("container-a");
      const pending = deferred<unknown>();
      const reload = vi.fn().mockResolvedValue(undefined);
      if (stage === "evidence")
        registerEvidence.mockImplementationOnce(() => pending.promise);
      if (stage === "record")
        recordDateFact.mockImplementationOnce(() => pending.promise);
      if (stage === "reload")
        reload.mockImplementationOnce(() => pending.promise);
      const commands = usePickupCommands(reload, context);
      const old = commands.submit(context.value, 3, draft);
      await flushPromises();
      context.value = "container-b";
      context.value = "container-a";
      expect(commands.results.value).toEqual({});
      pending.reject(new Error("old A failure"));
      await old;
      expect(commands.error.value).toBe("");
      expect(commands.results.value).toEqual({});
      expect(commands.submitting.value).toBeNull();
      expect(reload).toHaveBeenCalledTimes(stage === "reload" ? 1 : 0);
    },
  );

  it("clears prior receipts/errors on switch and rejects mismatched submit identities", async () => {
    const context = shallowRef("container-a");
    const commands = usePickupCommands(vi.fn(), context);
    await commands.submit("container-a", 1, draft);
    recordDateFact.mockRejectedValueOnce(new Error("A failure"));
    await commands.submit("container-a", 1, draft);
    expect(commands.error.value).toBe("A failure");
    context.value = "container-b";
    expect(commands.results.value).toEqual({});
    expect(commands.error.value).toBe("");
    await commands.submit("container-a", 1, draft);
    expect(recordDateFact).toHaveBeenCalledTimes(2);
  });

  it("retains failed scope keys across switches and rotates keys only after success", async () => {
    const context = shallowRef("container-a");
    const commands = usePickupCommands(vi.fn(), context);
    recordDateFact.mockRejectedValueOnce(new Error("retry"));
    await commands.submit("container-a", 1, draft);
    context.value = "container-b";
    await commands.submit("container-b", 1, draft);
    context.value = "container-a";
    await commands.submit("container-a", 2, draft);
    await commands.submit("container-a", 3, draft);
    expect(
      recordDateFact.mock.calls.map(([, body]) => body.idempotencyKey),
    ).toEqual([
      "idempotency-1",
      "idempotency-2",
      "idempotency-1",
      "idempotency-3",
    ]);
  });

  it("does not let old success retire a newer same-scope attempt's retry key", async () => {
    const context = shallowRef("container-a");
    const commands = usePickupCommands(vi.fn(), context);
    const old = deferred<unknown>();
    const newer = deferred<unknown>();
    recordDateFact
      .mockImplementationOnce(() => old.promise)
      .mockImplementationOnce(() => newer.promise);
    const a = commands.submit("container-a", 1, draft);
    await flushPromises();
    context.value = "container-b";
    context.value = "container-a";
    const newA = commands.submit("container-a", 1, draft);
    await flushPromises();
    old.resolve(receipt);
    await a;
    expect(commands.submitting.value).toBe("gate_out");
    newer.reject(new Error("retry new A"));
    await newA;
    await commands.submit("container-a", 1, draft);
    expect(
      recordDateFact.mock.calls.map(([, body]) => body.idempotencyKey),
    ).toEqual(["idempotency-1", "idempotency-1", "idempotency-1"]);
  });

  it("snapshots submitted inputs across the evidence await and keeps keys separate by event", async () => {
    const context = shallowRef("container-a");
    const commands = usePickupCommands(vi.fn(), context);
    const evidence = deferred<string>();
    registerEvidence.mockImplementationOnce(() => evidence.promise);
    const input = {
      ...draft,
      evidenceInputs: ["original-evidence"],
      location: { ...draft.location },
    };
    const pending = commands.submit("container-a", 5, input);
    input.location.unlocode = "CNSHA";
    input.evidenceInputs.push("later-evidence");
    evidence.resolve("original-ref");
    await pending;
    expect(registerEvidence).toHaveBeenCalledTimes(1);
    expect(recordDateFact).toHaveBeenCalledWith(
      "container-a",
      expect.objectContaining({
        location: expect.objectContaining({ unlocode: "USLAX" }),
        evidenceRefs: ["original-ref"],
        expectedVersion: 5,
      }),
    );
    await commands.submit("container-a", 6, { ...draft, kind: "available" });
    expect(
      recordDateFact.mock.calls.map(([, body]) => [
        body.eventCode,
        body.idempotencyKey,
      ]),
    ).toEqual([
      ["gate_out", "idempotency-1"],
      ["available", "idempotency-2"],
    ]);
  });
});

const draft = {
  kind: "gate_out" as const,
  localDateTime: "2026-09-21T10:30",
  evidenceInputs: ["EIR-1"],
  location: {
    locationType: "terminal" as const,
    unlocode: "USLAX",
    timezone: "America/Los_Angeles",
  },
};
const receipt = {
  factId: "new-fact",
  recordState: "recorded",
  applicationState: "review_required",
  reasonCode: "SOURCE_AUTHORITY_REVIEW_REQUIRED",
  canonicalEventId: null,
  projectionVersion: 4,
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
