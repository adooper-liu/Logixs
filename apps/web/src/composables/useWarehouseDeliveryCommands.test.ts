import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWarehouseDeliveryCommands } from "./useWarehouseDeliveryCommands";
import { effectScope, shallowRef } from "vue";

const registerEvidence = vi.fn();
const recordDateFact = vi.fn();
const replaceInstruction = vi.fn();

vi.mock("../api/evidence", () => ({
  isEvidenceUuid: () => false,
  registerAndVerifyFloorEvidence: (...args: unknown[]) =>
    registerEvidence(...args),
}));
vi.mock("../api/lifecycleDateFacts", () => ({
  recordLifecycleDateFact: (...args: unknown[]) => recordDateFact(...args),
}));
vi.mock("../api/warehouseDelivery", () => ({
  replaceWarehouseDeliveryInstruction: (...args: unknown[]) =>
    replaceInstruction(...args),
}));

const instruction = {
  instructionId: "22222222-2222-4222-8222-222222222222",
  containerRecordId: "container-1",
  version: 1,
  warehouseLocationId: "44444444-4444-4444-8444-444444444444",
  warehouseCode: "VLS",
  warehouseName: "Barcelona VLS",
  unlocode: "ESBCN",
  timezone: "Europe/Madrid",
  appointmentStartAt: null,
  appointmentEndAt: null,
  appointmentReference: null,
  evidenceRefs: ["55555555-5555-4555-8555-555555555555"],
  actorId: "operator-a",
  reasonCode: "delivery_instruction_confirmed",
  createdAt: "2026-09-21T00:00:00.000Z",
  duplicate: false,
};

