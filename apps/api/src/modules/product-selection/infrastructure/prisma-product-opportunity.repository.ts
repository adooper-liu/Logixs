import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { MarketOpportunityHandoffV1 } from "@logix/contracts";
import { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  ProductOpportunityConflictError,
  ProductOpportunityNotFoundError,
} from "../domain/product-opportunity";
import type {
  ProductOpportunityRecord,
  ProductOpportunityRepository,
} from "../domain/product-opportunity.repository";

type Transaction = Prisma.TransactionClient;
type HandoffRow = Prisma.MarketOpportunityHandoffGetPayload<
  Record<string, never>
>;

@Injectable()
export class PrismaProductOpportunityRepository implements ProductOpportunityRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(
    input: Parameters<ProductOpportunityRepository["list"]>[0],
  ): Promise<ProductOpportunityRecord[]> {
    const rows = await this.prisma.marketOpportunityHandoff.findMany({
      where: {
        tenantId: input.tenantId,
        recipientQueueCode: "product_selection",
        isCurrent: true,
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
    });
    const intakes = await this.prisma.productOpportunityIntake.findMany({
      where: {
        tenantId: input.tenantId,
        handoffId: { in: rows.map(({ id }) => id) },
      },
      orderBy: [{ version: "desc" }, { id: "desc" }],
    });
    const latestByHandoff = new Map<string, (typeof intakes)[number]>();
    for (const intake of intakes) {
      if (!latestByHandoff.has(intake.handoffId)) {
        latestByHandoff.set(intake.handoffId, intake);
      }
    }
    return rows.map((row) => {
      const intake = latestByHandoff.get(row.id);
      return {
        handoff: mapHandoff(row),
        intakeState: intake
          ? (intake.state as ProductOpportunityRecord["intakeState"])
          : "queued",
        intakeVersion: intake?.version ?? 0,
        assignedActorId: intake?.assignedActorId ?? null,
      };
    });
  }

  async findByHandoffId(
    tenantId: string,
    handoffId: string,
  ): Promise<ProductOpportunityRecord | null> {
    const handoff = await this.prisma.marketOpportunityHandoff.findFirst({
      where: { id: handoffId, tenantId },
    });
    if (!handoff) return null;
    if (!handoff.isCurrent) {
      return {
        handoff: mapHandoff(handoff),
        intakeState: "superseded",
        intakeVersion: 0,
        assignedActorId: null,
      };
    }
    const intake = await this.prisma.productOpportunityIntake.findFirst({
      where: { tenantId, handoffId },
      orderBy: { version: "desc" },
    });
    return toRecord(handoff, intake ?? null);
  }

  appendIntake(
    input: Parameters<ProductOpportunityRepository["appendIntake"]>[0],
  ) {
    return this.prisma.$transaction(async (tx) => {
      await advisoryLock(
        tx,
        `product-opportunity:intake:${input.tenantId}:${input.handoffId}`,
      );
      const replay = await tx.productOpportunityIntake.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: input.tenantId,
            idempotencyKey: input.command.idempotencyKey,
          },
        },
      });
      if (replay) {
        if (
          replay.handoffId !== input.handoffId ||
          replay.payloadHash !== input.command.payloadHash
        ) {
          conflict("PRODUCT_OPPORTUNITY_IDEMPOTENCY_CONFLICT");
        }
        return {
          record: await readOwnedOpportunity(
            tx,
            input.tenantId,
            input.handoffId,
          ),
          duplicate: true,
        };
      }
      const handoff = await tx.marketOpportunityHandoff.findFirst({
        where: { id: input.handoffId, tenantId: input.tenantId },
      });
      if (!handoff) {
        throw new ProductOpportunityNotFoundError(
          "PRODUCT_OPPORTUNITY_NOT_FOUND",
        );
      }
      if (!handoff.isCurrent) conflict("PRODUCT_OPPORTUNITY_SUPERSEDED");
      const current = await tx.productOpportunityIntake.findFirst({
        where: { tenantId: input.tenantId, handoffId: input.handoffId },
        orderBy: { version: "desc" },
      });
      const currentVersion = current?.version ?? 0;
      if (currentVersion !== input.command.expectedVersion) {
        conflict("PRODUCT_OPPORTUNITY_VERSION_CONFLICT");
      }
      const created = await tx.productOpportunityIntake.create({
        data: {
          id: randomUUID(),
          tenantId: input.tenantId,
          handoffId: input.handoffId,
          version: currentVersion + 1,
          state: input.command.state,
          assignedActorId: input.command.assignedActorId,
          actedBy: input.actorId,
          actedAt: new Date(),
          idempotencyKey: input.command.idempotencyKey,
          payloadHash: input.command.payloadHash,
        },
      });
      return {
        record: toRecord(handoff, created),
        duplicate: false,
      };
    });
  }
}

async function readOwnedOpportunity(
  tx: Transaction,
  tenantId: string,
  handoffId: string,
): Promise<ProductOpportunityRecord> {
  const handoff = await tx.marketOpportunityHandoff.findFirst({
    where: { id: handoffId, tenantId },
  });
  if (!handoff) {
    throw new ProductOpportunityNotFoundError("PRODUCT_OPPORTUNITY_NOT_FOUND");
  }
  const intake = await tx.productOpportunityIntake.findFirst({
    where: { tenantId, handoffId },
    orderBy: { version: "desc" },
  });
  return toRecord(handoff, intake ?? null);
}

function toRecord(
  handoff: HandoffRow,
  intake: {
    state: string;
    version: number;
    assignedActorId: string | null;
  } | null,
): ProductOpportunityRecord {
  return {
    handoff: mapHandoff(handoff),
    intakeState: intake
      ? (intake.state as ProductOpportunityRecord["intakeState"])
      : "queued",
    intakeVersion: intake?.version ?? 0,
    assignedActorId: intake?.assignedActorId ?? null,
  };
}

function mapHandoff(row: HandoffRow): MarketOpportunityHandoffV1 {
  return {
    contractVersion: "market_opportunity_handoff.v1",
    handoffId: row.id,
    version: row.version,
    signalId: row.signalId,
    signalVersion: row.signalVersion,
    title: row.title,
    recipientQueueCode: "product_selection",
    marketCode: row.marketCode,
    channelCode: row.channelCode,
    categoryRef: row.categoryRef,
    observedFactSummary: row.observedFactSummary,
    evidenceRefs: row.evidenceRefs,
    hypothesis: row.hypothesis,
    opportunityStatement: row.opportunityStatement,
    judgmentNote: row.judgmentNote,
    pendingFieldCodes:
      row.pendingFieldCodes as MarketOpportunityHandoffV1["pendingFieldCodes"],
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    idempotencyKey: row.idempotencyKey,
  };
}

async function advisoryLock(tx: Transaction, key: string): Promise<void> {
  await tx.$queryRaw`
    SELECT 1 AS "lockAcquired"
    FROM (SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))) AS acquired
  `;
}

function conflict(code: string): never {
  throw new ProductOpportunityConflictError(code);
}
