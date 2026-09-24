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
            shipmentCargoLines: {
              where: { state: "active", supersededAt: null },
              orderBy: { shipmentId: "asc" },
              select: {
                shipment: {
                  select: {
                    id: true,
                    shipmentNumber: true,
                    currentLifecycleStatus: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return rows.map((row) => {
      const lines = row.lines.map((line) => ({
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
        handoffShipments: line.shipmentCargoLines.map(
          ({ shipment }) => shipment,
        ),
      }));
      return {
        id: row.id,
        orderNumber: row.orderNumber,
        updatedAt: row.updatedAt.toISOString(),
        linkedContainers: row.containerRecords,
        lines,
        handoffShipments: [
          ...new Map(
            lines.flatMap((line) =>
              line.handoffShipments.map((shipment) => [shipment.id, shipment]),
            ),
          ).values(),
        ],
      };
    });
  }

  async resolveCurrentLines(input: {
    tenantId: string;
    identities: Array<{
      replenishmentOrderNumber: string;
      productNumber: string;
    }>;
  }) {
    const rows = await this.prisma.replenishmentOrderLine.findMany({
      where: {
        tenantId: input.tenantId,
        isCurrent: true,
        OR: input.identities.map((identity) => ({
          productNumber: identity.productNumber,
          replenishmentOrder: {
            orderNumber: identity.replenishmentOrderNumber,
          },
        })),
      },
      orderBy: [{ replenishmentOrderId: "asc" }, { id: "asc" }],
      select: {
        id: true,
        productSkuId: true,
        productNumber: true,
        sourceRowId: true,
        replenishmentOrder: { select: { orderNumber: true } },
      },
    });
    return rows.map((row) => ({
      replenishmentOrderLineId: row.id,
      replenishmentOrderNumber: row.replenishmentOrder.orderNumber,
      productSkuId: row.productSkuId,
      productNumber: row.productNumber,
      sourceRowId: row.sourceRowId,
    }));
  }
}
