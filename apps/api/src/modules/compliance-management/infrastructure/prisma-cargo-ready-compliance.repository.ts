import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  CargoReadyDecisionCode,
  NormalizedCargoReadyAssessment,
  NormalizedCargoReadyDecision,
} from "../domain/cargo-ready-compliance";
import {
  CargoReadyComplianceConflictError,
  CargoReadyComplianceNotFoundError,
  type CargoReadyAssessmentRecord,
  type CargoReadyComplianceRepository,
} from "../domain/cargo-ready-compliance.repository";

const assessmentInclude = {
  items: { orderBy: { replenishmentOrderLineId: "asc" as const } },
  ruleSnapshots: {
    include: {
      ruleVersion: {
        include: { rule: { select: { ruleCode: true } } },
      },
    },
    orderBy: [
      { productSkuId: "asc" as const },
      { ruleVersion: { rule: { ruleCode: "asc" as const } } },
    ],
  },
  findings: { orderBy: [{ code: "asc" as const }, { id: "asc" as const }] },
  decisions: {
    where: { supersededAt: null },
    orderBy: { version: "desc" as const },
    take: 1,
  },
} satisfies Prisma.CargoReadyComplianceAssessmentInclude;

type AssessmentWithRelations = Prisma.CargoReadyComplianceAssessmentGetPayload<{
  include: typeof assessmentInclude;
}>;

