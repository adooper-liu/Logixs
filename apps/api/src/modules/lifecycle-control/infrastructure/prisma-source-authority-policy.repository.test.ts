import { describe, expect, it, vi } from "vitest";
import { PrismaSourceAuthorityPolicyRepository } from "./prisma-source-authority-policy.repository";

describe("PrismaSourceAuthorityPolicyRepository", () => {
  it("只查询业务发生时刻有效且租户/时间种类匹配的事件策略", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "row-1",
        policyId: "11111111-1111-4111-8111-111111111111",
        policyVersion: 2,
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
        effectiveTo: null,
        tenantScope: null,
        factType: null,
        eventCode: "departed",
        fieldCode: null,
        subjectType: "container",
        jurisdiction: null,
        direction: null,
        locationRole: null,
        transportMode: null,
        timeKind: "actual",
        allowedAuthoritySystems: ["carrier-a"],
        allowedSourceTypes: ["system"],
        minimumAuthorityLevel: "authoritative",
        requiredEvidenceTypes: ["api_response"],
        verificationRequirements: ["subject_match"],
        corroborationRule: null,
        conflictAction: "review",
        manualCorrectionPolicyRef: "manual-v1",
        sealingPolicyRef: "seal-v1",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const repository = new PrismaSourceAuthorityPolicyRepository({
      sourceAuthorityPolicy: { findMany },
    } as never);
    const occurredAt = new Date("2026-09-18T00:00:00Z");

    const result = await repository.listEffectiveCandidates({
      tenantId: "22222222-2222-4222-8222-222222222222",
      eventCode: "departed",
      timeKind: "actual",
      occurredAt,
      captureSource: "external_evidence",
      authoritySystem: "carrier-a",
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventCode: "departed",
          subjectType: "container",
          effectiveFrom: { lte: occurredAt },
        }),
      }),
    );
    expect(result[0]).toMatchObject({
      policyVersion: 2,
      allowedAuthoritySystems: ["carrier-a"],
      allowedSourceTypes: ["system"],
    });
  });

  it("非法策略数组显式报配置错误", async () => {
    const repository = new PrismaSourceAuthorityPolicyRepository({
      sourceAuthorityPolicy: {
        findMany: vi.fn().mockResolvedValue([
          {
            eventCode: "departed",
            subjectType: "container",
            timeKind: "actual",
            allowedAuthoritySystems: [],
            allowedSourceTypes: ["system"],
            requiredEvidenceTypes: [],
            verificationRequirements: ["subject_match"],
          },
        ]),
      },
    } as never);

    await expect(
      repository.listEffectiveCandidates({
        tenantId: "tenant-1",
        eventCode: "departed",
        timeKind: "actual",
        occurredAt: new Date(),
        captureSource: "external_evidence",
        authoritySystem: "carrier-a",
      }),
    ).rejects.toThrow("SOURCE_AUTHORITY_POLICY_CONFIGURATION_INVALID");
  });
});
