import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { PrismaService } from "../../../prisma/prisma.service";
import { PrismaReplenishmentOrderWorkbenchRepository } from "./prisma-replenishment-order-workbench.repository";

describe("PrismaReplenishmentOrderWorkbenchRepository", () => {
  it("按租户读取当前明细，并保留跨多个活动货柜的分配", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "order-1",
        orderNumber: "26DSC01812",
        updatedAt: new Date("2026-09-21T12:00:00.000Z"),
        containerRecords: [
          { id: "container-1", containerNumber: "HMMU4956442" },
        ],
        lines: [
          {
            id: "line-1",
            productSkuId: "11111111-1111-4111-8111-111111111111",
            productNumber: "311-013GY",
            shippedQuantity: { toString: () => "20" },
            quantityUnit: "piece",
            cargoAllocations: [
              {
                allocatedQuantity: { toString: () => "12" },
                quantityUnit: "piece",
                allocationSet: {
                  containerRecord: {
                    id: "container-1",
                    containerNumber: "HMMU4956442",
                  },
                },
              },
              {
                allocatedQuantity: { toString: () => "8" },
                quantityUnit: "piece",
                allocationSet: {
                  containerRecord: {
                    id: "container-2",
                    containerNumber: "HMMU4207629",
                  },
                },
              },
            ],
            shipmentCargoLines: [
              {
                shipment: {
                  id: "shipment-1",
                  shipmentNumber: "SHP-20260924-001",
                  currentLifecycleStatus: "departed",
                },
              },
            ],
          },
        ],
      },
    ]);
    const module = await Test.createTestingModule({
      providers: [
        PrismaReplenishmentOrderWorkbenchRepository,
        {
          provide: PrismaService,
          useValue: { replenishmentOrder: { findMany } },
        },
      ],
    }).compile();
    const repository = module.get(PrismaReplenishmentOrderWorkbenchRepository);

    await expect(
      repository.list({ tenantId: "tenant-a", take: 51 }),
    ).resolves.toMatchObject([
      {
        orderNumber: "26DSC01812",
        linkedContainers: [
          { id: "container-1", containerNumber: "HMMU4956442" },
        ],
        handoffShipments: [
          {
            id: "shipment-1",
            shipmentNumber: "SHP-20260924-001",
            currentLifecycleStatus: "departed",
          },
        ],
        lines: [
          {
            shippedQuantity: "20",
            allocations: [
              { containerId: "container-1", allocatedQuantity: "12" },
              { containerId: "container-2", allocatedQuantity: "8" },
            ],
          },
        ],
      },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-a" },
        take: 51,
        select: expect.objectContaining({
          lines: expect.objectContaining({
            where: { isCurrent: true },
            select: expect.objectContaining({
              cargoAllocations: expect.objectContaining({
                where: { allocationSet: { state: "active" } },
              }),
            }),
          }),
        }),
      }),
    );
  });

  it("按租户、备货单号和货号解析当前备货单行", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "line-1",
        productSkuId: "11111111-1111-4111-8111-111111111111",
        productNumber: "311-013GY",
        sourceRowId: "row-1",
        replenishmentOrder: { orderNumber: "26DSC01812" },
      },
    ]);
    const repository = new PrismaReplenishmentOrderWorkbenchRepository({
      replenishmentOrderLine: { findMany },
    } as never);

    await expect(
      repository.resolveCurrentLines({
        tenantId: "tenant-a",
        identities: [
          {
            replenishmentOrderNumber: "26DSC01812",
            productNumber: "311-013GY",
          },
        ],
      }),
    ).resolves.toEqual([
      {
        replenishmentOrderLineId: "line-1",
        replenishmentOrderNumber: "26DSC01812",
        productSkuId: "11111111-1111-4111-8111-111111111111",
        productNumber: "311-013GY",
        sourceRowId: "row-1",
      },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant-a",
          isCurrent: true,
          OR: [
            {
              productNumber: "311-013GY",
              replenishmentOrder: { orderNumber: "26DSC01812" },
            },
          ],
        },
      }),
    );
  });
});
