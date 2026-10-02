import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { MarketOpportunityHandoffV1 } from "@logix/contracts";
import { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  MarketSignalConflictError,
  MarketSignalNotFoundError,
  prepareSelectionReturnDecision,
} from "../domain/market-signal";
import type {
  ApplySelectionReturnInput,
  MarketSignalDecisionPersistenceResult,
  MarketSignalRecord,
  MarketSignalRepository,
  PersistMarketSignalDecisionInput,
} from "../domain/market-signal.repository";

type Transaction = Prisma.TransactionClient;
type SignalRow = Prisma.MarketSignalGetPayload<Record<string, never>>;
type HandoffRow = Prisma.MarketOpportunityHandoffGetPayload<
  Record<string, never>
>;

const OWNER_MODULE = "market-intelligence";

@Injectable()
export class PrismaMarketSignalRepository implements MarketSignalRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  create(input: Parameters<MarketSignalRepository["create"]>[0]) {
    return this.prisma.$transaction(async (tx) => {
      await advisoryLock(
        tx,
        `market-signal:create:${input.tenantId}:${input.command.idempotencyKey}`,
      );
      const existing = await tx.marketSignal.findFirst({
        where: {
          tenantId: input.tenantId,
          OR: [
            { id: input.command.signalId },
            { createIdempotencyKey: input.command.idempotencyKey },
          ],
        },
      });
      if (existing) {
        if (
          existing.id !== input.command.signalId ||
          existing.createPayloadHash !== input.command.payloadHash
        ) {
          conflict("MARKET_SIGNAL_CREATE_IDEMPOTENCY_CONFLICT");
        }
        return { record: mapSignal(existing), duplicate: true };
      }
      const row = await tx.marketSignal.create({
        data: {
          id: input.command.signalId,
          tenantId: input.tenantId,
          title: input.command.title,
          marketCode: input.command.marketCode,
          channelCode: input.command.channelCode,
          categoryRef: input.command.categoryRef,
          observedFactSummary: input.command.observedFactSummary,
          hypothesis: input.command.hypothesis,
          currentDestination: "needs_decision",
          ownerTeamCode: input.command.ownerTeamCode,
          createdBy: input.actorId,
          updatedBy: input.actorId,
          createIdempotencyKey: input.command.idempotencyKey,
          createPayloadHash: input.command.payloadHash,
        },
      });
      return { record: mapSignal(row), duplicate: false };
    });
  }

  async findById(
    tenantId: string,
    signalId: string,
  ): Promise<MarketSignalRecord | null> {
    const row = await this.prisma.marketSignal.findFirst({
      where: { id: signalId, tenantId },
    });
    return row ? mapSignal(row) : null;
  }

  async findLatestSelectionReturnReason(
    tenantId: string,
    signalId: string,
  ): Promise<string | null> {
    const row = await this.prisma.marketSignalDecision.findFirst({
      where: {
        tenantId,
        signalId,
        decisionType: "selection_return",
        completionState: "completed",
      },
      orderBy: { decisionVersion: "desc" },
      select: { judgmentNote: true },
    });
    return row?.judgmentNote ?? null;
  }

  async list(
    query: Parameters<MarketSignalRepository["list"]>[0],
  ): Promise<MarketSignalRecord[]> {
    const rows = await this.prisma.marketSignal.findMany({
      where: {
        tenantId: query.tenantId,
        currentDestination: query.destination,
        ...listAfterWhere(query.destination, query.after),
      },
      orderBy:
        query.destination === "watching"
          ? [
              {
                activeValidationDueDate: { sort: "asc", nulls: "last" },
              },
              { updatedAt: "desc" },
              { id: "desc" },
            ]
          : [{ updatedAt: "desc" }, { id: "desc" }],
      take: query.take,
    });
    return rows.map(mapSignal);
  }

  count(input: Parameters<MarketSignalRepository["count"]>[0]) {
    return this.prisma.marketSignal.count({
      where: {
        tenantId: input.tenantId,
        currentDestination: input.destination,
      },
    });
  }

  updateFacts(input: Parameters<MarketSignalRepository["updateFacts"]>[0]) {
    return this.prisma.$transaction(async (tx) => {
      await advisoryLock(
        tx,
        `market-signal:update:${input.tenantId}:${input.signalId}`,
      );
      const replay = await tx.outboxMessage.findUnique({
        where: {
          tenantId_ownerModule_eventType_idempotencyKey: {
            tenantId: input.tenantId,
            ownerModule: OWNER_MODULE,
            eventType: "market_signal.updated",
            idempotencyKey: input.command.idempotencyKey,
          },
        },
      });
      if (replay) {
        if (
          replay.aggregateId !== input.signalId ||
          replay.payloadHash !== input.command.payloadHash
        ) {
          conflict("MARKET_SIGNAL_UPDATE_IDEMPOTENCY_CONFLICT");
        }
        const current = await ownedSignal(tx, input.tenantId, input.signalId);
        return { record: mapSignal(current), duplicate: true };
      }
      const updated = await tx.marketSignal.updateMany({
        where: {
          id: input.signalId,
          tenantId: input.tenantId,
          version: input.command.expectedSignalVersion,
        },
        data: {
          ...input.command.changes,
          version: { increment: 1 },
          updatedBy: input.actorId,
        },
      });
      if (updated.count !== 1) {
        const exists = await tx.marketSignal.count({
          where: { id: input.signalId, tenantId: input.tenantId },
        });
        if (exists === 0)
          throw new MarketSignalNotFoundError("MARKET_SIGNAL_NOT_FOUND");
        conflict("MARKET_SIGNAL_VERSION_CONFLICT");
      }
      const row = await ownedSignal(tx, input.tenantId, input.signalId);
      await tx.outboxMessage.create({
        data: {
          id: randomUUID(),
          tenantId: input.tenantId,
          ownerModule: OWNER_MODULE,
          eventId: randomUUID(),
          eventType: "market_signal.updated",
          eventVersion: 1,
          aggregateType: "market_signal",
          aggregateId: input.signalId,
          payloadRef: `market-signal/${input.signalId}/v${row.version}`,
          payloadHash: input.command.payloadHash,
          state: "pending",
          occurredAt: row.updatedAt,
          idempotencyKey: input.command.idempotencyKey,
          traceId: input.command.idempotencyKey,
        },
      });
      return { record: mapSignal(row), duplicate: false };
    });
  }

  decide(
    input: PersistMarketSignalDecisionInput,
  ): Promise<MarketSignalDecisionPersistenceResult> {
    return this.prisma.$transaction(async (tx) => {
      await advisoryLock(
        tx,
        `market-signal:decision:${input.tenantId}:${input.signalId}`,
      );
      const replay = await tx.marketSignalDecision.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: input.tenantId,
            idempotencyKey: input.prepared.idempotencyKey,
          },
        },
      });
      if (replay) {
        if (
          replay.signalId !== input.signalId ||
          replay.payloadHash !== input.prepared.payloadHash
        ) {
          conflict("MARKET_SIGNAL_DECISION_IDEMPOTENCY_CONFLICT");
        }
        const signal = await ownedSignal(tx, input.tenantId, input.signalId);
        const handoff = await tx.marketOpportunityHandoff.findFirst({
          where: {
            tenantId: input.tenantId,
            signalId: input.signalId,
            idempotencyKey: input.prepared.idempotencyKey,
          },
        });
        return {
          signal: mapSignal(signal),
          decision: {
            id: replay.id,
            version: replay.decisionVersion,
            decisionType:
              replay.decisionType as MarketSignalDecisionPersistenceResult["decision"]["decisionType"],
            completion:
              replay.completionState as MarketSignalDecisionPersistenceResult["decision"]["completion"],
            pendingFieldCodes:
              replay.pendingFieldCodes as MarketSignalDecisionPersistenceResult["decision"]["pendingFieldCodes"],
          },
          handoff: handoff ? mapHandoff(handoff) : null,
          duplicate: true,
        };
      }

      const signal = await ownedSignal(tx, input.tenantId, input.signalId);
      if (
        signal.currentDestination === "voided" ||
        signal.currentDestination === "archived"
      ) {
        conflict("MARKET_SIGNAL_ALREADY_CLOSED");
      }
      if (signal.version !== input.prepared.expectedSignalVersion) {
        conflict("MARKET_SIGNAL_VERSION_CONFLICT");
      }
      if (
        input.prepared.decisionType === "watch" &&
        signal.activeValidationOwnerActorId &&
        signal.activeValidationOwnerActorId !== input.actorId
      ) {
        conflict("MARKET_SIGNAL_VALIDATION_OWNER_CONFLICT");
      }
      const latestDecision = await tx.marketSignalDecision.findFirst({
        where: { tenantId: input.tenantId, signalId: input.signalId },
        orderBy: { decisionVersion: "desc" },
        select: { decisionVersion: true },
      });
      const nextSignalVersion = signal.version + 1;
      const decisionVersion = (latestDecision?.decisionVersion ?? 0) + 1;
      const createdAt = new Date();
      const decision = await tx.marketSignalDecision.create({
        data: {
          id: randomUUID(),
          tenantId: input.tenantId,
          signalId: input.signalId,
          decisionVersion,
          signalVersion: nextSignalVersion,
          decisionType: input.prepared.decisionType,
          completionState: input.prepared.completion,
          judgmentNote: input.prepared.judgmentNote,
          opportunityStatement: input.prepared.opportunityStatement,
          nextReviewDate: input.prepared.nextReviewDate
            ? new Date(`${input.prepared.nextReviewDate}T00:00:00.000Z`)
            : null,
          watchFocus: input.prepared.watchFocus,
          waitingReason: input.prepared.waitingReason,
          dismissReason: input.prepared.dismissReason,
          pendingFieldCodes: input.prepared.pendingFieldCodes,
          createdBy: input.actorId,
          idempotencyKey: input.prepared.idempotencyKey,
          payloadHash: input.prepared.payloadHash,
          createdAt,
        },
      });

      let handoff: MarketOpportunityHandoffV1 | null = null;
      if (input.prepared.decisionType === "handoff") {
        const latestHandoff = await tx.marketOpportunityHandoff.findFirst({
          where: { tenantId: input.tenantId, signalId: input.signalId },
          orderBy: { version: "desc" },
          select: { version: true },
        });
        const handoffId = randomUUID();
        handoff = {
          contractVersion: "market_opportunity_handoff.v1",
          handoffId,
          version: (latestHandoff?.version ?? 0) + 1,
          signalId: signal.id,
          signalVersion: nextSignalVersion,
          title: signal.title,
          recipientQueueCode: "product_selection",
          marketCode: signal.marketCode,
          channelCode: signal.channelCode,
          categoryRef: signal.categoryRef,
          observedFactSummary: signal.observedFactSummary,
          evidenceRefs: input.evidenceRefs,
          hypothesis: signal.hypothesis,
          opportunityStatement: input.prepared.opportunityStatement,
          judgmentNote: input.prepared.judgmentNote,
          pendingFieldCodes: input.prepared.pendingFieldCodes,
          createdBy: input.actorId,
          createdAt: createdAt.toISOString(),
          idempotencyKey: input.prepared.idempotencyKey,
        };
        const handoffPayloadHash = hashJson(handoff);
        await tx.marketOpportunityHandoff.updateMany({
          where: {
            tenantId: input.tenantId,
            signalId: input.signalId,
            isCurrent: true,
          },
          data: { isCurrent: false },
        });
        await tx.marketOpportunityHandoff.create({
          data: {
            id: handoff.handoffId,
            tenantId: input.tenantId,
            signalId: handoff.signalId,
            version: handoff.version,
            signalVersion: handoff.signalVersion,
            title: handoff.title,
            recipientQueueCode: handoff.recipientQueueCode,
            marketCode: handoff.marketCode,
            channelCode: handoff.channelCode,
            categoryRef: handoff.categoryRef,
            observedFactSummary: handoff.observedFactSummary,
            evidenceRefs: handoff.evidenceRefs,
            hypothesis: handoff.hypothesis,
            opportunityStatement: handoff.opportunityStatement,
            judgmentNote: handoff.judgmentNote,
            pendingFieldCodes: handoff.pendingFieldCodes,
            createdBy: handoff.createdBy,
            idempotencyKey: handoff.idempotencyKey,
            payloadHash: handoffPayloadHash,
            isCurrent: true,
            createdAt,
          },
        });
        await tx.outboxMessage.create({
          data: {
            id: randomUUID(),
            tenantId: input.tenantId,
            ownerModule: OWNER_MODULE,
            eventId: randomUUID(),
            eventType: "market_opportunity_handoff.created",
            eventVersion: 1,
            aggregateType: "market_signal",
            aggregateId: signal.id,
            payloadRef: `market-opportunity-handoff/${handoff.handoffId}/v${handoff.version}`,
            payloadHash: handoffPayloadHash,
            state: "pending",
            occurredAt: createdAt,
            idempotencyKey: `market-opportunity-handoff:${handoff.handoffId}`,
            traceId: input.prepared.idempotencyKey,
          },
        });
      }

      if (
        (input.prepared.decisionType === "void" ||
          input.prepared.decisionType === "archive") &&
        input.prepared.completion === "completed"
      ) {
        // 快照内容不动；只取消「当前」标记，选品队列不再把该机会当在办。
        await tx.marketOpportunityHandoff.updateMany({
          where: {
            tenantId: input.tenantId,
            signalId: input.signalId,
            isCurrent: true,
          },
          data: { isCurrent: false },
        });
      }

      const completedWatch =
        input.prepared.decisionType === "watch" &&
        input.prepared.completion === "completed";
      const completedExit =
        input.prepared.decisionType !== "watch" &&
        input.prepared.completion === "completed";
      const updated = await tx.marketSignal.updateMany({
        where: {
          id: input.signalId,
          tenantId: input.tenantId,
          version: input.prepared.expectedSignalVersion,
        },
        data: {
          currentDestination: completedWatch
            ? input.prepared.nextDestination
            : completedExit
              ? input.prepared.nextDestination
              : signal.currentDestination,
          activeValidationOwnerActorId: completedWatch
            ? input.actorId
            : completedExit
              ? null
              : signal.activeValidationOwnerActorId,
          activeValidationDueDate: completedWatch
            ? new Date(`${input.prepared.nextReviewDate!}T00:00:00.000Z`)
            : completedExit
              ? null
              : signal.activeValidationDueDate,
          activeValidationFocus: completedWatch
            ? input.prepared.watchFocus
            : completedExit
              ? null
              : signal.activeValidationFocus,
          activeValidationWaitingReason: completedWatch
            ? input.prepared.waitingReason
            : completedExit
              ? null
              : signal.activeValidationWaitingReason,
          version: nextSignalVersion,
          updatedBy: input.actorId,
          updatedAt: createdAt,
        },
      });
      if (updated.count !== 1) conflict("MARKET_SIGNAL_VERSION_CONFLICT");
      const updatedSignal = await ownedSignal(
        tx,
        input.tenantId,
        input.signalId,
      );
      return {
        signal: mapSignal(updatedSignal),
        decision: {
          id: decision.id,
          version: decision.decisionVersion,
          decisionType: input.prepared.decisionType,
          completion: input.prepared.completion,
          pendingFieldCodes: input.prepared.pendingFieldCodes,
        },
        handoff,
        duplicate: false,
      };
    });
  }

  async applySelectionReturnWithin(
    txInput: unknown,
    input: ApplySelectionReturnInput,
  ): Promise<{ duplicate: boolean }> {
    const tx = txInput as Transaction;
    await advisoryLock(
      tx,
      `market-signal:decision:${input.tenantId}:${input.signalId}`,
    );

    const signal = await ownedSignal(tx, input.tenantId, input.signalId);
    const prepared = prepareSelectionReturnDecision({
      expectedSignalVersion: signal.version,
      returnReason: input.returnReason,
      idempotencyKey: input.idempotencyKey,
    });

    const replay = await tx.marketSignalDecision.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId: input.tenantId,
          idempotencyKey: prepared.idempotencyKey,
        },
      },
    });
    if (replay) {
      if (
        replay.signalId !== input.signalId ||
        replay.payloadHash !== prepared.payloadHash
      ) {
        conflict("MARKET_SIGNAL_DECISION_IDEMPOTENCY_CONFLICT");
      }
      return { duplicate: true };
    }

    if (
      signal.currentDestination !== "handed_off" &&
      signal.currentDestination !== "returned_from_selection"
    ) {
      conflict("MARKET_SIGNAL_SELECTION_RETURN_INVALID_STATE");
    }

    const latestDecision = await tx.marketSignalDecision.findFirst({
      where: { tenantId: input.tenantId, signalId: input.signalId },
      orderBy: { decisionVersion: "desc" },
      select: { decisionVersion: true },
    });
    const nextSignalVersion = signal.version + 1;
    const decisionVersion = (latestDecision?.decisionVersion ?? 0) + 1;
    const createdAt = new Date();

    await tx.marketSignalDecision.create({
      data: {
        id: randomUUID(),
        tenantId: input.tenantId,
        signalId: input.signalId,
        decisionVersion,
        signalVersion: nextSignalVersion,
        decisionType: prepared.decisionType,
        completionState: prepared.completion,
        judgmentNote: prepared.judgmentNote,
        opportunityStatement: null,
        nextReviewDate: null,
        watchFocus: null,
        waitingReason: null,
        dismissReason: null,
        pendingFieldCodes: prepared.pendingFieldCodes,
        createdBy: input.actorId,
        idempotencyKey: prepared.idempotencyKey,
        payloadHash: prepared.payloadHash,
        createdAt,
      },
    });

    const updated = await tx.marketSignal.updateMany({
      where: {
        id: input.signalId,
        tenantId: input.tenantId,
        version: signal.version,
      },
      data: {
        currentDestination: prepared.nextDestination,
        activeValidationOwnerActorId: null,
        activeValidationDueDate: null,
        activeValidationFocus: null,
        activeValidationWaitingReason: null,
        version: nextSignalVersion,
        updatedBy: input.actorId,
        updatedAt: createdAt,
      },
    });
    if (updated.count !== 1) conflict("MARKET_SIGNAL_VERSION_CONFLICT");
    return { duplicate: false };
  }
}

