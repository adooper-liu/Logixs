import { describe, expect, it, vi } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import { ShipmentHandoffController } from "./shipment-handoff.controller";

describe("ShipmentHandoffController", () => {
  it("passes authenticated tenant and actor to both use cases", async () => {
    const preflight = {
      preflight: vi.fn().mockResolvedValue({ decision: "ready" }),
    };
    const accept = { accept: vi.fn().mockResolvedValue({ handoffId: "h1" }) };
    const listInternal = { execute: vi.fn() };
    const acceptInternal = { execute: vi.fn() };
    const acceptInternalBatch = { execute: vi.fn() };
    const completePendingFacts = { execute: vi.fn() };
    const completePendingCargo = { execute: vi.fn() };
    const bindPendingSku = { execute: vi.fn() };
    const completePendingDocuments = { execute: vi.fn() };
    const controller = new ShipmentHandoffController(
      preflight as never,
      accept as never,
      listInternal as never,
      acceptInternal as never,
      acceptInternalBatch as never,
      completePendingFacts as never,
      completePendingCargo as never,
      bindPendingSku as never,
      completePendingDocuments as never,
    );
    const identity = { tenantId: "tenant-a", actorId: "actor-a" };
    const body = { contractVersion: "shipment-handoff.v1" } as never;

    await controller.preflight(body, { identity });
    await controller.accept(body, { identity });

    expect(preflight.preflight).toHaveBeenCalledWith(body, identity);
    expect(accept.accept).toHaveBeenCalledWith(body, identity);

    await controller.acceptInternalCandidates(body, { identity });
    expect(acceptInternalBatch.execute).toHaveBeenCalledWith(body, identity);

    await controller.completeShipmentPendingFacts("shipment-1", body, {
      identity,
    });
    expect(completePendingFacts.execute).toHaveBeenCalledWith(
      "shipment-1",
      body,
      identity,
    );

    await controller.completeShipmentPendingCargo("shipment-1", body, {
      identity,
    });
    expect(completePendingCargo.execute).toHaveBeenCalledWith(
      "shipment-1",
      body,
      identity,
    );

    await controller.bindShipmentPendingSku("shipment-1", body, { identity });
    expect(bindPendingSku.execute).toHaveBeenCalledWith(
      "shipment-1",
      body,
      identity,
    );

    await controller.completeShipmentPendingDocuments("shipment-1", body, {
      identity,
    });
    expect(completePendingDocuments.execute).toHaveBeenCalledWith(
      "shipment-1",
      body,
      identity,
    );
  });

  it("declares separate preflight and commit capabilities", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        ShipmentHandoffController.prototype.preflight,
      ),
    ).toEqual(["import.operate"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        ShipmentHandoffController.prototype.accept,
      ),
    ).toEqual(["import.execute"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        ShipmentHandoffController.prototype.acceptInternalCandidates,
      ),
    ).toEqual(["import.execute"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        ShipmentHandoffController.prototype.completeShipmentPendingFacts,
      ),
    ).toEqual(["lifecycle.operate"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        ShipmentHandoffController.prototype.bindShipmentPendingSku,
      ),
    ).toEqual(["lifecycle.operate"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        ShipmentHandoffController.prototype.completeShipmentPendingDocuments,
      ),
    ).toEqual(["lifecycle.operate"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        ShipmentHandoffController.prototype.completeShipmentPendingCargo,
      ),
    ).toEqual(["lifecycle.operate"]);
  });
});
