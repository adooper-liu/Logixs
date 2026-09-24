import { describe, expect, it, vi } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import type { GetShipmentService } from "../application/get-shipment.service";
import type { ListShipmentsService } from "../application/list-shipments.service";
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
  });

  it("passes tenant and paging filters to the Shipment list use case", async () => {
    const listShipments = { execute: vi.fn().mockResolvedValue({ items: [] }) };
    const controller = new ShipmentsController(
      listShipments as unknown as ListShipmentsService,
      {} as GetShipmentService,
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
    );

    await controller.get({ identity: { tenantId: "tenant-1" } }, "shipment-1");

    expect(getShipment.execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      id: "shipment-1",
    });
  });
});
