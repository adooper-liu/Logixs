import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type {
  CanonicalEventCode,
  LifecycleDateFactCommand,
  LifecycleNodeCode,
} from "@logix/contracts";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  AppendLifecycleDateFactInput,
  AppendLifecycleDateFactResult,
  LifecycleDateApplicationState,
  LifecycleDateFactRecord,
} from "../domain/lifecycle-date-fact";
import type { LifecycleDateFactRepository } from "../domain/lifecycle-date-fact.repository";

@Injectable()
export class PrismaLifecycleDateFactRepository implements LifecycleDateFactRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findById(factId: string): Promise<LifecycleDateFactRecord | null> {
    const row = await this.prisma.lifecycleDateFact.findUnique({
      where: { id: factId },
    });
    return row ? toRecord(row) : null;
  }

  async append(
    input: AppendLifecycleDateFactInput,
  ): Promise<AppendLifecycleDateFactResult> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const completeInbox = async (): Promise<void> => {
          if (!input.completeInbox) return;
          const completed = await transaction.inboxMessage.updateMany({
            where: {
              id: input.completeInbox.id,
              state: "processing",
              leaseOwner: input.completeInbox.owner,
            },
            data: {
              state: "processed",
              processedAt: input.completeInbox.processedAt,
              leaseOwner: null,
              leaseLockedAt: null,
              leaseExpiresAt: null,
              nextAttemptAt: null,
            },
          });
          if (completed.count !== 1) throw new Error("INBOX_LEASE_LOST");
        };
        const locked = await transaction.$queryRaw<{ id: string }[]>`
          SELECT "id"
          FROM "container_record"
          WHERE "id" = ${input.containerId}
            AND "tenant_id" = ${input.tenantId}
          FOR UPDATE
        `;
        if (locked.length !== 1) {
          throw new HttpException("RESOURCE_NOT_FOUND", HttpStatus.NOT_FOUND);
        }

        const duplicate = await transaction.lifecycleDateFact.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: input.tenantId,
              idempotencyKey: input.idempotencyKey,
            },
          },
        });
        if (duplicate) {
          const result = duplicateResult(duplicate, input.payloadHash);
          await completeInbox();
          return result;
        }

        const aggregate = await transaction.lifecycleDateFact.aggregate({
          where: { containerId: input.containerId },
          _max: { projectionVersion: true },
        });
        const currentVersion = aggregate._max.projectionVersion ?? 0;
        if (
          input.expectedVersion !== undefined &&
          input.expectedVersion !== currentVersion
        ) {
          throw new HttpException(
            "OPTIMISTIC_LOCK_CONFLICT: 日期投影版本已变化",
            HttpStatus.CONFLICT,
          );
        }

        const current = await transaction.lifecycleDateFact.findFirst({
          where: {
            containerId: input.containerId,
            nodeCode: input.nodeCode,
            eventCode: input.eventCode,
            timeKind: input.timeKind,
            isCurrent: true,
          },
          orderBy: [{ projectionVersion: "desc" }, { id: "desc" }],
        });
        const supersedesFactId = correctionTarget(input, current);
        if (current) {
          await transaction.lifecycleDateFact.update({
            where: { id: current.id },
            data: { isCurrent: false },
          });
        }

        const created = await transaction.lifecycleDateFact.create({
          data: {
            id: input.id,
            tenantId: input.tenantId,
            containerId: input.containerId,
            nodeCode: input.nodeCode,
            eventCode: input.eventCode,
            timeKind: input.timeKind,
            occurredAt: input.occurredAt,
            rawValue: input.rawValue,
            sourceUtcOffset: input.sourceUtcOffset,
            ingestionChannel: input.ingestionChannel,
            captureSource: input.captureSource,
            sourceSystem: input.sourceSystem,
            authoritySystem: input.authoritySystem,
            provider: input.provider,
            interfaceCode: input.interfaceCode,
            sourceEventId: input.sourceEventId,
            mappingVersion: input.mappingVersion,
            verificationState: input.verificationState,
            confidenceState: input.confidenceState,
            validity: input.validity,
            authorityPolicyRef: input.authorityPolicyRef,
            evidenceRefs: input.evidenceRefs,
            actorId: input.actorId,
            reasonCode: input.reasonCode,
            idempotencyKey: input.idempotencyKey,
            payloadHash: input.payloadHash,
            supersedesFactId,
            isCurrent: true,
            applicationState: input.applicationState,
            applicationReasonCode: input.applicationReasonCode,
            canonicalEventId: input.canonicalEventId,
            projectionVersion: currentVersion + 1,
            traceId: input.traceId,
            receivedAt: input.receivedAt,
          },
        });
        await completeInbox();
        return { record: toRecord(created), duplicate: false };
      });
    } catch (error) {
      if (prismaErrorCode(error) !== "P2002") throw error;
      return this.prisma.$transaction(async (transaction) => {
        const raced = await transaction.lifecycleDateFact.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: input.tenantId,
              idempotencyKey: input.idempotencyKey,
            },
          },
        });
        if (!raced) throw error;
        const result = duplicateResult(raced, input.payloadHash);
        if (input.completeInbox) {
          const completed = await transaction.inboxMessage.updateMany({
            where: {
              id: input.completeInbox.id,
              state: "processing",
              leaseOwner: input.completeInbox.owner,
            },
            data: {
              state: "processed",
              processedAt: input.completeInbox.processedAt,
              leaseOwner: null,
              leaseLockedAt: null,
              leaseExpiresAt: null,
              nextAttemptAt: null,
            },
          });
          if (completed.count !== 1) throw new Error("INBOX_LEASE_LOST");
        }
        return result;
      });
    }
  }

  async updateApplication(input: {
    factId: string;
    state: LifecycleDateApplicationState;
    reasonCode: string | null;
    canonicalEventId: string | null;
  }): Promise<LifecycleDateFactRecord> {
    const row = await this.prisma.lifecycleDateFact.update({
      where: { id: input.factId },
      data: {
        applicationState: input.state,
        applicationReasonCode: input.reasonCode,
        canonicalEventId: input.canonicalEventId,
        applicationLeaseOwner: null,
        applicationLeaseUntil: null,
      },
    });
    return toRecord(row);
  }

  async listCurrent(input: {
    tenantId: string;
    containerId: string;
  }): Promise<LifecycleDateFactRecord[]> {
    const rows = await this.prisma.lifecycleDateFact.findMany({
      where: {
        tenantId: input.tenantId,
        containerId: input.containerId,
        isCurrent: true,
      },
      orderBy: [{ projectionVersion: "asc" }, { id: "asc" }],
      take: 100,
    });
    return rows.map(toRecord);
  }

  async claimPendingApplications(input: {
    tenantId: string;
    containerId: string;
    owner: string;
    now: Date;
    leaseUntil: Date;
    limit: number;
  }): Promise<LifecycleDateFactRecord[]> {
    return this.prisma.$transaction(async (transaction) => {
      const candidates = await transaction.$queryRaw<{ id: string }[]>`
        SELECT "id"
        FROM "lifecycle_date_fact"
        WHERE "tenant_id" = ${input.tenantId}
          AND "container_id" = ${input.containerId}
          AND "is_current" = true
          AND "time_kind" = 'actual'
          AND "application_state" = 'pending_application'
          AND (
            "application_lease_until" IS NULL
            OR "application_lease_until" <= ${input.now}
          )
        ORDER BY "occurred_at" ASC, "projection_version" ASC, "id" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${input.limit}
      `;
      const ids = candidates.map((candidate) => candidate.id);
      if (ids.length === 0) return [];
      await transaction.lifecycleDateFact.updateMany({
        where: {
          id: { in: ids },
          applicationState: "pending_application",
        },
        data: {
          applicationLeaseOwner: input.owner,
          applicationLeaseUntil: input.leaseUntil,
          applicationAttempts: { increment: 1 },
          lastApplicationAt: input.now,
        },
      });
      const rows = await transaction.lifecycleDateFact.findMany({
        where: { id: { in: ids }, applicationLeaseOwner: input.owner },
        orderBy: [
          { occurredAt: "asc" },
          { projectionVersion: "asc" },
          { id: "asc" },
        ],
      });
      return rows.map(toRecord);
    });
  }

  async finishClaimedApplication(input: {
    factId: string;
    owner: string;
    state: Extract<
      LifecycleDateApplicationState,
      "pending_application" | "applied" | "rejected"
    >;
    reasonCode: string | null;
    canonicalEventId: string | null;
  }): Promise<LifecycleDateFactRecord> {
    const updated = await this.prisma.lifecycleDateFact.updateMany({
      where: {
        id: input.factId,
        applicationState: "pending_application",
        applicationLeaseOwner: input.owner,
      },
      data: {
        applicationState: input.state,
        applicationReasonCode: input.reasonCode,
        canonicalEventId: input.canonicalEventId,
        applicationLeaseOwner: null,
        applicationLeaseUntil: null,
      },
    });
    if (updated.count !== 1) throw new Error("APPLICATION_LEASE_LOST");
    const row = await this.prisma.lifecycleDateFact.findUniqueOrThrow({
      where: { id: input.factId },
    });
    return toRecord(row);
  }
}

