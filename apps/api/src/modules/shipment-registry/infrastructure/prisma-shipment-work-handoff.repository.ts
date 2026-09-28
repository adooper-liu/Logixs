import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  WorkHandoffConflictError,
  type PreparedWorkHandoffClaim,
  type PreparedWorkHandoffClose,
} from "../domain/shipment-work-handoff";
import type {
  ShipmentWorkHandoffRepository,
  WorkHandoffActionRecord,
  WorkHandoffRecord,
} from "../domain/shipment-work-handoff.repository";

type Transaction = Prisma.TransactionClient;
type HandoffRow = Prisma.ShipmentWorkHandoffGetPayload<Record<string, never>>;

export class WorkHandoffNotFoundError extends Error {}

/**
 * 事项交接的仓储。
 *
 * 两处要点：
 * 1. **动作留痕与当前态同事务写** —— 状态说"已了结"而留痕里没有那条，事后复盘就没依据。
 * 2. **幂等键在动作表上** —— 三个动作各有各的重试，记在交接行的一个字段里会互相覆盖。
 */
@Injectable()
export class PrismaShipmentWorkHandoffRepository implements ShipmentWorkHandoffRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findById(
    tenantId: string,
    handoffId: string,
  ): Promise<WorkHandoffRecord | null> {
    const row = await this.prisma.shipmentWorkHandoff.findFirst({
      where: { id: handoffId, tenantId },
    });
    return row ? toRecord(row) : null;
  }

  async listQueue(
    input: Parameters<ShipmentWorkHandoffRepository["listQueue"]>[0],
  ): Promise<WorkHandoffRecord[]> {
    const rows = await this.prisma.shipmentWorkHandoff.findMany({
      where: {
        tenantId: input.tenantId,
        recipientQueueCode: input.recipientQueueCode,
        // 已了结的留在票上可回看，不占队列。
        state: { not: "closed" },
        ...(input.after
          ? {
              OR: [
                { raisedAt: { lt: input.after.raisedAt } },
                {
                  AND: [
                    { raisedAt: input.after.raisedAt },
                    { id: { lt: input.after.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ raisedAt: "desc" }, { id: "desc" }],
      take: input.take,
    });
    return rows.map(toRecord);
  }

  async findByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<WorkHandoffRecord | null> {
    const row = await this.prisma.shipmentWorkHandoff.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
    });
    return row ? toRecord(row) : null;
  }

  async listByShipment(
    tenantId: string,
    shipmentId: string,
  ): Promise<WorkHandoffRecord[]> {
    const rows = await this.prisma.shipmentWorkHandoff.findMany({
      where: { tenantId, shipmentId },
      orderBy: [{ raisedAt: "desc" }, { id: "desc" }],
    });
    return rows.map(toRecord);
  }

  async findActionByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<WorkHandoffActionRecord | null> {
    const row = await this.prisma.shipmentWorkHandoffAction.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      select: { handoffId: true, action: true, payloadHash: true },
    });
    return row
      ? {
          handoffId: row.handoffId,
          action: row.action as WorkHandoffActionRecord["action"],
          payloadHash: row.payloadHash,
        }
      : null;
  }

  raiseHandoff(
    input: Parameters<ShipmentWorkHandoffRepository["raiseHandoff"]>[0],
  ) {
    const { command } = input;
    return this.prisma.$transaction(async (tx) => {
      const replay = await tx.shipmentWorkHandoff.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: input.tenantId,
            idempotencyKey: command.idempotencyKey,
          },
        },
      });
      if (replay) {
        if (replay.payloadHash !== command.payloadHash) {
          conflict("SHIPMENT_WORK_HANDOFF_IDEMPOTENCY_CONFLICT");
        }
        return { record: toRecord(replay), duplicate: true };
      }

      const raisedAt = new Date();
      try {
        const row = await tx.shipmentWorkHandoff.create({
          data: {
            id: randomUUID(),
            tenantId: input.tenantId,
            shipmentId: command.shipmentId,
            containerRecordId: command.containerRecordId,
            recipientQueueCode: command.recipientQueueCode,
            title: command.title,
            detail: command.detail,
            state: "raised",
            version: 1,
            raisedBy: input.actorId,
            raisedAt,
            actedBy: input.actorId,
            idempotencyKey: command.idempotencyKey,
            payloadHash: command.payloadHash,
            updatedAt: raisedAt,
          },
        });
        return { record: toRecord(row), duplicate: false };
      } catch (error) {
        // 票不存在时外键会拦；翻成明确的话，不让人看到数据库异常。
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2003"
        ) {
          throw new WorkHandoffNotFoundError(
            "SHIPMENT_WORK_HANDOFF_SHIPMENT_NOT_FOUND",
          );
        }
        throw error;
      }
    });
  }

  appendAction(
    input: Parameters<ShipmentWorkHandoffRepository["appendAction"]>[0],
  ) {
    const { command } = input;
    return this.prisma.$transaction(async (tx) => {
      await advisoryLock(
        tx,
        `shipment-work-handoff:${input.tenantId}:${input.handoffId}`,
      );

      const existing = await tx.shipmentWorkHandoff.findFirst({
        where: { id: input.handoffId, tenantId: input.tenantId },
      });
      if (!existing) {
        throw new WorkHandoffNotFoundError("SHIPMENT_WORK_HANDOFF_NOT_FOUND");
      }
      const replay = await tx.shipmentWorkHandoffAction.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: input.tenantId,
            idempotencyKey: command.idempotencyKey,
          },
        },
      });
      if (replay) {
        if (replay.payloadHash !== command.payloadHash) {
          conflict("SHIPMENT_WORK_HANDOFF_IDEMPOTENCY_CONFLICT");
        }
        return { record: toRecord(existing), duplicate: true };
      }
      if (existing.version !== command.expectedVersion) {
        conflict("SHIPMENT_WORK_HANDOFF_VERSION_CONFLICT");
      }

      const actedAt = new Date();
      const conclusion = conclusionOf(command);
      await tx.shipmentWorkHandoffAction.create({
        data: {
          id: randomUUID(),
          tenantId: input.tenantId,
          handoffId: existing.id,
          action: input.action,
          actorId: input.actorId,
          actedAt,
          conclusion,
          idempotencyKey: command.idempotencyKey,
          payloadHash: command.payloadHash,
        },
      });
      const row = await tx.shipmentWorkHandoff.update({
        where: { id: existing.id },
        data:
          input.action === "claim"
            ? {
                state: "claimed",
                version: command.version,
                claimedByActorId: input.actorId,
                claimedAt: actedAt,
                actedBy: input.actorId,
                updatedAt: actedAt,
              }
            : {
                state: "closed",
                version: command.version,
                closedByActorId: input.actorId,
                closedAt: actedAt,
                conclusion,
                actedBy: input.actorId,
                updatedAt: actedAt,
              },
      });
      return { record: toRecord(row), duplicate: false };
    });
  }
}

function conclusionOf(
  command: PreparedWorkHandoffClaim | PreparedWorkHandoffClose,
): string | null {
  return "conclusion" in command ? command.conclusion : null;
}

function toRecord(row: HandoffRow): WorkHandoffRecord {
  return {
    handoffId: row.id,
    shipmentId: row.shipmentId,
    containerRecordId: row.containerRecordId,
    recipientQueueCode:
      row.recipientQueueCode as WorkHandoffRecord["recipientQueueCode"],
    title: row.title,
    detail: row.detail,
    state: row.state as WorkHandoffRecord["state"],
    version: row.version,
    raisedBy: row.raisedBy,
    raisedAt: row.raisedAt,
    claimedByActorId: row.claimedByActorId,
    claimedAt: row.claimedAt,
    closedByActorId: row.closedByActorId,
    closedAt: row.closedAt,
    conclusion: row.conclusion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function advisoryLock(tx: Transaction, key: string): Promise<void> {
  await tx.$queryRaw`
    SELECT 1 AS "lockAcquired"
    FROM (SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))) AS acquired
  `;
}

function conflict(code: string): never {
  throw new WorkHandoffConflictError(code);
}
