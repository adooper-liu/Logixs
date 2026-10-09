import { randomUUID } from "node:crypto";
import { Inject, Injectable, Optional } from "@nestjs/common";
import { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  APPLY_SELECTION_RETURN,
  MarketSignalConflictError,
  MarketSignalNotFoundError,
  MarketSignalValidationError,
  type ApplySelectionReturnPort,
} from "../../market-intelligence";
import {
  PRODUCT_INITIATIVE_RISK_CODES,
  ProductInitiativeConflictError,
  ProductInitiativeNotFoundError,
  type PreparedProductInitiativeDecision,
  type ProductInitiativeReviewPoint,
} from "../domain/product-initiative";
import type { PreparedProductInitiativeClaim } from "../domain/product-initiative-claim";
import type { PreparedProductInitiativeNpiReturn } from "../domain/product-initiative-npi-return";
import type {
  ProductInitiativeClaimRecord,
  ProductInitiativeHandoffRecord,
  ProductInitiativeNpiEntryRecord,
  ProductInitiativeRecord,
  ProductInitiativeRepository,
} from "../domain/product-initiative.repository";

type Transaction = Prisma.TransactionClient;
type InitiativeRow = Prisma.ProductInitiativeGetPayload<{
  include: { handoff: { select: { signalId: true } } };
}>;
type NpiEntryRow = Prisma.ProductInitiativeHandoffGetPayload<{
  include: {
    claims: true;
    initiative: { select: { version: true; currentDestination: true } };
  };
}>;
type ClaimRow = Prisma.ProductInitiativeClaimGetPayload<Record<string, never>>;

const OWNER_MODULE = "product_selection";

