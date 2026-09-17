import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  ApplyReplenishmentOrderImportCommand,
  ApplyReplenishmentOrderImportResult,
  ReplenishmentOrderImportWriter,
} from "../domain/apply-replenishment-order-import";

@Injectable()
export class PrismaReplenishmentOrderImportWriter implements ReplenishmentOrderImportWriter {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  apply(
    command: ApplyReplenishmentOrderImportCommand,
  ): Promise<ApplyReplenishmentOrderImportResult> {
    return this.prisma.$transaction(async (transaction) => {
      const order = await transaction.replenishmentOrder.upsert({
        where: {
          tenantId_orderNumber: {
            tenantId: command.tenantId,
            orderNumber: command.orderNumber,
          },
        },
        create: {
          tenantId: command.tenantId,
          orderNumber: command.orderNumber,
        },
        update: {},
      });
      await transaction.$queryRaw`
        SELECT "id"
        FROM "replenishment_order"
        WHERE "id" = ${order.id}
        FOR UPDATE
      `;

      const containers = await transaction.containerRecord.findMany({
        where: {
          tenantId: command.tenantId,
          orderNumber: command.orderNumber,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 2,
      });
      if (containers.length > 1) {
        throw new ConflictException("LEGACY_ORDER_CONTAINER_CONFLICT");
      }

      const existing = containers[0];
      if (
        existing?.containerNumber &&
        command.containerNumber &&
        existing.containerNumber !== command.containerNumber
      ) {
        throw new ConflictException("CONTAINER_NUMBER_CONFLICT");
      }

      const container = existing
        ? await transaction.containerRecord.update({
            where: { id: existing.id },
            data: {
              replenishmentOrderId: order.id,
              containerNumber:
                command.containerNumber ?? existing.containerNumber,
            },
          })
        : await transaction.containerRecord.create({
            data: {
              tenantId: command.tenantId,
              orderNumber: command.orderNumber,
              replenishmentOrderId: order.id,
              containerNumber: command.containerNumber,
              currentStatus: "not_shipped",
            },
          });

      const existingSourceLines =
        await transaction.replenishmentOrderLine.findMany({
          where: {
            replenishmentOrderId: order.id,
            sourceBatchId: command.sourceBatchId,
          },
          select: { sourceRowId: true },
        });
      if (existingSourceLines.length > 0) {
        const existingRows = new Set(
          existingSourceLines.map(({ sourceRowId }) => sourceRowId),
        );
        if (
          existingRows.size !== command.lines.length ||
          command.lines.some((line) => !existingRows.has(line.sourceRowId))
        ) {
          throw new ConflictException("IMPORT_BATCH_REPLAY_CONFLICT");
        }
        const existingFacts = await transaction.shipmentTimeFact.findMany({
          where: {
            containerRecordId: container.id,
            sourceBatchId: command.sourceBatchId,
          },
          select: { sourceRowId: true, factCode: true },
        });
        const expectedFacts = new Set(
          command.timeFacts.map(
            (fact) => `${fact.sourceRowId}\u001f${fact.factCode}`,
          ),
        );
        if (
          existingFacts.length !== expectedFacts.size ||
          existingFacts.some(
            (fact) =>
              !expectedFacts.has(`${fact.sourceRowId}\u001f${fact.factCode}`),
          )
        ) {
          throw new ConflictException("IMPORT_BATCH_REPLAY_CONFLICT");
        }
        return {
          replenishmentOrderId: order.id,
          containerRecordId: container.id,
          created: !existing,
        };
      }

      await transaction.replenishmentOrderLine.updateMany({
        where: { replenishmentOrderId: order.id, isCurrent: true },
        data: {
          isCurrent: false,
          supersededByBatchId: command.sourceBatchId,
        },
      });
      await transaction.replenishmentOrderLine.createMany({
        data: command.lines.map((line) => ({
          replenishmentOrderId: order.id,
          sourceBatchId: command.sourceBatchId,
          sourceRowId: line.sourceRowId,
          productNumber: line.productNumber,
          shippedQuantity: line.shippedQuantity,
          quantityUnit: line.quantityUnit,
          contractNumber: line.contractNumber,
        })),
      });

      const factCodes = command.timeFacts.map(({ factCode }) => factCode);
      if (factCodes.length > 0) {
        await transaction.shipmentTimeFact.updateMany({
          where: {
            containerRecordId: container.id,
            factCode: { in: factCodes },
            isCurrent: true,
          },
          data: {
            isCurrent: false,
            supersededByBatchId: command.sourceBatchId,
          },
        });
        await transaction.shipmentTimeFact.createMany({
          data: command.timeFacts.map((fact) => ({
            tenantId: command.tenantId,
            containerRecordId: container.id,
            sourceBatchId: command.sourceBatchId,
            ...fact,
          })),
        });
      }

      return {
        replenishmentOrderId: order.id,
        containerRecordId: container.id,
        created: !existing,
      };
    });
  }
}
