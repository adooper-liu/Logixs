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
});