async function ownedSignal(
  tx: Transaction,
  tenantId: string,
  signalId: string,
): Promise<SignalRow> {
  const row = await tx.marketSignal.findFirst({
    where: { id: signalId, tenantId },
  });
  if (!row) throw new MarketSignalNotFoundError("MARKET_SIGNAL_NOT_FOUND");
  return row;
}

function listAfterWhere(
  destination: MarketSignalRecord["currentDestination"],
  after: Parameters<MarketSignalRepository["list"]>[0]["after"],
): Prisma.MarketSignalWhereInput {
  if (!after) return {};
  if (destination !== "watching") {
    if (after.sort !== "updated") {
      conflict("MARKET_SIGNAL_CURSOR_SORT_CONFLICT");
    }
    return {
      OR: [
        { updatedAt: { lt: after.updatedAt } },
        {
          AND: [
            { updatedAt: after.updatedAt },
            { id: { lt: after.id } },
          ],
        },
      ],
    };
  }
  if (after.sort !== "watching_due") {
    conflict("MARKET_SIGNAL_CURSOR_SORT_CONFLICT");
  }
  if (after.activeValidationDueDate === null) {
    return {
      activeValidationDueDate: null,
      OR: [
        { updatedAt: { lt: after.updatedAt } },
        {
          AND: [
            { updatedAt: after.updatedAt },
            { id: { lt: after.id } },
          ],
        },
      ],
    };
  }
  return {
    OR: [
      { activeValidationDueDate: { gt: after.activeValidationDueDate } },
      { activeValidationDueDate: null },
      {
        AND: [
          { activeValidationDueDate: after.activeValidationDueDate },
          { updatedAt: { lt: after.updatedAt } },
        ],
      },
      {
        AND: [
          { activeValidationDueDate: after.activeValidationDueDate },
          { updatedAt: after.updatedAt },
          { id: { lt: after.id } },
        ],
      },
    ],
  };
}

function mapSignal(row: SignalRow): MarketSignalRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    title: row.title,
    marketCode: row.marketCode,
    channelCode: row.channelCode,
    categoryRef: row.categoryRef,
    observedFactSummary: row.observedFactSummary,
    hypothesis: row.hypothesis,
    currentDestination:
      row.currentDestination as MarketSignalRecord["currentDestination"],
    ownerTeamCode: row.ownerTeamCode,
    activeValidation:
      row.activeValidationOwnerActorId && row.activeValidationDueDate
        ? {
            responsibleActorId: row.activeValidationOwnerActorId,
            nextReviewDate: row.activeValidationDueDate
              .toISOString()
              .slice(0, 10),
            watchFocus: row.activeValidationFocus,
            waitingReason: row.activeValidationWaitingReason,
          }
        : null,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
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

function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function advisoryLock(tx: Transaction, key: string): Promise<void> {
  await tx.$queryRaw`
    SELECT 1 AS "lockAcquired"
    FROM (SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))) AS acquired
  `;
}

function conflict(code: string): never {
  throw new MarketSignalConflictError(code);
}