@Injectable()
export class PrismaProductInitiativeRepository implements ProductInitiativeRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional()
    @Inject(APPLY_SELECTION_RETURN)
    private readonly applySelectionReturn: ApplySelectionReturnPort | null = null,
  ) {}

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

  async findById(
    tenantId: string,
    initiativeId: string,
  ): Promise<ProductInitiativeRecord | null> {
    const row = await this.prisma.productInitiative.findFirst({
      where: { id: initiativeId, tenantId },
      include: { handoff: { select: { signalId: true } } },
    });
    return row ? toRecord(row) : null;
  }

  async list(
    input: Parameters<ProductInitiativeRepository["list"]>[0],
  ): Promise<ProductInitiativeRecord[]> {
    const dueWhere: Prisma.ProductInitiativeWhereInput = {
      tenantId: input.tenantId,
      outcome: "defer",
      currentDestination: "deferred",
      reconsiderationDate: { lte: input.todayUtc },
    };
    const standardWhere: Prisma.ProductInitiativeWhereInput = {
      tenantId: input.tenantId,
      OR: [
        { outcome: { not: "defer" } },
        { currentDestination: { not: "deferred" } },
        { reconsiderationDate: null },
        { reconsiderationDate: { gt: input.todayUtc } },
      ],
    };
    const include = { handoff: { select: { signalId: true } } } as const;
    const dueAfter =
      input.after?.group === "defer_reconsideration_due" &&
      input.after.reconsiderationDate
        ? {
            OR: [
              { reconsiderationDate: { gt: input.after.reconsiderationDate } },
              {
                reconsiderationDate: input.after.reconsiderationDate,
                OR: [
                  { updatedAt: { lt: input.after.updatedAt } },
                  {
                    updatedAt: input.after.updatedAt,
                    id: { lt: input.after.id },
                  },
                ],
              },
            ],
          }
        : {};
    const standardAfter = input.after
      ? {
          OR: [
            { updatedAt: { lt: input.after.updatedAt } },
            { updatedAt: input.after.updatedAt, id: { lt: input.after.id } },
          ],
        }
      : {};

    let dueRows: InitiativeRow[] = [];
    if (!input.after || input.after.group === "defer_reconsideration_due") {
      dueRows = await this.prisma.productInitiative.findMany({
        where: { AND: [dueWhere, dueAfter] },
        orderBy: [
          { reconsiderationDate: "asc" },
          { updatedAt: "desc" },
          { id: "desc" },
        ],
        take: input.take,
        include,
      });
    }
    if (dueRows.length >= input.take) return dueRows.map(toRecord);

    const standardRows = await this.prisma.productInitiative.findMany({
      where: {
        AND: [
          standardWhere,
          input.after?.group === "standard" ? standardAfter : {},
        ],
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: input.take - dueRows.length,
      include,
    });
    return [...dueRows, ...standardRows].map(toRecord);
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
      const intake = await tx.productOpportunityIntake.findFirst({
        where: { tenantId: input.tenantId, handoffId: input.handoffId },
        orderBy: { version: "desc" },
        select: { state: true },
      });
      if (intake?.state !== "accepted") {
        conflict("PRODUCT_INITIATIVE_NOT_ACCEPTED");
      }

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
      // 仍在产品侧（handed_off）的机会不再接受选品侧新判断；
      // NPI 退回后 destination=returned_from_npi，选品可再判。
      if (existing?.currentDestination === "handed_off") {
        conflict("PRODUCT_INITIATIVE_ALREADY_APPROVED");
      }
      if (existing?.currentDestination === "return_requested") {
        conflict("PRODUCT_INITIATIVE_RETURN_PENDING");
      }
      if (
        existing?.completionState === "completed" &&
        (existing.currentDestination === "rejected" ||
          existing.currentDestination === "deferred") &&
        Array.isArray(existing.riskAssessmentDraft) &&
        existing.riskAssessmentDraft.length === 0 &&
        existing.riskAssessmentSnapshot === null &&
        !PRODUCT_INITIATIVE_RISK_CODES.some((code) =>
          existing.pendingFieldCodes.includes(`risk.${code}`),
        )
      ) {
        conflict("PRODUCT_INITIATIVE_LEGACY_READ_ONLY");
      }

      const reviewPoints = (existing?.reviewPoints ??
        command.reviewPoints) as ProductInitiativeReviewPoint[];
      const data = {
        version: currentVersion + 1,
        outcome: command.outcome,
        completionState: command.completion,
        currentDestination: command.nextDestination,
        responsibleActorId: command.responsibleActorId,
        objective: command.objective,
        reviewPoints: reviewPoints as unknown as Prisma.InputJsonValue,
        businessCaseDraft:
          command.businessCaseDraft as unknown as Prisma.InputJsonValue,
        businessCaseSnapshot: nullableJson(
          command.businessCaseSnapshot ?? null,
        ),
        riskAssessmentDraft:
          command.riskAssessmentDraft as unknown as Prisma.InputJsonValue,
        riskAssessmentSnapshot: nullableJson(
          command.riskAssessmentSnapshot ?? null,
        ),
        reason: command.reason,
        returnBasis: command.returnBasis,
        responsibilityAccepted: command.responsibilityAccepted,
        receivingTeamOrRole: command.receivingTeamOrRole,
        resourceDescription: command.resourceDescription,
        targetDate: toDate(command.targetDate),
        nextDecisionDate: toDate(command.nextDecisionDate),
        nextDecisionQuestion: command.nextDecisionQuestion,
        validationFocus: command.validationFocus,
        reconsiderationDate: toDate(command.reconsiderationDate),
        unitEconomicsDraft: nullableJson(command.unitEconomicsDraft),
        unitEconomicsSnapshot: nullableJson(command.unitEconomicsSnapshot),
        negativeConservativeReason: command.negativeConservativeReason,
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
            responsibilityAccepted: command.responsibilityAccepted,
            receivingTeamOrRole: command.receivingTeamOrRole,
            resourceDescription: command.resourceDescription,
            targetDate: toDate(command.targetDate),
            nextDecisionDate: toDate(command.nextDecisionDate),
            nextDecisionQuestion: command.nextDecisionQuestion,
            unitEconomicsSnapshot:
              command.unitEconomicsSnapshot as unknown as Prisma.InputJsonValue,
            negativeConservativeReason: command.negativeConservativeReason,
            reviewPoints: reviewPoints as unknown as Prisma.InputJsonValue,
            businessCaseSnapshot:
              command.businessCaseSnapshot as unknown as Prisma.InputJsonValue,
            riskAssessmentSnapshot:
              command.riskAssessmentSnapshot as unknown as Prisma.InputJsonValue,
            evidenceRefs: evidenceRefsOf(command, reviewPoints),
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

      if (
        command.outcome === "return_to_market" &&
        command.completion === "completed" &&
        command.reason
      ) {
        await this.pushSelectionReturn(tx, {
          tenantId: input.tenantId,
          signalId: opportunity.signalId,
          actorId: input.actorId,
          returnReason: command.reason,
          returnBasis: command.returnBasis!,
          idempotencyKey: `selection-return:${command.idempotencyKey}`,
        });
      }

      return { record: toRecord(row), duplicate: false };
    });
  }

  private async pushSelectionReturn(
    tx: Transaction,
    input: {
      tenantId: string;
      signalId: string;
      actorId: string;
      returnReason: string;
      returnBasis: "insufficient_evidence" | "wrong_direction";
      idempotencyKey: string;
    },
  ): Promise<void> {
    if (!this.applySelectionReturn) {
      conflict("PRODUCT_INITIATIVE_SELECTION_RETURN_UNAVAILABLE");
    }
    try {
      await this.applySelectionReturn.executeInTransaction(tx, input);
    } catch (error) {
      if (
        error instanceof MarketSignalConflictError ||
        error instanceof MarketSignalNotFoundError ||
        error instanceof MarketSignalValidationError
      ) {
        conflict(error.message);
      }
      throw error;
    }
  }

  takeBackSelectionReturn(
    input: Parameters<
      ProductInitiativeRepository["takeBackSelectionReturn"]
    >[0],
  ) {
    return this.prisma.$transaction(async (tx) => {
      await advisoryLock(
        tx,
        `product-initiative:takeback:${input.tenantId}:${input.signalId}`,
      );
      if (!this.applySelectionReturn) {
        conflict("PRODUCT_INITIATIVE_SELECTION_RETURN_UNAVAILABLE");
      }
      const initiative = await tx.productInitiative.findFirst({
        where: {
          tenantId: input.tenantId,
          handoff: { signalId: input.signalId },
          currentDestination: "return_requested",
        },
        include: { handoff: { select: { signalId: true } } },
        orderBy: { updatedAt: "desc" },
      });
      const current =
        initiative ??
        (await tx.productInitiative.findFirst({
          where: {
            tenantId: input.tenantId,
            handoff: { signalId: input.signalId },
          },
          include: { handoff: { select: { signalId: true } } },
          orderBy: { updatedAt: "desc" },
        }));
      if (!current) {
        throw new ProductInitiativeNotFoundError(
          "PRODUCT_INITIATIVE_NOT_FOUND",
        );
      }
      if (!current.reason) {
        conflict("PRODUCT_INITIATIVE_RETURN_REASON_MISSING");
      }
      let result: { duplicate: boolean };
      try {
        result = await this.applySelectionReturn.takeBackInTransaction(tx, {
          tenantId: input.tenantId,
          signalId: input.signalId,
          actorId: input.actorId,
          expectedSignalVersion: input.command.expectedSignalVersion,
          returnReason: current.reason,
          idempotencyKey: input.command.idempotencyKey,
        });
      } catch (error) {
        if (
          error instanceof MarketSignalConflictError ||
          error instanceof MarketSignalNotFoundError ||
          error instanceof MarketSignalValidationError
        ) {
          conflict(error.message);
        }
        throw error;
      }
      if (result.duplicate) {
        return { record: toRecord(current), duplicate: true };
      }
      if (!initiative) conflict("PRODUCT_INITIATIVE_RETURN_NOT_PENDING");
      const updated = await tx.productInitiative.updateMany({
        where: {
          id: initiative.id,
          tenantId: input.tenantId,
          version: initiative.version,
          currentDestination: "return_requested",
        },
        data: {
          currentDestination: "returned_to_market",
          responsibleActorId: input.actorId,
          version: initiative.version + 1,
          actedBy: input.actorId,
          updatedAt: new Date(),
        },
      });
      if (updated.count !== 1) conflict("PRODUCT_INITIATIVE_VERSION_CONFLICT");
      const row = await tx.productInitiative.findUniqueOrThrow({
        where: { id: initiative.id },
        include: { handoff: { select: { signalId: true } } },
      });
      return { record: toRecord(row), duplicate: false };
    });
  }

  async listNpiQueue(
    input: Parameters<ProductInitiativeRepository["listNpiQueue"]>[0],
  ): Promise<ProductInitiativeNpiEntryRecord[]> {
    const currentHandoffs = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT h.id
      FROM "product_initiative_handoff" h
      INNER JOIN "product_initiative" i
        ON i.id = h.initiative_id
       AND i.tenant_id = h.tenant_id
      WHERE h.tenant_id = ${input.tenantId}
        AND i.current_destination = 'handed_off'
        AND h.version = i.version
        ${
          input.after
            ? Prisma.sql`
              AND (
                h.created_at < ${input.after.createdAt}
                OR (
                  h.created_at = ${input.after.createdAt}
                  AND h.id < ${input.after.id}
                )
              )
            `
            : Prisma.empty
        }
      ORDER BY h.created_at DESC, h.id DESC
      LIMIT ${input.take}
    `;
    if (currentHandoffs.length === 0) return [];

    const rows = await this.prisma.productInitiativeHandoff.findMany({
      where: {
        tenantId: input.tenantId,
        id: { in: currentHandoffs.map(({ id }) => id) },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        claims: { orderBy: { claimVersion: "desc" }, take: 1 },
        initiative: {
          select: { version: true, currentDestination: true },
        },
      },
    });
    return rows.map(toNpiEntry);
  }

  async findNpiEntry(
    tenantId: string,
    handoffId: string,
  ): Promise<ProductInitiativeNpiEntryRecord | null> {
    const row = await this.prisma.productInitiativeHandoff.findFirst({
      where: {
        id: handoffId,
        tenantId,
        initiative: { currentDestination: "handed_off" },
      },
      include: {
        claims: { orderBy: { claimVersion: "desc" }, take: 1 },
        initiative: {
          select: { version: true, currentDestination: true },
        },
      },
    });
    if (!row || row.version !== row.initiative.version) return null;
    return toNpiEntry(row);
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
        select: {
          id: true,
          version: true,
          initiative: { select: { version: true, currentDestination: true } },
        },
      });
      if (!entry) {
        throw new ProductInitiativeNotFoundError(
          "PRODUCT_INITIATIVE_HANDOFF_NOT_FOUND",
        );
      }
      if (
        entry.initiative.currentDestination !== "handed_off" ||
        entry.version !== entry.initiative.version
      ) {
        conflict("PRODUCT_INITIATIVE_NPI_HANDOFF_NOT_ACTIVE");
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

  persistNpiReturn(input: {
    tenantId: string;
    initiativeHandoffId: string;
    actorId: string;
    command: PreparedProductInitiativeNpiReturn;
  }): Promise<{ record: ProductInitiativeRecord; duplicate: boolean }> {
    const { command } = input;
    return this.prisma.$transaction(async (tx) => {
      await advisoryLock(
        tx,
        `product-initiative:npi-return:${input.tenantId}:${input.initiativeHandoffId}`,
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
          replay.payloadHash !== command.payloadHash ||
          replay.outcome !== "returned_from_npi"
        ) {
          conflict("PRODUCT_INITIATIVE_IDEMPOTENCY_CONFLICT");
        }
        return { record: toRecord(replay), duplicate: true };
      }

      const npiHandoff = await tx.productInitiativeHandoff.findFirst({
        where: { id: input.initiativeHandoffId, tenantId: input.tenantId },
        include: {
          claims: { orderBy: { claimVersion: "desc" }, take: 1 },
        },
      });
      if (!npiHandoff) {
        throw new ProductInitiativeNotFoundError(
          "PRODUCT_INITIATIVE_HANDOFF_NOT_FOUND",
        );
      }

      const existing = await tx.productInitiative.findFirst({
        where: { id: npiHandoff.initiativeId, tenantId: input.tenantId },
        include: { handoff: { select: { signalId: true } } },
      });
      if (!existing) {
        throw new ProductInitiativeNotFoundError(
          "PRODUCT_INITIATIVE_NOT_FOUND",
        );
      }
      if (existing.version !== command.expectedVersion) {
        conflict("PRODUCT_INITIATIVE_VERSION_CONFLICT");
      }
      if (existing.currentDestination !== "handed_off") {
        conflict("PRODUCT_INITIATIVE_NPI_RETURN_NOT_HANDED_OFF");
      }
      const owner = npiHandoff.claims[0]?.productOwnerActorId ?? null;
      if (!owner) conflict("PRODUCT_INITIATIVE_NPI_RETURN_NOT_CLAIMED");
      if (owner !== input.actorId) {
        conflict("PRODUCT_INITIATIVE_NPI_RETURN_NOT_OWNER");
      }

      const row = await tx.productInitiative.update({
        where: { id: existing.id },
        data: {
          version: command.version,
          outcome: command.outcome,
          completionState: command.completion,
          currentDestination: command.nextDestination,
          responsibleActorId: command.responsibleActorId,
          reason: command.reason,
          pendingFieldCodes: [],
          actedBy: input.actorId,
          idempotencyKey: command.idempotencyKey,
          payloadHash: command.payloadHash,
          updatedAt: new Date(),
        },
        include: { handoff: { select: { signalId: true } } },
      });

      await tx.outboxMessage.create({
        data: {
          id: randomUUID(),
          tenantId: input.tenantId,
          ownerModule: OWNER_MODULE,
          eventId: randomUUID(),
          eventType: "product_initiative.returned_from_npi",
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

      return { record: toRecord(row), duplicate: false };
    });
  }
}

/** 要点引用的证据去重后汇总到交接快照，便于产品侧一次取到全部依据。 */
function evidenceRefsOf(
  command: PreparedProductInitiativeDecision,
  reviewPoints: ProductInitiativeReviewPoint[],
): string[] {
  const unitEconomicsRefs = Object.values(
    command.unitEconomicsSnapshot?.scenarios ?? {},
  ).flatMap((scenario) =>
    scenario
      ? Object.entries(scenario)
          .filter(([field]) => field !== "contribution")
          .flatMap(([, range]) =>
            "evidenceRefs" in range ? range.evidenceRefs : [],
          )
      : [],
  );
  return [
    ...new Set([
      ...reviewPoints.flatMap((point) => point.evidenceRefs),
      ...(command.businessCaseSnapshot ?? []).flatMap(
        (point) => point.evidenceRefs,
      ),
      ...command.businessCaseDraft.flatMap((point) => point.evidenceRefs),
      ...command.riskAssessmentDraft.flatMap((point) => point.evidenceRefs),
      ...unitEconomicsRefs,
    ]),
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
      responsibilityAccepted: row.responsibilityAccepted,
      receivingTeamOrRole: row.receivingTeamOrRole,
      resourceDescription: row.resourceDescription,
      targetDate: row.targetDate,
      nextDecisionDate: row.nextDecisionDate,
      nextDecisionQuestion: row.nextDecisionQuestion,
      unitEconomicsSnapshot:
        row.unitEconomicsSnapshot as ProductInitiativeHandoffRecord["unitEconomicsSnapshot"],
      negativeConservativeReason: row.negativeConservativeReason,
      reviewPoints:
        row.reviewPoints as unknown as ProductInitiativeReviewPoint[],
      businessCaseSnapshot:
        row.businessCaseSnapshot as ProductInitiativeHandoffRecord["businessCaseSnapshot"],
      riskAssessmentSnapshot:
        (row.riskAssessmentSnapshot as ProductInitiativeHandoffRecord["riskAssessmentSnapshot"]) ??
        null,
      evidenceRefs: row.evidenceRefs,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      idempotencyKey: row.idempotencyKey,
    },
    claim: row.claims[0] ? toClaimRecord(row.claims[0]) : null,
    initiativeVersion: row.initiative.version,
    initiativeDestination: row.initiative
      .currentDestination as ProductInitiativeNpiEntryRecord["initiativeDestination"],
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
    responsibilityAccepted: row.responsibilityAccepted,
    receivingTeamOrRole: row.receivingTeamOrRole,
    resourceDescription: row.resourceDescription,
    targetDate: row.targetDate,
    nextDecisionDate: row.nextDecisionDate,
    nextDecisionQuestion: row.nextDecisionQuestion,
    validationFocus: row.validationFocus,
    reconsiderationDate: row.reconsiderationDate,
    unitEconomicsDraft:
      row.unitEconomicsDraft as ProductInitiativeRecord["unitEconomicsDraft"],
    unitEconomicsSnapshot:
      row.unitEconomicsSnapshot as ProductInitiativeRecord["unitEconomicsSnapshot"],
    negativeConservativeReason: row.negativeConservativeReason,
    objective: row.objective,
    reviewPoints: row.reviewPoints as unknown as ProductInitiativeReviewPoint[],
    businessCaseDraft:
      row.businessCaseDraft as unknown as ProductInitiativeRecord["businessCaseDraft"],
    businessCaseSnapshot:
      row.businessCaseSnapshot as ProductInitiativeRecord["businessCaseSnapshot"],
    riskAssessmentDraft:
      row.riskAssessmentDraft as unknown as ProductInitiativeRecord["riskAssessmentDraft"],
    riskAssessmentSnapshot:
      (row.riskAssessmentSnapshot as ProductInitiativeRecord["riskAssessmentSnapshot"]) ??
      null,
    reason: row.reason,
    returnBasis: row.returnBasis as ProductInitiativeRecord["returnBasis"],
    pendingFieldCodes:
      row.pendingFieldCodes as ProductInitiativeRecord["pendingFieldCodes"],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toDate(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function nullableJson(
  value: object | null,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === null
    ? Prisma.DbNull
    : (value as unknown as Prisma.InputJsonValue);
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