describe("useWarehouseDeliveryCommands", () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    registerEvidence.mockReset().mockResolvedValue("evidence-1");
    replaceInstruction.mockReset().mockResolvedValue(instruction);
    recordDateFact.mockReset().mockResolvedValue({
      factId: "fact-1",
      recordState: "recorded",
      applicationState: "review_required",
      reasonCode: "SOURCE_AUTHORITY_REVIEW_REQUIRED",
      canonicalEventId: null,
      projectionVersion: 4,
    });
    vi.stubGlobal("crypto", { randomUUID: () => "idempotency-1" });
  });

  it.each([
    ["delivered", "POD-1", "receipt", "organization", "warehouse-receiving"],
    ["warehouse_arrival", "WMS-1", "system_record", "system", "warehouse-wms"],
  ] as const)(
    "records qualified %s evidence and submits an actual delivery fact",
    async (kind, evidenceInput, evidenceType, sourceType, authoritySystem) => {
      const reload = vi.fn().mockResolvedValue(undefined);
      const commands = useWarehouseDeliveryCommands(
        reload,
        shallowRef("container-1"),
      );

      await commands.submitFact("container-1", 3, instruction, {
        kind,
        localDateTime: "2026-09-21T10:30",
        evidenceInputs: [evidenceInput],
      });

      expect(registerEvidence).toHaveBeenCalledWith(
        "container-1",
        evidenceInput,
        expect.objectContaining({
          evidenceType,
          sourceType,
          authoritySystem,
        }),
      );
      expect(recordDateFact).toHaveBeenCalledWith(
        "container-1",
        expect.objectContaining({
          nodeCode: "warehouse_delivery",
          eventCode: kind,
          timeKind: "actual",
          occurredAt: "2026-09-21T08:30:00.000Z",
          sourceUtcOffset: "+02:00",
          authoritySystem,
          location: {
            locationType: "warehouse",
            locationId: instruction.warehouseLocationId,
            unlocode: instruction.unlocode,
            timezone: instruction.timezone,
          },
          evidenceRefs: ["evidence-1"],
          expectedVersion: 3,
          idempotencyKey: "idempotency-1",
        }),
      );
      expect(commands.factResults.value[kind]?.factId).toBe("fact-1");
      expect(reload).toHaveBeenCalledOnce();
    },
  );

  it("snapshots awaited instruction input and excludes concurrent fact writes", async () => {
    let release!: (value: string) => void;
    registerEvidence.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );
    const commands = useWarehouseDeliveryCommands(
      vi.fn(),
      shallowRef("container-1"),
    );
    const draft = instructionDraft();
    const saving = commands.saveInstruction("container-1", 1, draft);
    draft.warehouseName = "MUTATED";
    draft.timezone = "UTC";
    draft.evidenceInputs.push("MUTATED");
    await commands.submitFact("container-1", 3, instruction, factDraft());
    expect(recordDateFact).not.toHaveBeenCalled();
    release("evidence-original");
    await saving;
    expect(replaceInstruction).toHaveBeenCalledWith(
      "container-1",
      expect.objectContaining({
        warehouseName: "Original",
        timezone: "Europe/Madrid",
        evidenceRefs: ["evidence-original"],
      }),
    );
  });

  it.each(["success", "failure"])(
    "does not publish stale %s/finally/reload across A-B-A",
    async (outcome) => {
      let resolve!: (value: unknown) => void;
      let reject!: (error: Error) => void;
      recordDateFact.mockImplementationOnce(
        () =>
          new Promise((yes, no) => {
            resolve = yes;
            reject = no;
          }),
      );
      const current = shallowRef("container-1");
      const reload = vi.fn().mockResolvedValue(undefined);
      const commands = useWarehouseDeliveryCommands(reload, current);
      const pending = commands.submitFact(
        "container-1",
        3,
        instruction,
        factDraft(),
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      current.value = "container-b";
      current.value = "container-1";
      let releaseNew!: (value: unknown) => void;
      recordDateFact.mockImplementationOnce(
        () =>
          new Promise((yes) => {
            releaseNew = yes;
          }),
      );
      const newer = commands.submitFact(
        "container-1",
        3,
        instruction,
        factDraft(),
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      if (outcome === "success")
        resolve({ factId: "old", applicationState: "review_required" });
      else reject(new Error("OLD ERROR"));
      await pending;
      expect(commands.factSubmitting.value).toBe("delivered");
      expect(commands.error.value).toBe("");
      expect(commands.factResults.value).toEqual({});
      expect(reload).not.toHaveBeenCalled();
      releaseNew({ factId: "new", applicationState: "review_required" });
      await newer;
      expect(commands.factResults.value.delivered?.factId).toBe("new");
    },
  );

  it("keeps failed keys and rotates only after owned success", async () => {
    let sequence = 0;
    vi.stubGlobal("crypto", { randomUUID: () => `key-${++sequence}` });
    const commands = useWarehouseDeliveryCommands(
      vi.fn(),
      shallowRef("container-1"),
    );
    recordDateFact.mockRejectedValueOnce(new Error("retry"));
    await commands.submitFact("container-1", 3, instruction, factDraft());
    await commands.submitFact("container-1", 3, instruction, factDraft());
    await commands.submitFact("container-1", 4, instruction, factDraft());
    expect(
      recordDateFact.mock.calls.map((call) => call[1].idempotencyKey),
    ).toEqual(["key-1", "key-1", "key-2"]);
  });
  it("binds fact kind, evidence and destination before evidence awaits", async () => {
    let release!: (value: string) => void;
    registerEvidence.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );
    const commands = useWarehouseDeliveryCommands(
      vi.fn(),
      shallowRef("container-1"),
    );
    const destination = { ...instruction };
    const draft = factDraft();
    const pending = commands.submitFact("container-1", 4, destination, draft);
    draft.evidenceInputs.push("WRONG");
    draft.localDateTime = "2026-09-22T11:00";
    destination.warehouseLocationId = "foreign";
    destination.timezone = "UTC";
    release("original-evidence");
    await pending;
    expect(recordDateFact).toHaveBeenCalledWith(
      "container-1",
      expect.objectContaining({
        rawValue: "2026-09-21T10:30",
        evidenceRefs: ["original-evidence"],
        location: expect.objectContaining({
          locationId: instruction.warehouseLocationId,
          timezone: instruction.timezone,
        }),
      }),
    );
  });
  it("does not publish instruction evidence/POST errors after a context change", async () => {
    let reject!: (error: Error) => void;
    registerEvidence.mockImplementationOnce(
      () =>
        new Promise((_resolve, no) => {
          reject = no;
        }),
    );
    const current = shallowRef("container-1");
    const reload = vi.fn();
    const commands = useWarehouseDeliveryCommands(reload, current);
    const old = commands.saveInstruction("container-1", 1, instructionDraft());
    current.value = "container-b";
    let release!: (value: unknown) => void;
    replaceInstruction.mockImplementationOnce(
      () =>
        new Promise((yes) => {
          release = yes;
        }),
    );
    const newer = commands.saveInstruction(
      "container-b",
      0,
      instructionDraft(),
    );
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    reject(new Error("OLD EVIDENCE ERROR"));
    await old;
    expect(commands.instructionSubmitting.value).toBe(true);
    expect(commands.error.value).toBe("");
    expect(reload).not.toHaveBeenCalled();
    release({ ...instruction, containerRecordId: "container-b" });
    await newer;
    expect(commands.instructionResult.value?.containerRecordId).toBe(
      "container-b",
    );
  });
  it("does not let an old reload finally release a new container command", async () => {
    let finishReload!: () => void;
    const reload = vi.fn().mockImplementationOnce(
      () =>
        new Promise<void>((yes) => {
          finishReload = yes;
        }),
    );
    const current = shallowRef("container-1");
    const commands = useWarehouseDeliveryCommands(reload, current);
    const old = commands.saveInstruction("container-1", 1, instructionDraft());
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    current.value = "container-b";
    let release!: (value: unknown) => void;
    recordDateFact.mockImplementationOnce(
      () =>
        new Promise((yes) => {
          release = yes;
        }),
    );
    const newer = commands.submitFact(
      "container-b",
      2,
      { ...instruction, containerRecordId: "container-b" },
      factDraft(),
    );
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    finishReload();
    await old;
    expect(commands.factSubmitting.value).toBe("delivered");
    expect(commands.instructionResult.value).toBeNull();
    release({ factId: "B" });
    await newer;
  });
  it("withdraws pending command ownership on disposal", async () => {
    let release!: (value: unknown) => void;
    recordDateFact.mockImplementationOnce(
      () =>
        new Promise((yes) => {
          release = yes;
        }),
    );
    const scope = effectScope();
    const reload = vi.fn();
    const commands = scope.run(() =>
      useWarehouseDeliveryCommands(reload, shallowRef("container-1")),
    )!;
    const pending = commands.submitFact(
      "container-1",
      3,
      instruction,
      factDraft(),
    );
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    scope.stop();
    release({ factId: "old" });
    await pending;
    expect(commands.factResults.value).toEqual({});
    expect(reload).not.toHaveBeenCalled();
  });
});

function instructionDraft() {
  return {
    warehouseLocationId: instruction.warehouseLocationId,
    warehouseCode: "VLS",
    warehouseName: "Original",
    unlocode: "ESBCN",
    timezone: "Europe/Madrid",
    appointmentStartLocal: "",
    appointmentEndLocal: "",
    appointmentReference: "",
    evidenceInputs: ["instruction-original"],
  };
}
function factDraft() {
  return {
    kind: "delivered" as const,
    localDateTime: "2026-09-21T10:30",
    evidenceInputs: ["POD-original"],
  };
}
