import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWarehouseDeliveryCommands } from "./useWarehouseDeliveryCommands";

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
vi.mock("../api/warehouseDelivery", () => ({
  replaceWarehouseDeliveryInstruction: vi.fn(),
}));

const instruction = {
  instructionId: "22222222-2222-4222-8222-222222222222",
  containerRecordId: "33333333-3333-4333-8333-333333333333",
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
      const commands = useWarehouseDeliveryCommands(reload);

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
});
