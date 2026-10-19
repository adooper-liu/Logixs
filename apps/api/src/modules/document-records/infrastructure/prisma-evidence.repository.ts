import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  AppendDecisionInput,
  AppendDecisionResult,
  CreateEvidenceInput,
  EvidenceRecord,
  EvidenceRepository,
  EvidenceSourceSnapshot,
  TaskCollaborationEvidenceQuery,
} from "../domain/evidence.repository";
import {
  EvidenceDecisionNotFoundError,
  EvidenceDecisionScopeDeniedError,
  EvidenceDecisionTransitionError,
} from "../domain/evidence.repository";
import { decideVerificationTransition } from "../domain/verification-decision";
import {
  MANUAL_VERIFY_CHECKS,
  MANUAL_VERIFY_POLICY_ID,
  MANUAL_VERIFY_POLICY_VERSION,
} from "../domain/verification-policy";

@Injectable()
export class PrismaEvidenceRepository implements EvidenceRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<EvidenceRecord | null> {
    const row = await this.prisma.evidenceRecord.findUnique({ where: { id } });
    return row ? mapRecord(row) : null;
  }

  async findByIds(ids: string[]): Promise<EvidenceRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.evidenceRecord.findMany({
      where: { id: { in: ids } },
    });
    return rows.map(mapRecord);
  }

  async findTaskCollaborationEvidence(
    input: TaskCollaborationEvidenceQuery,
  ): Promise<EvidenceRecord[]> {
    if (input.evidenceRecordIds.length === 0) return [];
    const rows = await this.prisma.evidenceRecord.findMany({
      where: {
        tenantId: input.tenantId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        validity: input.validity,
        id: { in: input.evidenceRecordIds },
      },
    });
    return rows.map(mapRecord);
  }

  async listBySubjects(input: {
    tenantId: string;
    subjectType: string;
    subjectIds: string[];
  }): Promise<EvidenceRecord[]> {
    if (input.subjectIds.length === 0) return [];
    const rows = await this.prisma.evidenceRecord.findMany({
      where: {
        tenantId: input.tenantId,
        subjectType: input.subjectType,
        subjectId: { in: input.subjectIds },
        validity: "effective",
      },
      orderBy: [{ recordedAt: "asc" }, { id: "asc" }],
    });
    return rows.map(mapRecord);
  }

  async findByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<EvidenceRecord | null> {
    const row = await this.prisma.evidenceRecord.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
    });
    return row ? mapRecord(row) : null;
  }

  async create(input: CreateEvidenceInput): Promise<EvidenceRecord> {
    const row = await this.prisma.evidenceRecord.create({
      data: {
        tenantId: input.tenantId,
        idempotencyKey: input.idempotencyKey,
        evidenceType: input.evidenceType,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        authorityLevel: input.authorityLevel,
        contentRef: input.contentRef,
        contentHash: input.contentHash,
        source: { ...input.source },
        verificationState: "pending",
        confidenceState: "unknown",
        validity: "effective",
        receivedAt: input.receivedAt,
        recordedAt: input.recordedAt,
      },
    });
    return mapRecord(row);
  }

  async findLatestVerifiedDecisionId(
    evidenceId: string,
  ): Promise<string | null> {
    const latest = await this.prisma.evidenceVerificationDecision.findFirst({
      where: { evidenceId, decision: "verified" },
      orderBy: { verificationSequence: "desc" },
    });
    return latest?.id ?? null;
  }

  async appendDecision(
    input: AppendDecisionInput,
  ): Promise<AppendDecisionResult> {
    return this.prisma.$transaction(async (tx) => {
      const records = await tx.$queryRaw<LockedEvidenceRecord[]>`
        SELECT
          "id",
          "tenant_id" AS "tenantId",
          "idempotency_key" AS "idempotencyKey",
          "evidence_type" AS "evidenceType",
          "subject_type" AS "subjectType",
          "subject_id" AS "subjectId",
          "authority_level" AS "authorityLevel",
          "content_ref" AS "contentRef",
          "content_hash" AS "contentHash",
          "source",
          "verification_state" AS "verificationState",
          "confidence_state" AS "confidenceState",
          "validity",
          "received_at" AS "receivedAt",
          "recorded_at" AS "recordedAt"
        FROM "evidence_record"
        WHERE "id" = ${input.evidenceId}
        FOR UPDATE
      `;
      const record = records[0];
      if (!record) throw new EvidenceDecisionNotFoundError();
      if (record.tenantId !== input.tenantId) {
        throw new EvidenceDecisionScopeDeniedError();
      }
      const latest = await tx.evidenceVerificationDecision.findFirst({
        where: { evidenceId: input.evidenceId },
        orderBy: { verificationSequence: "desc" },
      });
      const latestVerified =
        input.decision === "revoked"
          ? await tx.evidenceVerificationDecision.findFirst({
              where: { evidenceId: input.evidenceId, decision: "verified" },
              orderBy: { verificationSequence: "desc" },
            })
          : null;
      const transition = decideVerificationTransition({
        currentState: record.verificationState,
        currentValidity: record.validity,
        decision: input.decision,
        latestVerifiedDecisionId: latestVerified?.id ?? null,
      });
      if (transition.kind === "already_done") {
        return {
          record: mapRecord(record),
          decisionId: null,
          appended: false,
        };
      }
      if (transition.kind === "reject") {
        throw new EvidenceDecisionTransitionError(
          transition.code,
          transition.message,
        );
      }
      const created = await tx.evidenceVerificationDecision.create({
        data: {
          evidenceId: input.evidenceId,
          verificationSequence: (latest?.verificationSequence ?? 0) + 1,
          decision: input.decision,
          checks: [...MANUAL_VERIFY_CHECKS],
          policyId: MANUAL_VERIFY_POLICY_ID,
          policyVersion: MANUAL_VERIFY_POLICY_VERSION,
          decidedAt: new Date(),
          actorOrServiceId: input.actorOrServiceId,
          reasonCode: input.reasonCode,
          reason: input.reason,
          previousDecisionId:
            input.decision === "revoked"
              ? (latestVerified?.id ?? null)
              : (latest?.id ?? null),
        },
      });
      const row = await tx.evidenceRecord.update({
        where: { id: input.evidenceId },
        data: {
          verificationState: transition.nextState,
          validity: transition.nextValidity,
        },
      });
      return {
        record: mapRecord(row),
        decisionId: created.id,
        appended: true,
      };
    });
  }
}

interface LockedEvidenceRecord {
  id: string;
  tenantId: string;
  idempotencyKey: string;
  evidenceType: string;
  subjectType: string;
  subjectId: string;
  authorityLevel: string;
  contentRef: string;
  contentHash: string;
  source: unknown;
  verificationState: string;
  confidenceState: string;
  validity: string;
  receivedAt: Date;
  recordedAt: Date;
}

function mapRecord(row: {
  id: string;
  tenantId: string;
  idempotencyKey: string;
  evidenceType: string;
  subjectType: string;
  subjectId: string;
  authorityLevel: string;
  contentRef: string;
  contentHash: string;
  source: unknown;
  verificationState: string;
  confidenceState: string;
  validity: string;
  receivedAt: Date;
  recordedAt: Date;
}): EvidenceRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    idempotencyKey: row.idempotencyKey,
    evidenceType: row.evidenceType,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    authorityLevel: row.authorityLevel,
    contentRef: row.contentRef,
    contentHash: row.contentHash,
    source: row.source as EvidenceSourceSnapshot,
    verificationState: row.verificationState,
    confidenceState: row.confidenceState,
    validity: row.validity,
    receivedAt: row.receivedAt,
    recordedAt: row.recordedAt,
  };
}
