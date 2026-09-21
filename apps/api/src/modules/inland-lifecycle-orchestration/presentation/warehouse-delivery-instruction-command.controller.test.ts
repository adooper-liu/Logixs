import { describe, expect, it, vi } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import { WarehouseDeliveryInstructionCommandController } from "./warehouse-delivery-instruction-command.controller";

const body = {
  expectedVersion: 0,
  warehouseLocationId: "33333333-3333-4333-8333-333333333333",
  warehouseCode: "VLS",
  warehouseName: "Barcelona VLS",
  unlocode: "ESBCN",
  timezone: "Europe/Madrid",
  appointmentStartAt: "2026-04-23T06:00:00.000Z",
  appointmentEndAt: "2026-04-23T08:00:00.000Z",
  appointmentReference: "APT-260423-01",
  evidenceRefs: ["44444444-4444-4444-8444-444444444444"],
  reasonCode: "delivery_instruction_confirmed",
  idempotencyKey: "delivery-instruction-1",
};

describe("WarehouseDeliveryInstructionCommandController", () => {
  it("injects the manual channel, source and authenticated actor", async () => {
    const replace = {
      execute: vi.fn().mockResolvedValue({ instructionId: "instruction-1" }),
    };
    const controller = new WarehouseDeliveryInstructionCommandController(
      replace as never,
    );

    await controller.replace("container-1", body, {
      identity: { tenantId: "tenant-a", actorId: "operator-a" },
    });

    expect(replace.execute).toHaveBeenCalledWith({
      ...body,
      tenantId: "tenant-a",
      containerRecordId: "container-1",
      ingestionChannel: "manual_ui",
      sourceSystem: "logix.web",
      actorId: "operator-a",
    });
  });

  it("declares the server-side operate capability", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        WarehouseDeliveryInstructionCommandController.prototype.replace,
      ),
    ).toEqual(["container.operate"]);
  });
});
