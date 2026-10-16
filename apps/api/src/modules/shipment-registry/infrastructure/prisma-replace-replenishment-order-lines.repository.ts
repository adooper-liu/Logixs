import { createHash } from "node:crypto";
import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  ReplaceReplenishmentOrderLinesCommand,
  ReplaceReplenishmentOrderLinesPort,
} from "../domain/replace-replenishment-order-lines";

@Injectable()
export class PrismaReplaceReplenishmentOrderLinesRepository implements ReplaceReplenishmentOrderLinesPort {
  constructor(private readonly prisma: PrismaService) {}

  execute(command: ReplaceReplenishmentOrderLinesCommand): Promise<void> {
    return this.executeBatch([command]);
  }

  async executeBatch(
    commands: ReplaceReplenishmentOrderLinesCommand[],
  ): Promise<void> {
    const prepared = prepareCommands(commands);
    await this.prisma.$transaction(async (transaction) => {
      for (const item of prepared)
        await applyCommand(transaction, item.command, item.contentHash);
    });
  }
}

type PreparedCommand = {
  command: ReplaceReplenishmentOrderLinesCommand;
  contentHash: string;
};

function prepareCommands(
  commands: ReplaceReplenishmentOrderLinesCommand[],
): PreparedCommand[] {
  const seenOrders = new Set<string>();
  return commands
    .map((command) => {
      const key = `${command.tenantId}\u001f${command.orderNumber}`;
      if (seenOrders.has(key))
        throw new ConflictException("IMPORT_BATCH_REPLAY_CONFLICT");
      seenOrders.add(key);
      return { command, contentHash: projectionContentHash(command) };
    })
    .sort((left, right) =>
      Buffer.from(
        `${left.command.tenantId}\u001f${left.command.orderNumber}`,
      ).compare(
        Buffer.from(
          `${right.command.tenantId}\u001f${right.command.orderNumber}`,
        ),
      ),
    );
}

async function applyCommand(
  transaction: Prisma.TransactionClient,
  command: ReplaceReplenishmentOrderLinesCommand,
  contentHash: string,
): Promise<void> {
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
      AND "tenant_id" = ${command.tenantId}
    FOR UPDATE
  `;
  const marker = await transaction.replenishmentOrderProjectionBatch.findUnique(
    {
      where: {
        tenantId_replenishmentOrderId_sourceBatchId: {
          tenantId: command.tenantId,
          replenishmentOrderId: order.id,
          sourceBatchId: command.sourceBatchId,
        },
      },
      select: { contentHash: true, lineCount: true },
    },
  );
  if (marker) {
    if (
      marker.contentHash !== contentHash ||
      marker.lineCount !== command.lines.length
    ) {
      throw new ConflictException("IMPORT_BATCH_REPLAY_CONFLICT");
    }
    return;
  }
  const preMarkerLines = await transaction.replenishmentOrderLine.findMany({
    where: {
      tenantId: command.tenantId,
      replenishmentOrderId: order.id,
      sourceBatchId: command.sourceBatchId,
    },
    select: {
      sourceRowId: true,
      productNumber: true,
      shippedQuantity: true,
      quantityUnit: true,
      contractNumber: true,
    },
  });
  if (preMarkerLines.length > 0) {
    const preMarkerHash = lineContentHash(
      preMarkerLines.map((line) => ({
        ...line,
        shippedQuantity: line.shippedQuantity.toString(),
        quantityUnit: projectionQuantityUnit(line.quantityUnit),
      })),
    );
    if (
      preMarkerHash !== contentHash ||
      preMarkerLines.length !== command.lines.length
    ) {
      throw new ConflictException("IMPORT_BATCH_REPLAY_CONFLICT");
    }
    await createMarker(transaction, command, order.id, contentHash);
    return;
  }
  const currentBatches = await transaction.replenishmentOrderLine.findMany({
    where: {
      tenantId: command.tenantId,
      replenishmentOrderId: order.id,
      isCurrent: true,
    },
    distinct: ["sourceBatchId"],
    select: { sourceBatchId: true },
  });
  if (currentBatches.length > 0) {
    if (
      !command.expectedCurrentSourceBatchId ||
      currentBatches.length !== 1 ||
      currentBatches[0]!.sourceBatchId !== command.expectedCurrentSourceBatchId
    ) {
      throw new ConflictException("IMPORT_BATCH_REPLAY_CONFLICT");
    }
  } else if (command.expectedCurrentSourceBatchId) {
    throw new ConflictException("IMPORT_BATCH_REPLAY_CONFLICT");
  }
  await transaction.replenishmentOrderLine.updateMany({
    where: { replenishmentOrderId: order.id, isCurrent: true },
    data: {
      isCurrent: false,
      supersededByBatchId: command.sourceBatchId,
    },
  });
  if (command.lines.length > 0) {
    await transaction.replenishmentOrderLine.createMany({
      data: command.lines.map((line) => ({
        tenantId: command.tenantId,
        replenishmentOrderId: order.id,
        sourceBatchId: command.sourceBatchId,
        sourceRowId: line.sourceRowId,
        productNumber: line.productNumber,
        shippedQuantity: line.shippedQuantity,
        quantityUnit: line.quantityUnit,
        contractNumber: line.contractNumber,
      })),
    });
  }
  await createMarker(transaction, command, order.id, contentHash);
}

type ProjectionLine = ReplaceReplenishmentOrderLinesCommand["lines"][number];

function lineContentHash(lines: ProjectionLine[]): string {
  const normalized = [...lines]
    .map((line) => ({
      sourceRowId: line.sourceRowId,
      productNumber: line.productNumber,
      shippedQuantity: canonicalProjectionDecimal(line.shippedQuantity),
      quantityUnit: line.quantityUnit,
      contractNumber: line.contractNumber,
    }))
    .sort((left, right) =>
      Buffer.from(left.sourceRowId).compare(Buffer.from(right.sourceRowId)),
    );
  return createHash("sha256")
    .update(JSON.stringify(normalized), "utf8")
    .digest("hex");
}

function projectionContentHash(
  command: ReplaceReplenishmentOrderLinesCommand,
): string {
  const sourceRowIds = new Set<string>();
  for (const line of command.lines) {
    if (sourceRowIds.has(line.sourceRowId))
      throw new ConflictException("IMPORT_BATCH_REPLAY_CONFLICT");
    sourceRowIds.add(line.sourceRowId);
  }
  return lineContentHash(command.lines);
}

function canonicalProjectionDecimal(value: string): string {
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value))
    throw new ConflictException("IMPORT_BATCH_REPLAY_CONFLICT");
  const [whole, fraction = ""] = value.split(".");
  const trimmedFraction = fraction.replace(/0+$/u, "");
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole!;
}

function projectionQuantityUnit(value: string): "piece" | "set" {
  if (value !== "piece" && value !== "set")
    throw new ConflictException("IMPORT_BATCH_REPLAY_CONFLICT");
  return value;
}

async function createMarker(
  transaction: {
    replenishmentOrderProjectionBatch: {
      create(input: unknown): Promise<unknown>;
    };
  },
  command: ReplaceReplenishmentOrderLinesCommand,
  replenishmentOrderId: string,
  contentHash: string,
): Promise<void> {
  await transaction.replenishmentOrderProjectionBatch.create({
    data: {
      tenantId: command.tenantId,
      replenishmentOrderId,
      sourceBatchId: command.sourceBatchId,
      contentHash,
      lineCount: command.lines.length,
    },
  });
}
