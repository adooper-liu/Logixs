import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    vi.stubGlobal("crypto", { randomUUID: () => "idempotency-1" });
  });

  it("records terminal evidence and submits a versioned gate-out fact", async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    const commands = usePickupCommands(reload);

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
});
