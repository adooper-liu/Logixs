import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  ReplenishmentOrderWorkbenchRecord,
  ReplenishmentOrderWorkbenchRepository,
} from "../domain/replenishment-order-workbench.repository";

@Injectable()
export class PrismaReplenishmentOrderWorkbenchRepository implements ReplenishmentOrderWorkbenchRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(input: {
    tenantId: string;
    after?: { updatedAt: Date; id: string };
    take: number;
  }): Promise<ReplenishmentOrderWorkbenchRecord[]> {
    const rows = await this.prisma.replenishmentOrder.findMany({
      where: {
        tenantId: input.tenantId,
        ...(input.after
          ? {
              OR: [
                { updatedAt: { lt: input.after.updatedAt } },
                {
                  AND: [
                    { updatedAt: input.after.updatedAt },
                    { id: { lt: input.after.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: input.take,
      select: {
        id: true,
        orderNumber: true,
        updatedAt: true,
        containerRecords: {
          orderBy: { id: "asc" },
          select: { id: true, containerNumber: true },
        },
        lines: {
          where: { isCurrent: true },
          orderBy: [{ productNumber: "asc" }, { id: "asc" }],
          select: {
            id: true,
            productSkuId: true,
            productNumber: true,
            shippedQuantity: true,
            quantityUnit: true,
            cargoAllocations: {
              where: { allocationSet: { state: "active" } },
              orderBy: [
                { allocationSet: { containerRecordId: "asc" } },
                { id: "asc" },
              ],
              select: {
                allocatedQuantity: true,
                quantityUnit: true,
                allocationSet: {
                  select: {
                    containerRecord: {
                      select: { id: true, containerNumber: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      orderNumber: row.orderNumber,
      updatedAt: row.updatedAt.toISOString(),
      linkedContainers: row.containerRecords,
      lines: row.lines.map((line) => ({
        id: line.id,
        productSkuId: line.productSkuId,
        productNumber: line.productNumber,
        shippedQuantity: line.shippedQuantity.toString(),
        quantityUnit: line.quantityUnit,
        allocations: line.cargoAllocations.map((allocation) => ({
          containerId: allocation.allocationSet.containerRecord.id,
          containerNumber:
            allocation.allocationSet.containerRecord.containerNumber,
          allocatedQuantity: allocation.allocatedQuantity.toString(),
          quantityUnit: allocation.quantityUnit,
        })),
      })),
    }));
  }
}
