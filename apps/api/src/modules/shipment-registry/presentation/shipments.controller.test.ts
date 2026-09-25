import { describe, expect, it, vi } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import type { GetShipmentService } from "../application/get-shipment.service";
import type { ListShipmentsService } from "../application/list-shipments.service";
import type { ListShipmentPendingCompletionService } from "../application/list-shipment-pending-completion.service";
import { ShipmentsController } from "./shipments.controller";

describe("ShipmentsController", () => {
  it("requires transport and lifecycle read capabilities", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        ShipmentsController.prototype.list,
      ),
    ).toEqual(["container.read", "lifecycle.read"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        ShipmentsController.prototype.get,
      ),
    ).toEqual(["container.read", "lifecycle.read"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        ShipmentsController.prototype.listPending,
      ),
    ).toEqual(["container.read", "lifecycle.read"]);
  });

  it("passes tenant and paging filters to the Shipment list use case", async () => {
    const listShipments = { execute: vi.fn().mockResolvedValue({ items: [] }) };
    const controller = new ShipmentsController(
      listShipments as unknown as ListShipmentsService,
      {} as GetShipmentService,
      {} as ListShipmentPendingCompletionService,
    );

    await controller.list(
      { identity: { tenantId: "tenant-1" } },
      "20",
      "cursor-1",
      "departed",
    );

    expect(listShipments.execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      pageSize: "20",
      cursor: "cursor-1",
      status: "departed",
    });
  });

  it("passes only the authenticated tenant to the detail use case", async () => {
    const getShipment = { execute: vi.fn().mockResolvedValue({}) };
    const controller = new ShipmentsController(
      {} as ListShipmentsService,
      getShipment as unknown as GetShipmentService,
      {} as ListShipmentPendingCompletionService,
    );

    await controller.get({ identity: { tenantId: "tenant-1" } }, "shipment-1");

    expect(getShipment.execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      id: "shipment-1",
    });
  });

  it("loads the persistent pending-completion queue for the authenticated tenant", async () => {
    const listPending = { execute: vi.fn().mockResolvedValue({ items: [] }) };
    const controller = new ShipmentsController(
      {} as ListShipmentsService,
      {} as GetShipmentService,
      listPending as unknown as ListShipmentPendingCompletionService,
    );

    await controller.listPending(
      { identity: { tenantId: "tenant-1" } },
      "20",
      "cursor-1",
    );

    expect(listPending.execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      pageSize: "20",
      cursor: "cursor-1",
    });
  });
});