function correctionTarget(
  input: AppendLifecycleDateFactInput,
  current: { id: string } | null,
): string | null {
  if (!current) {
    if (input.supersedesFactId) {
      throw new HttpException(
        "BUSINESS_PRECONDITION_FAILED: 更正目标不是当前日期事实",
        HttpStatus.CONFLICT,
      );
    }
    return null;
  }
  if (input.timeKind === "actual" && !input.supersedesFactId) {
    throw new HttpException(
      "BUSINESS_PRECONDITION_FAILED: 实际日期更正必须引用当前事实",
      HttpStatus.CONFLICT,
    );
  }
  if (input.supersedesFactId && input.supersedesFactId !== current.id) {
    throw new HttpException(
      "OPTIMISTIC_LOCK_CONFLICT: 更正目标已不是当前事实",
      HttpStatus.CONFLICT,
    );
  }
  return current.id;
}

function duplicateResult(
  row: Parameters<typeof toRecord>[0],
  payloadHash: string,
): AppendLifecycleDateFactResult {
  if (row.payloadHash !== payloadHash) {
    throw new HttpException(
      "IDEMPOTENCY_CONFLICT: 同键异载荷",
      HttpStatus.CONFLICT,
    );
  }
  return { record: toRecord(row), duplicate: true };
}

function prismaErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

function toRecord(row: {
  id: string;
  tenantId: string;
  containerId: string;
  nodeCode: string;
  eventCode: string;
  timeKind: string;
  occurredAt: Date;
  rawValue: string;
  sourceUtcOffset: string;
  ingestionChannel: string;
  captureSource: string;
  sourceSystem: string;
  authoritySystem: string;
  provider: string | null;
  interfaceCode: string | null;
  sourceEventId: string | null;
  mappingVersion: string | null;
  verificationState: string;
  confidenceState: string;
  validity: string;
  authorityPolicyRef: string | null;
  evidenceRefs: unknown;
  actorId: string | null;
  reasonCode: string | null;
  idempotencyKey: string;
  payloadHash: string;
  supersedesFactId: string | null;
  isCurrent: boolean;
  applicationState: string;
  applicationReasonCode: string | null;
  canonicalEventId: string | null;
  projectionVersion: number;
  traceId: string;
  receivedAt: Date;
  recordedAt: Date;
}): LifecycleDateFactRecord {
  return {
    ...row,
    nodeCode: row.nodeCode as LifecycleNodeCode,
    eventCode: row.eventCode as CanonicalEventCode,
    timeKind: row.timeKind as LifecycleDateFactCommand["timeKind"],
    ingestionChannel:
      row.ingestionChannel as LifecycleDateFactCommand["ingestionChannel"],
    captureSource:
      row.captureSource as LifecycleDateFactCommand["captureSource"],
    verificationState:
      row.verificationState as LifecycleDateFactCommand["verificationState"],
    confidenceState:
      row.confidenceState as LifecycleDateFactCommand["confidenceState"],
    validity: row.validity as LifecycleDateFactCommand["validity"],
    evidenceRefs: Array.isArray(row.evidenceRefs)
      ? row.evidenceRefs.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
    applicationState: row.applicationState as LifecycleDateApplicationState,
  };
}