@Injectable()
export class PrismaCargoReadyComplianceRepository implements CargoReadyComplianceRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async replaceAssessment(
    input: NormalizedCargoReadyAssessment,
  ): Promise<{ record: CargoReadyAssessmentRecord; duplicate: boolean }> {
    const persisted = await this.prisma.$transaction(async (transaction) => {
      await advisoryLock(
        transaction,
        `cargo-ready-assessment:${input.tenantId}:${input.containerRecordId}`,
      );
      const existing =
        await transaction.cargoReadyComplianceAssessment.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: input.tenantId,
              idempotencyKey: input.idempotencyKey,
            },
          },
          select: { id: true, payloadHash: true },
        });
      if (existing) {
        if (existing.payloadHash !== input.payloadHash) {
          throw new CargoReadyComplianceConflictError(
            "CARGO_READY_ASSESSMENT_IDEMPOTENCY_CONFLICT",
          );
        }
        return { assessmentId: existing.id, duplicate: true };
      }

      const current =
        await transaction.cargoReadyComplianceAssessment.findFirst({
          where: {
            tenantId: input.tenantId,
            containerRecordId: input.containerRecordId,
            state: { not: "superseded" },
          },
          orderBy: { version: "desc" },
          select: { id: true, version: true },
        });
      const currentVersion = current?.version ?? 0;
      if (currentVersion !== input.expectedAssessmentVersion) {
        throw new CargoReadyComplianceConflictError(
          "CARGO_READY_ASSESSMENT_VERSION_CONFLICT",
        );
      }
      const now = new Date();
      if (current) {
        await transaction.cargoReadyComplianceAssessment.update({
          where: { id: current.id },
          data: { state: "superseded", supersededAt: now },
        });
      }

      const assessmentId = randomUUID();
      await transaction.cargoReadyComplianceAssessment.create({
        data: {
          id: assessmentId,
          tenantId: input.tenantId,
          containerRecordId: input.containerRecordId,
          version: currentVersion + 1,
          state: input.state,
          jurisdictionCountryCode: input.jurisdictionCountryCode,
          assessmentDate: new Date(`${input.assessmentDate}T00:00:00.000Z`),
          allocationSetId: input.allocationSetId,
          allocationSetVersion: input.allocationSetVersion,
          supersedesAssessmentId: current?.id ?? null,
          evidenceRefs: input.evidenceRefs,
          actorId: input.actorId,
          reasonCode: input.reasonCode,
          idempotencyKey: input.idempotencyKey,
          payloadHash: input.payloadHash,
        },
      });
      if (input.items.length > 0) {
        const items = input.items.map((item) => {
          const id = randomUUID();
          return {
            id,
            tenantId: input.tenantId,
            assessmentId,
            ...item,
          };
        });
        await transaction.cargoReadyComplianceAssessmentItem.createMany({
          data: items,
        });
      }
      if (input.ruleSnapshots.length > 0) {
        await transaction.cargoReadyComplianceAssessmentRule.createMany({
          data: input.ruleSnapshots.map((snapshot) => ({
            id: randomUUID(),
            tenantId: input.tenantId,
            assessmentId,
            ruleVersionId: snapshot.ruleVersionId,
            productSkuId: snapshot.productSkuId,
          })),
        });
      }
      if (input.findings.length > 0) {
        await transaction.cargoReadyComplianceFinding.createMany({
          data: input.findings.map((finding) => ({
            id: randomUUID(),
            tenantId: input.tenantId,
            assessmentId,
            code: finding.code,
            productSkuId: finding.productSkuId,
            ruleVersionId: finding.ruleVersionId,
            detail: finding.detail,
            state: "open",
          })),
        });
      }
      return { assessmentId, duplicate: false };
    });
    const saved = await this.findById(persisted.assessmentId);
    return { record: saved, duplicate: persisted.duplicate };
  }

  async decide(
    input: NormalizedCargoReadyDecision,
  ): Promise<{ record: CargoReadyAssessmentRecord; duplicate: boolean }> {
    const persisted = await this.prisma.$transaction(async (transaction) => {
      await advisoryLock(
        transaction,
        `cargo-ready-decision:${input.tenantId}:${input.assessmentId}`,
      );
      const assessment =
        await transaction.cargoReadyComplianceAssessment.findUnique({
          where: {
            id_tenantId: { id: input.assessmentId, tenantId: input.tenantId },
          },
          select: { id: true, state: true, containerRecordId: true },
        });
      if (!assessment || assessment.state === "superseded") {
        throw new CargoReadyComplianceNotFoundError(
          "CARGO_READY_ASSESSMENT_NOT_FOUND",
        );
      }
      if (assessment.containerRecordId !== input.containerRecordId) {
        throw new CargoReadyComplianceConflictError(
          "CARGO_READY_ASSESSMENT_SCOPE_MISMATCH",
        );
      }
      const existing =
        await transaction.cargoReadyComplianceDecision.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: input.tenantId,
              idempotencyKey: input.idempotencyKey,
            },
          },
          select: { assessmentId: true, payloadHash: true },
        });
      if (existing) {
        if (
          existing.assessmentId !== input.assessmentId ||
          existing.payloadHash !== input.payloadHash
        ) {
          throw new CargoReadyComplianceConflictError(
            "CARGO_READY_DECISION_IDEMPOTENCY_CONFLICT",
          );
        }
        return { duplicate: true };
      }
      const current = await transaction.cargoReadyComplianceDecision.findFirst({
        where: { assessmentId: input.assessmentId, supersededAt: null },
        select: { id: true, version: true },
      });
      const currentVersion = current?.version ?? 0;
      if (currentVersion !== input.expectedDecisionVersion) {
        throw new CargoReadyComplianceConflictError(
          "CARGO_READY_DECISION_VERSION_CONFLICT",
        );
      }
      if (
        ["approved", "approved_with_conditions"].includes(input.decisionCode) &&
        assessment.state === "action_required"
      ) {
        throw new CargoReadyComplianceConflictError(
          "CARGO_READY_FINDINGS_UNRESOLVED",
        );
      }
      const now = new Date();
      if (current) {
        await transaction.cargoReadyComplianceDecision.update({
          where: { id: current.id },
          data: { supersededAt: now },
        });
      }
      await transaction.cargoReadyComplianceDecision.create({
        data: {
          id: randomUUID(),
          tenantId: input.tenantId,
          assessmentId: input.assessmentId,
          version: currentVersion + 1,
          decisionCode: input.decisionCode,
          conditionRefs: input.conditionRefs,
          supersedesDecisionId: current?.id ?? null,
          evidenceRefs: input.evidenceRefs,
          actorId: input.actorId,
          reasonCode: input.reasonCode,
          idempotencyKey: input.idempotencyKey,
          payloadHash: input.payloadHash,
          decidedAt: now,
        },
      });
      await transaction.cargoReadyComplianceAssessment.update({
        where: { id: input.assessmentId },
        data: { state: "decided" },
      });
      return { duplicate: false };
    });
    return {
      record: await this.findById(input.assessmentId),
      duplicate: persisted.duplicate,
    };
  }

  async findCurrent(input: {
    tenantId: string;
    containerRecordId: string;
  }): Promise<CargoReadyAssessmentRecord | null> {
    const record = await this.prisma.cargoReadyComplianceAssessment.findFirst({
      where: {
        tenantId: input.tenantId,
        containerRecordId: input.containerRecordId,
        state: { not: "superseded" },
      },
      orderBy: { version: "desc" },
      include: assessmentInclude,
    });
    return record ? toRecord(record) : null;
  }

  private async findById(id: string): Promise<CargoReadyAssessmentRecord> {
    const record =
      await this.prisma.cargoReadyComplianceAssessment.findUniqueOrThrow({
        where: { id },
        include: assessmentInclude,
      });
    return toRecord(record);
  }
}

