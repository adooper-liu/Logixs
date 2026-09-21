import type {
  ContainerUnloadingReport,
  WarehouseDeliveryInstruction,
} from "@logix/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useContainerUnloadingCommands } from "./useContainerUnloadingCommands";

const appendReport = vi.fn();
const registerEvidence = vi.fn();
const recordDateFact = vi.fn();

vi.mock("../api/containerUnloading", () => ({
  appendContainerUnloadingReport: (...args: unknown[]) => appendReport(...args),
}));
vi.mock("../api/evidence", () => ({
  isEvidenceUuid: () => false,
  registerAndVerifyFloorEvidence: (...args: unknown[]) =>
    registerEvidence(...args),
}));
vi.mock("../api/lifecycleDateFacts", () => ({
  recordLifecycleDateFact: (...args: unknown[]) => recordDateFact(...args),
}));

const instruction = {
  instructionId: "11111111-1111-4111-8111-111111111111",
  containerRecordId: "container-1",
  version: 1,
  warehouseLocationId: "22222222-2222-4222-8222-222222222222",
  warehouseCode: "VLS",
  warehouseName: "Barcelona VLS",
  unlocode: "ESBCN",
  timezone: "Europe/Madrid",
  appointmentStartAt: null,
  appointmentEndAt: null,
  appointmentReference: null,
  evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
  actorId: "operator-a",
  reasonCode: "delivery_instruction_confirmed",
  createdAt: "2026-09-21T00:00:00Z",
  duplicate: false,
} as WarehouseDeliveryInstruction;

describe("useContainerUnloadingCommands", () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => {
    appendReport.mockReset();
    registerEvidence.mockReset().mockResolvedValue("evidence-1");
    recordDateFact.mockReset().mockResolvedValue({
      factId: "fact-1",
      applicationState: "review_required",
    });
    let key = 0;
    vi.stubGlobal("crypto", { randomUUID: () => `idempotency-${++key}` });
  });

  it("saves partial progress without creating a lifecycle completion fact", async () => {
    appendReport.mockResolvedValue(report("partial", null));
    const reload = vi.fn().mockResolvedValue(undefined);
    const commands = useContainerUnloadingCommands(reload);
    await commands.submitReport(
      "container-1",
      1,
      3,
      instruction,
      draft("partial"),
    );
    expect(appendReport).toHaveBeenCalledWith(
      "container-1",
      expect.objectContaining({ operationState: "partial" }),
    );
    expect(recordDateFact).not.toHaveBeenCalled();
  });

  it("uses the completed report time and evidence for unloaded review", async () => {
    appendReport.mockResolvedValue(
      report("completed", "2026-04-23T08:30:00.000Z"),
    );
    const commands = useContainerUnloadingCommands(
      vi.fn().mockResolvedValue(undefined),
    );
    await commands.submitReport(
      "container-1",
      2,
      4,
      instruction,
      draft("completed"),
    );
    expect(registerEvidence).toHaveBeenCalledWith(
      "container-1",
      "WAREHOUSE-RECEIPT-1",
      expect.objectContaining({
        evidenceType: "receipt",
        sourceType: "organization",
        authoritySystem: "warehouse-receiving",
      }),
    );
    expect(recordDateFact).toHaveBeenCalledWith(
      "container-1",
      expect.objectContaining({
        nodeCode: "container_unloading",
        eventCode: "unloaded",
        timeKind: "actual",
        occurredAt: "2026-04-23T08:30:00.000Z",
        sourceUtcOffset: "+02:00",
        authoritySystem: "warehouse-receiving",
        evidenceRefs: ["evidence-1"],
        expectedVersion: 4,
      }),
    );
  });

  it("reuses both idempotency keys when date fact submission is retried", async () => {
    registerEvidence
      .mockResolvedValueOnce("evidence-1")
      .mockResolvedValueOnce("evidence-2");
    appendReport.mockResolvedValue(
      report("completed", "2026-04-23T08:30:00.000Z"),
    );
    recordDateFact
      .mockRejectedValueOnce(new Error("temporary date fact failure"))
      .mockResolvedValueOnce({
        factId: "fact-1",
        applicationState: "review_required",
      });
    const commands = useContainerUnloadingCommands(
      vi.fn().mockResolvedValue(undefined),
    );

    await commands.submitReport(
      "container-1",
      2,
      4,
      instruction,
      draft("completed"),
    );
    await commands.submitReport(
      "container-1",
      2,
      4,
      instruction,
      draft("completed"),
    );

    expect(appendReport).toHaveBeenCalledTimes(2);
    expect(appendReport.mock.calls[0]?.[1].idempotencyKey).toBe(
      appendReport.mock.calls[1]?.[1].idempotencyKey,
    );
    expect(recordDateFact).toHaveBeenCalledTimes(2);
    expect(recordDateFact.mock.calls[0]?.[1].idempotencyKey).toBe(
      recordDateFact.mock.calls[1]?.[1].idempotencyKey,
    );
    expect(registerEvidence).toHaveBeenCalledTimes(1);
    expect(appendReport.mock.calls[1]?.[1].evidenceRefs).toEqual([
      "evidence-1",
    ]);
  });
});

function draft(operationState: "partial" | "completed") {
  return {
    operationState,
    startedLocal: "2026-04-23T08:00",
    completedLocal: operationState === "completed" ? "2026-04-23T10:30" : "",
    expectedQuantity: "524",
    unloadedQuantity: operationState === "completed" ? "524" : "300",
    remainingQuantity: operationState === "completed" ? "0" : "224",
    damagedQuantity: "0",
    shortageQuantity: "0",
    quantityUnit: "carton" as const,
    sealCheck: "matched" as const,
    exceptionResolved: false,
    exceptionNotes: "",
    evidenceInputs: ["WAREHOUSE-RECEIPT-1"],
  };
}

function report(
  operationState: "partial" | "completed",
  completedAt: string | null,
): ContainerUnloadingReport {
  return {
    reportId: "44444444-4444-4444-8444-444444444444",
    containerRecordId: "container-1",
    version: operationState === "completed" ? 3 : 2,
    warehouseLocationId: instruction.warehouseLocationId,
    operationState,
    startedAt: "2026-04-23T06:00:00.000Z",
    completedAt,
    expectedQuantity: "524",
    unloadedQuantity: operationState === "completed" ? "524" : "300",
    remainingQuantity: operationState === "completed" ? "0" : "224",
    damagedQuantity: "0",
    shortageQuantity: "0",
    quantityUnit: "carton",
    sealCheck: "matched",
    exceptionResolved: false,
    exceptionNotes: null,
    evidenceRefs: ["evidence-1"],
    actorId: "operator-a",
    reasonCode: "unloading_progress_reported",
    createdAt: "2026-09-21T00:00:00Z",
    duplicate: false,
  };
}
