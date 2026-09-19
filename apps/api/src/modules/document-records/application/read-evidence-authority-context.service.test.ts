import { ForbiddenException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { EVIDENCE_REPOSITORY } from "../domain/evidence.repository";
import { ReadEvidenceAuthorityContextService } from "./read-evidence-authority-context.service";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "evidence-1",
    tenantId: "tenant-1",
    evidenceType: "api_response",
    subjectType: "container",
    subjectId: "container-1",
    authorityLevel: "authoritative",
    source: {
      sourceId: "source-1",
      sourceType: "system",
      originatorSystem: "provider-a",
      authoritySystem: "carrier-a",
      ingestionChannel: "api",
      captureSource: "external_evidence",
    },
    verificationState: "verified",
    confidenceState: "confirmed",
    validity: "effective",
    receivedAt: new Date(),
    recordedAt: new Date(),
    contentRef: "object://evidence-1",
    contentHash: "a".repeat(64),
    ...overrides,
  };
}

async function build(rows: ReturnType<typeof row>[]) {
  const module = await Test.createTestingModule({
    providers: [
      ReadEvidenceAuthorityContextService,
      {
        provide: EVIDENCE_REPOSITORY,
        useValue: { findByIds: vi.fn().mockResolvedValue(rows) },
      },
    ],
  }).compile();
  return module.get(ReadEvidenceAuthorityContextService);
}

describe("ReadEvidenceAuthorityContextService", () => {
  it("只返回同租户同对象的权威裁决字段", async () => {
    const service = await build([
      row(),
      row({ id: "other-subject", subjectId: "container-2" }),
    ]);

    await expect(
      service.execute({
        tenantId: "tenant-1",
        subjectType: "container",
        subjectId: "container-1",
        evidenceIds: ["evidence-1", "other-subject"],
      }),
    ).resolves.toEqual([
      {
        id: "evidence-1",
        evidenceType: "api_response",
        authorityLevel: "authoritative",
        sourceType: "system",
        authoritySystem: "carrier-a",
        verificationState: "verified",
        validity: "effective",
      },
    ]);
  });

  it("发现跨租户证据时明确拒绝", async () => {
    const service = await build([row({ tenantId: "other-tenant" })]);

    await expect(
      service.execute({
        tenantId: "tenant-1",
        subjectType: "container",
        subjectId: "container-1",
        evidenceIds: ["evidence-1"],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
