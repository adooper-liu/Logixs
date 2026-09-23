import { describe, expect, it, vi } from "vitest";
import type { ShipmentSummaryV1 } from "@logix/contracts";
import { ListShipmentsService } from "./list-shipments.service";

const summary = (id: string, updatedAt: string): ShipmentSummaryV1 => ({
  id,
  shipmentNumber: null,
  transportMode: "ocean",
  carrierCode: "HMM",
  vesselName: "ONE TRUTH",
  voyageNumber: "V001",
  originCountryCode: "CN",
  originUnlocode: "CNNGB",
  destinationCountryCode: "US",
  destinationUnlocode: "USLAX",
  salesCountryCode: null,
  cargoOwnerReferenceId: null,
  cargoOwnerName: null,
  atdAt: "2026-09-22T10:00:00.000Z",
  etaAt: null,
  currentLifecycleStatus: "departed",
  lifecycleVersion: 2,
  relationshipVersion: 1,
  activeContainerCount: 2,
  activeCargoLineCount: 1,
  lifecycleInitializationState: "ready",
  updatedAt,
});

describe("ListShipmentsService", () => {
  it("returns a stable cursor page bound to tenant and status", async () => {
    const repository = {
      list: vi
        .fn()
        .mockResolvedValue([
          summary(
            "11111111-1111-4111-8111-111111111111",
            "2026-09-23T10:00:00.000Z",
          ),
          summary(
            "22222222-2222-4222-8222-222222222222",
            "2026-09-23T09:00:00.000Z",
          ),
        ]),
      findById: vi.fn(),
    };
    const service = new ListShipmentsService(repository);

    const page = await service.execute({
      tenantId: "tenant-1",
      pageSize: "1",
      status: "departed",
    });

    expect(page.items).toHaveLength(1);
    expect(page.pageInfo).toMatchObject({ hasNextPage: true, pageSize: 1 });
    expect(page.pageInfo.nextCursor).toEqual(expect.any(String));
    expect(repository.list).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      status: "departed",
      after: undefined,
      take: 2,
    });

    await service.execute({
      tenantId: "tenant-1",
      pageSize: "1",
      status: "departed",
      cursor: page.pageInfo.nextCursor!,
    });
    expect(repository.list).toHaveBeenLastCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        status: "departed",
        after: {
          updatedAt: new Date("2026-09-23T10:00:00.000Z"),
          id: "11111111-1111-4111-8111-111111111111",
        },
      }),
    );
  });

  it("rejects invalid status and cross-filter cursor reuse", async () => {
    const repository = { list: vi.fn(), findById: vi.fn() };
    const service = new ListShipmentsService(repository);
    await expect(
      service.execute({ tenantId: "tenant-1", status: "unknown" }),
    ).rejects.toMatchObject({ status: 400 });

    repository.list.mockResolvedValue([
      summary(
        "11111111-1111-4111-8111-111111111111",
        "2026-09-23T10:00:00.000Z",
      ),
      summary(
        "22222222-2222-4222-8222-222222222222",
        "2026-09-23T09:00:00.000Z",
      ),
    ]);
    const first = await service.execute({
      tenantId: "tenant-1",
      pageSize: "1",
      status: "departed",
    });
    await expect(
      service.execute({
        tenantId: "tenant-1",
        pageSize: "1",
        status: "arrived",
        cursor: first.pageInfo.nextCursor!,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