function toRecord(input: AssessmentWithRelations): CargoReadyAssessmentRecord {
  const decision = input.decisions[0] ?? null;
  return {
    assessmentId: input.id,
    tenantId: input.tenantId,
    containerRecordId: input.containerRecordId,
    version: input.version,
    state: input.state as CargoReadyAssessmentRecord["state"],
    jurisdictionCountryCode: input.jurisdictionCountryCode,
    assessmentDate: input.assessmentDate.toISOString().slice(0, 10),
    allocationSetId: input.allocationSetId,
    allocationSetVersion: input.allocationSetVersion,
    items: input.items.map((item) => ({
      replenishmentOrderLineId: item.replenishmentOrderLineId,
      productSkuId: item.productSkuId,
      productNumber: item.productNumber,
      complianceProfileId: item.complianceProfileId,
      complianceProfileVersion: item.complianceProfileVersion,
    })),
    ruleSnapshots: input.ruleSnapshots.map((snapshot) => ({
      ruleVersionId: snapshot.ruleVersion.id,
      ruleCode: snapshot.ruleVersion.rule.ruleCode,
      version: snapshot.ruleVersion.version,
      productSkuId: snapshot.productSkuId,
      requirementLayer: snapshot.ruleVersion.requirementLayer,
      requiredCertificateTypes: jsonStrings(
        snapshot.ruleVersion.requiredCertificateTypes,
      ),
      blockingNodeCodes: jsonStrings(snapshot.ruleVersion.blockingNodeCodes),
      severity: snapshot.ruleVersion.severity,
      officialSourceUrl: snapshot.ruleVersion.officialSourceUrl,
      legalCitation: snapshot.ruleVersion.legalCitation,
    })),
    findings: input.findings.map((finding) => ({
      code: finding.code as CargoReadyAssessmentRecord["findings"][number]["code"],
      productSkuId: finding.productSkuId,
      ruleVersionId: finding.ruleVersionId,
      detail: finding.detail,
    })),
    evidenceRefs: jsonStrings(input.evidenceRefs),
    actorId: input.actorId,
    reasonCode: input.reasonCode,
    currentDecision: decision
      ? {
          decisionId: decision.id,
          version: decision.version,
          decisionCode: decision.decisionCode as CargoReadyDecisionCode,
          conditionRefs: jsonStrings(decision.conditionRefs),
          evidenceRefs: jsonStrings(decision.evidenceRefs),
          actorId: decision.actorId,
          reasonCode: decision.reasonCode,
          decidedAt: decision.decidedAt.toISOString(),
        }
      : null,
    createdAt: input.createdAt.toISOString(),
  };
}

function jsonStrings(value: Prisma.JsonValue): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

async function advisoryLock(
  transaction: Prisma.TransactionClient,
  key: string,
): Promise<void> {
  await transaction.$queryRaw`
    SELECT 1 AS "lockAcquired"
    FROM (SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))) AS acquired
  `;
}
