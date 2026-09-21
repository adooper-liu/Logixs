import { describe, expect, it } from "vitest";
import {
  WarehouseDeliveryInstructionValidationError,
  normalizeWarehouseDeliveryInstructionCommand,
} from "./warehouse-delivery-instruction";

const EVIDENCE_ID = "11111111-1111-4111-8111-111111111111";
const LOCATION_ID = "22222222-2222-4222-8222-222222222222";

function command() {
  return {
    tenantId: "dev-tenant",
    containerRecordId: "33333333-3333-4333-8333-333333333333",
    expectedVersion: 0,
    warehouseLocationId: LOCATION_ID,
    warehouseCode: "VLS",
    warehouseName: "Barcelona VLS",
    unlocode: "esbcn",
    timezone: "Europe/Madrid",
    appointmentStartAt: "2026-04-23T06:00:00.000Z",
    appointmentEndAt: "2026-04-23T08:00:00.000Z",
    appointmentReference: "APT-260423-01",
    ingestionChannel: "manual_ui" as const,
    sourceSystem: "logix.web",
    evidenceRefs: [EVIDENCE_ID],
    actorId: "dev-operator",
    reasonCode: "delivery_instruction_confirmed",
    idempotencyKey: "delivery-instruction-1",
  };
}

describe("normalizeWarehouseDeliveryInstructionCommand", () => {
  it("normalizes warehouse identity and produces a stable payload hash", () => {
    const first = normalizeWarehouseDeliveryInstructionCommand(command());
    const second = normalizeWarehouseDeliveryInstructionCommand(command());

    expect(first.warehouseLocationId).toBe(LOCATION_ID);
    expect(first.unlocode).toBe("ESBCN");
    expect(first.appointmentStartAt?.toISOString()).toBe(
      "2026-04-23T06:00:00.000Z",
    );
    expect(first.payloadHash).toMatch(/^[0-9a-f]{64}$/);
    expect(second.payloadHash).toBe(first.payloadHash);
  });

  it.each([
    ["warehouseLocationId", { warehouseLocationId: "warehouse-1" }],
    ["timezone", { timezone: "UTC+8" }],
    [
      "appointmentWindow",
      {
        appointmentStartAt: "2026-04-23T08:00:00.000Z",
        appointmentEndAt: "2026-04-23T06:00:00.000Z",
      },
    ],
    ["evidenceRefs", { evidenceRefs: [] }],
    ["sourceSystem", { sourceSystem: "logix\u0001web" }],
  ])("rejects invalid %s", (_field, override) => {
    expect(() =>
      normalizeWarehouseDeliveryInstructionCommand({
        ...command(),
        ...override,
      }),
    ).toThrow(WarehouseDeliveryInstructionValidationError);
  });
});
