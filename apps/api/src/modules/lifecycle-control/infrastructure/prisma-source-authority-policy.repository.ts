import type { CanonicalEventCode, TimeKind } from "@logix/contracts";
import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type { LifecycleDateAuthorityInput } from "../domain/source-authority-decision";
import type { SourceAuthorityPolicyRecord } from "../domain/source-authority-decision";
import type { SourceAuthorityPolicyRepository } from "../domain/source-authority-policy.repository";

@Injectable()
export class PrismaSourceAuthorityPolicyRepository implements SourceAuthorityPolicyRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listEffectiveCandidates(
    input: LifecycleDateAuthorityInput,
  ): Promise<SourceAuthorityPolicyRecord[]> {
    const rows = await this.prisma.sourceAuthorityPolicy.findMany({
      where: {
        eventCode: input.eventCode,
        subjectType: "container",
        effectiveFrom: { lte: input.occurredAt },
        AND: [
          {
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gt: input.occurredAt } },
            ],
          },
          {
            OR: [{ tenantScope: null }, { tenantScope: input.tenantId }],
          },
          {
            OR: [{ timeKind: null }, { timeKind: input.timeKind }],
          },
        ],
      },
      orderBy: [
        { effectiveFrom: "desc" },
        { policyVersion: "desc" },
        { id: "asc" },
      ],
    });
    return rows.map((row) => ({
      ...row,
      eventCode: row.eventCode as CanonicalEventCode,
      subjectType: "container" as const,
      timeKind: row.timeKind as TimeKind | null,
      allowedAuthoritySystems: parseStringArray(
        row.allowedAuthoritySystems,
        "allowedAuthoritySystems",
        { minimum: 1 },
      ),
      allowedSourceTypes: parseStringArray(
        row.allowedSourceTypes,
        "allowedSourceTypes",
        {
          minimum: 1,
          allowed: ["organization", "authority", "system", "person", "device"],
        },
      ),
      requiredEvidenceTypes: parseStringArray(
        row.requiredEvidenceTypes,
        "requiredEvidenceTypes",
      ),
      verificationRequirements: parseStringArray(
        row.verificationRequirements,
        "verificationRequirements",
        { minimum: 1 },
      ),
      conflictAction: row.conflictAction as "accept" | "reject" | "review",
    }));
  }
}

function parseStringArray(
  value: unknown,
  field: string,
  options: { minimum?: number; allowed?: readonly string[] } = {},
): string[] {
  if (
    !Array.isArray(value) ||
    value.length < (options.minimum ?? 0) ||
    value.some(
      (item) =>
        typeof item !== "string" ||
        !item.trim() ||
        (options.allowed !== undefined && !options.allowed.includes(item)),
    ) ||
    new Set(value).size !== value.length
  ) {
    throw new Error(`SOURCE_AUTHORITY_POLICY_CONFIGURATION_INVALID: ${field}`);
  }
  return value as string[];
}
