import { describe, expect, it, vi } from "vitest";
import { GetShipmentService } from "./get-shipment.service";

describe("GetShipmentService", () => {
  it("returns the tenant-scoped projection with a read timestamp", async () => {
    const repository = {
      list: vi.fn(),
      listPendingCompletion: vi.fn(),
      findById: vi.fn().mockResolvedValue({
        shipment: { id: "shipment-1" },
        handoff: null,
        containers: [],
        cargoLines: [],
        transportDocuments: [],
        upstreamReferences: [],
        lifecycleInitialization: {},
        projectionVersion: 2,
      }),
    };
    const service = new GetShipmentService(repository as never);

    await expect(
      service.execute({ tenantId: "tenant-1", id: "shipment-1" }),
    ).resolves.toMatchObject({
      shipment: { id: "shipment-1" },
      asOf: expect.any(String),
    });
    expect(repository.findById).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      id: "shipment-1",
    });
  });

  it("does not reveal whether another tenant owns the Shipment", async () => {
    const repository = {
      list: vi.fn(),
      listPendingCompletion: vi.fn(),
      findById: vi.fn().mockResolvedValue(null),
    };
    const service = new GetShipmentService(repository);

    await expect(
      service.execute({ tenantId: "tenant-2", id: "shipment-1" }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
