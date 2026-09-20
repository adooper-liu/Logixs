import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  ReplenishmentLineNotFoundError,
  ReplenishmentLineSkuBindingConflictError,
  type BoundReplenishmentLineProductSku,
  type NormalizedBindReplenishmentLineProductSkuCommand,
} from "../domain/replenishment-line-sku-binding";
import type { ReplenishmentLineSkuBinder } from "../domain/replenishment-line-sku-binding.repository";

@Injectable()
export class PrismaReplenishmentLineSkuBinder implements ReplenishmentLineSkuBinder {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  bind(
    command: NormalizedBindReplenishmentLineProductSkuCommand,
  ): Promise<BoundReplenishmentLineProductSku> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT "id"
        FROM "replenishment_order_line"
        WHERE "id" = ${command.replenishmentOrderLineId}
        FOR UPDATE
      `;
      const line = await transaction.replenishmentOrderLine.findUnique({
        where: {
          id_tenantId: {
            id: command.replenishmentOrderLineId,
            tenantId: command.tenantId,
          },
        },
        select: {
          id: true,
          productSkuId: true,
          productNumber: true,
          version: true,
        },
      });
      if (!line) {
        throw new ReplenishmentLineNotFoundError(
          "REPLENISHMENT_ORDER_LINE_NOT_FOUND",
        );
      }
      if (line.productNumber !== command.productNumber) {
        throw new ReplenishmentLineSkuBindingConflictError(
          "REPLENISHMENT_LINE_PRODUCT_NUMBER_MISMATCH",
        );
      }
      if (line.productSkuId) {
        if (line.productSkuId !== command.productSkuId) {
          throw new ReplenishmentLineSkuBindingConflictError(
            "REPLENISHMENT_LINE_SKU_BINDING_CONFLICT",
          );
        }
        return toResult(line, true);
      }
      if (line.version !== command.expectedVersion) {
        throw new ReplenishmentLineSkuBindingConflictError(
          "REPLENISHMENT_LINE_VERSION_CONFLICT",
        );
      }
      const updated = await transaction.replenishmentOrderLine.update({
        where: { id: line.id },
        data: {
          productSkuId: command.productSkuId,
          version: { increment: 1 },
        },
        select: {
          id: true,
          productSkuId: true,
          productNumber: true,
          version: true,
        },
      });
      return toResult(updated, false);
    });
  }
}

function toResult(
  line: {
    id: string;
    productSkuId: string | null;
    productNumber: string;
    version: number;
  },
  duplicate: boolean,
): BoundReplenishmentLineProductSku {
  if (!line.productSkuId) {
    throw new Error("REPLENISHMENT_LINE_SKU_BINDING_INVARIANT");
  }
  return {
    replenishmentOrderLineId: line.id,
    productSkuId: line.productSkuId,
    productNumber: line.productNumber,
    version: line.version,
    duplicate,
  };
}
