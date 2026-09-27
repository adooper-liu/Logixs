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
import type { PreparedProductInitiativeClaim } from "../domain/product-initiative-claim";
import type {
  ProductInitiativeClaimRecord,
  ProductInitiativeNpiEntryRecord,
  ProductInitiativeRecord,
  ProductInitiativeRepository,
} from "../domain/product-initiative.repository";

type Transaction = Prisma.TransactionClient;
type InitiativeRow = Prisma.ProductInitiativeGetPayload<{
  include: { handoff: { select: { signalId: true } } };
}>;
type NpiEntryRow = Prisma.ProductInitiativeHandoffGetPayload<{
  include: { claims: true };
}>;
type ClaimRow = Prisma.ProductInitiativeClaimGetPayload<Record<string, never>>;

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

  async listNpiQueue(
    input: Parameters<ProductInitiativeRepository["listNpiQueue"]>[0],
  ): Promise<ProductInitiativeNpiEntryRecord[]> {
    const rows = await this.prisma.productInitiativeHandoff.findMany({
      where: {
        tenantId: input.tenantId,
        ...(input.after
          ? {
              OR: [
                { createdAt: { lt: input.after.createdAt } },
                {
                  AND: [
                    { createdAt: input.after.createdAt },
                    { id: { lt: input.after.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.take,
      include: { claims: { orderBy: { claimVersion: "desc" }, take: 1 } },
    });
    return rows.map(toNpiEntry);
  }

  async findNpiEntry(
    tenantId: string,
    handoffId: string,
  ): Promise<ProductInitiativeNpiEntryRecord | null> {
    const row = await this.prisma.productInitiativeHandoff.findFirst({
      where: { id: handoffId, tenantId },
      include: { claims: { orderBy: { claimVersion: "desc" }, take: 1 } },
    });
    return row ? toNpiEntry(row) : null;
  }

  appendClaim(input: {
    tenantId: string;
    handoffId: string;
    command: PreparedProductInitiativeClaim;
  }): Promise<{ record: ProductInitiativeClaimRecord; duplicate: boolean }> {
    const { command } = input;
    return this.prisma.$transaction(async (tx) => {
      // 同一票的领取串行化：两个人同时点，靠这把锁 + (handoff_id, claim_version)
      // 唯一索引两重防线，而不是先读后写去赌。
      await advisoryLock(
        tx,
        `product-initiative:claim:${input.tenantId}:${input.handoffId}`,
      );

      const replay = await tx.productInitiativeClaim.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: input.tenantId,
            idempotencyKey: command.idempotencyKey,
          },
        },
      });
      if (replay) {
        if (
          replay.handoffId !== input.handoffId ||
          replay.payloadHash !== command.payloadHash
        ) {
          conflict("PRODUCT_INITIATIVE_IDEMPOTENCY_CONFLICT");
        }
        return { record: toClaimRecord(replay), duplicate: true };
      }

      const entry = await tx.productInitiativeHandoff.findFirst({
        where: { id: input.handoffId, tenantId: input.tenantId },
        select: { id: true },
      });
      if (!entry) {
        throw new ProductInitiativeNotFoundError(
          "PRODUCT_INITIATIVE_HANDOFF_NOT_FOUND",
        );
      }

      const latest = await tx.productInitiativeClaim.findFirst({
        where: {
          tenantId: input.tenantId,
          handoffId: input.handoffId,
        },
        orderBy: { claimVersion: "desc" },
      });
      if ((latest?.claimVersion ?? 0) !== command.expectedClaimVersion) {
        conflict("PRODUCT_INITIATIVE_CLAIM_VERSION_CONFLICT");
      }

      const created = await tx.productInitiativeClaim.create({
        data: {
          id: randomUUID(),
          tenantId: input.tenantId,
          handoffId: input.handoffId,
          claimVersion: command.claimVersion,
          productOwnerActorId: command.productOwnerActorId,
          actedAt: new Date(),
          idempotencyKey: command.idempotencyKey,
          payloadHash: command.payloadHash,
        },
      });
      return { record: toClaimRecord(created), duplicate: false };
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

function toNpiEntry(row: NpiEntryRow): ProductInitiativeNpiEntryRecord {
  return {
    handoff: {
      handoffId: row.id,
      initiativeId: row.initiativeId,
      signalId: row.signalId,
      version: row.version,
      marketCode: row.marketCode,
      userProblem: row.userProblem,
      objective: row.objective,
      responsibleActorId: row.responsibleActorId,
      reviewPoints:
        row.reviewPoints as unknown as ProductInitiativeReviewPoint[],
      evidenceRefs: row.evidenceRefs,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      idempotencyKey: row.idempotencyKey,
    },
    claim: row.claims[0] ? toClaimRecord(row.claims[0]) : null,
  };
}

function toClaimRecord(row: ClaimRow): ProductInitiativeClaimRecord {
  return {
    claimId: row.id,
    handoffId: row.handoffId,
    claimVersion: row.claimVersion,
    productOwnerActorId: row.productOwnerActorId,
    // 落地时间就是业务上的领取时刻，不再另存一列。
    claimedAt: row.actedAt,
  };
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
