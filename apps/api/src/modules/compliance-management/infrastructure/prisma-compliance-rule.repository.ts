import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  ComplianceRequirementLayer,
  ComplianceRuleSeverity,
  DangerousGoodsRequirement,
  NormalizedComplianceRuleVersion,
  PresenceRequirement,
  PublishedComplianceRuleVersionRecord,
} from "../domain/compliance-rule";
import {
  ComplianceRuleConflictError,
  type ComplianceRuleRepository,
} from "../domain/compliance-rule.repository";

const ruleVersionInclude = {
  rule: { select: { ruleCode: true } },
  skuScopes: { orderBy: { productSkuId: "asc" as const } },
} satisfies Prisma.ComplianceRuleVersionInclude;

type RuleVersionWithRelations = Prisma.ComplianceRuleVersionGetPayload<{
  include: typeof ruleVersionInclude;
}>;

@Injectable()
export class PrismaComplianceRuleRepository implements ComplianceRuleRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async publish(input: NormalizedComplianceRuleVersion): Promise<{
    record: PublishedComplianceRuleVersionRecord;
    duplicate: boolean;
  }> {
    const persisted = await this.prisma.$transaction(async (transaction) => {
      await advisoryLock(
        transaction,
        `compliance-rule:${input.tenantId}:${input.ruleCode}`,
      );
      const existing = await transaction.complianceRuleVersion.findUnique({
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
          throw new ComplianceRuleConflictError(
            "COMPLIANCE_RULE_IDEMPOTENCY_CONFLICT",
          );
        }
        return { ruleVersionId: existing.id, duplicate: true };
      }

      let rule = await transaction.complianceRule.findUnique({
        where: {
          tenantId_ruleCode: {
            tenantId: input.tenantId,
            ruleCode: input.ruleCode,
          },
        },
        select: { id: true },
      });
      if (!rule) {
        rule = await transaction.complianceRule.create({
          data: {
            id: randomUUID(),
            tenantId: input.tenantId,
            ruleCode: input.ruleCode,
          },
          select: { id: true },
        });
      }

      const current = await transaction.complianceRuleVersion.findFirst({
        where: {
          tenantId: input.tenantId,
          ruleId: rule.id,
          state: "published",
        },
        select: { id: true, version: true },
      });
      const currentVersion = current?.version ?? 0;
      if (currentVersion !== input.expectedVersion) {
        throw new ComplianceRuleConflictError(
          "COMPLIANCE_RULE_VERSION_CONFLICT",
        );
      }
      const now = new Date();
      if (current) {
        await transaction.complianceRuleVersion.update({
          where: { id: current.id },
          data: { state: "retired", retiredAt: now },
        });
      }

      const ruleVersionId = randomUUID();
      await transaction.complianceRuleVersion.create({
        data: {
          id: ruleVersionId,
          tenantId: input.tenantId,
          ruleId: rule.id,
          version: currentVersion + 1,
          state: "published",
          requirementLayer: input.requirementLayer,
          jurisdictionCountryCode: input.jurisdictionCountryCode,
          effectiveFrom: new Date(`${input.effectiveFrom}T00:00:00.000Z`),
          effectiveTo: input.effectiveTo
            ? new Date(`${input.effectiveTo}T00:00:00.000Z`)
            : null,
          appliesToAllSkus: input.appliesToAllSkus,
          batteryRequirement: input.batteryRequirement,
          refrigerantRequirement: input.refrigerantRequirement,
          dangerousGoodsRequirement: input.dangerousGoodsRequirement,
          requiredCertificateTypes: input.requiredCertificateTypes,
          blockingNodeCodes: input.blockingNodeCodes,
          severity: input.severity,
          officialSourceUrl: input.officialSourceUrl,
          legalCitation: input.legalCitation,
          owner: input.owner,
          approvedBy: input.approvedBy,
          approvedAt: now,
          supersedesRuleVersionId: current?.id ?? null,
          evidenceRefs: input.evidenceRefs,
          reasonCode: input.reasonCode,
          idempotencyKey: input.idempotencyKey,
          payloadHash: input.payloadHash,
          createdAt: now,
        },
      });
      if (input.productSkuIds.length > 0) {
        await transaction.complianceRuleVersionSkuScope.createMany({
          data: input.productSkuIds.map((productSkuId) => ({
            id: randomUUID(),
            tenantId: input.tenantId,
            ruleVersionId,
            productSkuId,
          })),
        });
      }
      return { ruleVersionId, duplicate: false };
    });

    const saved = await this.prisma.complianceRuleVersion.findUniqueOrThrow({
      where: { id: persisted.ruleVersionId },
      include: ruleVersionInclude,
    });
    return { record: toRecord(saved), duplicate: persisted.duplicate };
  }

  async findPublishedForAssessment(input: {
    tenantId: string;
    jurisdictionCountryCode: string;
    assessmentDate: string;
  }): Promise<PublishedComplianceRuleVersionRecord[]> {
    const assessmentDate = new Date(`${input.assessmentDate}T00:00:00.000Z`);
    const rules = await this.prisma.complianceRuleVersion.findMany({
      where: {
        tenantId: input.tenantId,
        state: "published",
        jurisdictionCountryCode: input.jurisdictionCountryCode,
        effectiveFrom: { lte: assessmentDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: assessmentDate } }],
      },
      include: ruleVersionInclude,
      orderBy: [{ rule: { ruleCode: "asc" } }, { version: "asc" }],
    });
    return rules.map(toRecord);
  }
}

function toRecord(
  input: RuleVersionWithRelations,
): PublishedComplianceRuleVersionRecord {
  return {
    ruleVersionId: input.id,
    ruleCode: input.rule.ruleCode,
    version: input.version,
    requirementLayer: input.requirementLayer as ComplianceRequirementLayer,
    jurisdictionCountryCode: input.jurisdictionCountryCode,
    effectiveFrom: input.effectiveFrom.toISOString().slice(0, 10),
    effectiveTo: input.effectiveTo?.toISOString().slice(0, 10) ?? null,
    appliesToAllSkus: input.appliesToAllSkus,
    productSkuIds: input.skuScopes.map((scope) => scope.productSkuId),
    batteryRequirement: input.batteryRequirement as PresenceRequirement,
    refrigerantRequirement: input.refrigerantRequirement as PresenceRequirement,
    dangerousGoodsRequirement:
      input.dangerousGoodsRequirement as DangerousGoodsRequirement,
    requiredCertificateTypes: jsonStrings(input.requiredCertificateTypes),
    blockingNodeCodes: jsonStrings(input.blockingNodeCodes),
    severity: input.severity as ComplianceRuleSeverity,
    officialSourceUrl: input.officialSourceUrl,
    legalCitation: input.legalCitation,
    owner: input.owner,
    approvedBy: input.approvedBy,
    approvedAt: input.approvedAt.toISOString(),
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
