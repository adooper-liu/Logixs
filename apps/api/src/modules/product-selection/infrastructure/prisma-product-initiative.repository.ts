import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  ProductInitiativeConflictError,
  ProductInitiativeNotFoundError,
  type PreparedProductInitiativeDecision,
  type ProductInitiativeReviewPoint,
} from "../domain/product-initiative";
import type {
  ProductInitiativeRecord,
  ProductInitiativeRepository,
} from "../domain/product-initiative.repository";

type Transaction = Prisma.TransactionClient;
type InitiativeRow = Prisma.ProductInitiativeGetPayload<{
  include: { handoff: { select: { signalId: true } } };
}>;

const OWNER_MODULE = "product_selection";

@Injectable()
export class PrismaProductInitiativeRepository implements ProductInitiativeRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async currentVersion(tenantId: string, handoffId: string): Promise<number> {
    const row = await this.prisma.productInitiative.findUnique({
      where: { tenantId_handoffId: { tenantId, handoffId } },
      select: { version: true },
    });
    return row?.version ?? 0;
  }

  async findByHandoffId(
    tenantId: string,
    handoffId: string,
  ): Promise<ProductInitiativeRecord | null> {
    const row = await this.prisma.productInitiative.findUnique({
      where: { tenantId_handoffId: { tenantId, handoffId } },
      include: { handoff: { select: { signalId: true } } },
    });
    return row ? toRecord(row) : null;
  }

  async list(
    input: Parameters<ProductInitiativeRepository["list"]>[0],
  ): Promise<ProductInitiativeRecord[]> {
    const rows = await this.prisma.productInitiative.findMany({
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
      include: { handoff: { select: { signalId: true } } },
    });
    return rows.map(toRecord);
  }

  persistDecision(
    input: Parameters<ProductInitiativeRepository["persistDecision"]>[0],
  ) {
    const { command } = input;
    return this.prisma.$transaction(async (tx) => {
      await advisoryLock(
        tx,
        `product-initiative:decision:${input.tenantId}:${input.handoffId}`,
      );

      const replay = await tx.productInitiative.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: input.tenantId,
            idempotencyKey: command.idempotencyKey,
          },
        },
        include: { handoff: { select: { signalId: true } } },
      });
      if (replay) {
        if (
          replay.handoffId !== input.handoffId ||
          replay.payloadHash !== command.payloadHash
        ) {
          conflict("PRODUCT_INITIATIVE_IDEMPOTENCY_CONFLICT");
        }
        return { record: toRecord(replay), duplicate: true };
      }

      const opportunity = await tx.marketOpportunityHandoff.findFirst({
        where: { id: input.handoffId, tenantId: input.tenantId },
      });
      if (!opportunity) {
        throw new ProductInitiativeNotFoundError(
          "PRODUCT_INITIATIVE_OPPORTUNITY_NOT_FOUND",
        );
      }
      if (!opportunity.isCurrent) conflict("PRODUCT_INITIATIVE_SUPERSEDED");

      const existing = await tx.productInitiative.findUnique({
        where: {
          tenantId_handoffId: {
            tenantId: input.tenantId,
            handoffId: input.handoffId,
          },
        },
      });
      const currentVersion = existing?.version ?? 0;
      if (currentVersion !== command.expectedVersion) {
        conflict("PRODUCT_INITIATIVE_VERSION_CONFLICT");
      }
      // 立项是终态：已交到产品侧的机会不再接受新的判断。
      if (existing?.outcome === "approve") {
        conflict("PRODUCT_INITIATIVE_ALREADY_APPROVED");
      }

      const data = {
        version: currentVersion + 1,
        outcome: command.outcome,
        completionState: command.completion,
        currentDestination: command.nextDestination,
        responsibleActorId: command.responsibleActorId,
        objective: command.objective,
        reviewPoints: command.reviewPoints as unknown as Prisma.InputJsonValue,
        reason: command.reason,
        pendingFieldCodes: command.pendingFieldCodes,
        actedBy: input.actorId,
        idempotencyKey: command.idempotencyKey,
        payloadHash: command.payloadHash,
        updatedAt: new Date(),
      };
      const row = existing
        ? await tx.productInitiative.update({
            where: { id: existing.id },
            data,
            include: { handoff: { select: { signalId: true } } },
          })
        : await tx.productInitiative.create({
            data: {
              id: command.initiativeId,
              tenantId: input.tenantId,
              handoffId: input.handoffId,
              ...data,
            },
            include: { handoff: { select: { signalId: true } } },
          });

      if (command.outcome === "approve") {
        // 立项成立：同一事务内追加不可变交接快照与 Outbox。
        await tx.productInitiativeHandoff.create({
          data: {
            id: randomUUID(),
            tenantId: input.tenantId,
            initiativeId: row.id,
            signalId: opportunity.signalId,
            version: row.version,
            marketCode: opportunity.marketCode,
            userProblem: opportunity.opportunityStatement,
            objective: command.objective!,
            responsibleActorId: command.responsibleActorId,
            reviewPoints:
              command.reviewPoints as unknown as Prisma.InputJsonValue,
            evidenceRefs: evidenceRefsOf(command.reviewPoints),
            createdBy: input.actorId,
            idempotencyKey: command.idempotencyKey,
            payloadHash: command.payloadHash,
          },
        });
        await tx.outboxMessage.create({
          data: {
            id: randomUUID(),
            tenantId: input.tenantId,
            ownerModule: OWNER_MODULE,
            eventId: randomUUID(),
            eventType: "product_initiative.handed_off",
            eventVersion: 1,
            aggregateType: "product_initiative",
            aggregateId: row.id,
            payloadRef: `product-initiative/${row.id}/v${row.version}`,
            payloadHash: command.payloadHash,
            state: "pending",
            occurredAt: row.updatedAt,
            idempotencyKey: command.idempotencyKey,
            traceId: command.idempotencyKey,
          },
        });
      }

      return { record: toRecord(row), duplicate: false };
    });
  }
}

/** 要点引用的证据去重后汇总到交接快照，便于产品侧一次取到全部依据。 */
function evidenceRefsOf(
  reviewPoints: PreparedProductInitiativeDecision["reviewPoints"],
): string[] {
  return [
    ...new Set(reviewPoints.flatMap((point) => point.evidenceRefs)),
  ].sort();
}

function toRecord(row: InitiativeRow): ProductInitiativeRecord {
  return {
    initiativeId: row.id,
    handoffId: row.handoffId,
    signalId: row.handoff.signalId,
    version: row.version,
    outcome: row.outcome as ProductInitiativeRecord["outcome"],
    completion: row.completionState as ProductInitiativeRecord["completion"],
    currentDestination:
      row.currentDestination as ProductInitiativeRecord["currentDestination"],
    responsibleActorId: row.responsibleActorId,
    objective: row.objective,
    reviewPoints: row.reviewPoints as unknown as ProductInitiativeReviewPoint[],
    reason: row.reason,
    pendingFieldCodes:
      row.pendingFieldCodes as ProductInitiativeRecord["pendingFieldCodes"],
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
  throw new ProductInitiativeConflictError(code);
}
