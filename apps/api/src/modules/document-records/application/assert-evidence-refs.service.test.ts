import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { EVIDENCE_REPOSITORY } from "../domain/evidence.repository";
import { AssertEvidenceRefsService } from "./assert-evidence-refs.service";

const SUBJECT = "10000000-0000-4000-8000-000000000001";

function qualified(id = "e1") {
  return {
    id,
    tenantId: "dev-tenant",
    subjectType: "container",
    subjectId: SUBJECT,
    verificationState: "verified",
    validity: "effective",
  };
}

async function buildService(
  repository: Record<string, ReturnType<typeof vi.fn>>,
) {
  const module = await Test.createTestingModule({
    providers: [
      AssertEvidenceRefsService,
      { provide: EVIDENCE_REPOSITORY, useValue: repository },
    ],
  }).compile();
  return module.get(AssertEvidenceRefsService);
}

describe("AssertEvidenceRefsService", () => {
  it("缺记录 → EVIDENCE_REQUIRED", async () => {
    const service = await buildService({
      findByIds: vi.fn().mockResolvedValue([]),
    });
    await expect(
      service.execute({
        tenantId: "dev-tenant",
        subjectType: "container",
        subjectId: SUBJECT,
        evidenceIds: ["e1"],
      }),
    ).rejects.toThrow("EVIDENCE_REQUIRED");
  });

  it("跨租户 → AUTHORIZATION_SCOPE_DENIED", async () => {
    const service = await buildService({
      findByIds: vi
        .fn()
        .mockResolvedValue([{ ...qualified(), tenantId: "other" }]),
    });
    await expect(
      service.execute({
        tenantId: "dev-tenant",
        subjectType: "container",
        subjectId: SUBJECT,
        evidenceIds: ["e1"],
      }),
    ).rejects.toThrow("AUTHORIZATION_SCOPE_DENIED");
  });

  it("pending 或对象不匹配 → EVIDENCE_REQUIRED", async () => {
    const pending = await buildService({
      findByIds: vi
        .fn()
        .mockResolvedValue([{ ...qualified(), verificationState: "pending" }]),
    });
    await expect(
      pending.execute({
        tenantId: "dev-tenant",
        subjectType: "container",
        subjectId: SUBJECT,
        evidenceIds: ["e1"],
      }),
    ).rejects.toThrow("EVIDENCE_REQUIRED");

    const mismatch = await buildService({
      findByIds: vi
        .fn()
        .mockResolvedValue([
          { ...qualified(), subjectId: "20000000-0000-4000-8000-000000000002" },
        ]),
    });
    await expect(
      mismatch.execute({
        tenantId: "dev-tenant",
        subjectType: "container",
        subjectId: SUBJECT,
        evidenceIds: ["e1"],
      }),
    ).rejects.toThrow("EVIDENCE_REQUIRED");

    const revoked = await buildService({
      findByIds: vi.fn().mockResolvedValue([
        {
          ...qualified(),
          verificationState: "revoked",
          validity: "revoked",
        },
      ]),
    });
    await expect(
      revoked.execute({
        tenantId: "dev-tenant",
        subjectType: "container",
        subjectId: SUBJECT,
        evidenceIds: ["e1"],
      }),
    ).rejects.toThrow("EVIDENCE_REQUIRED");
  });

  it("合格证据放行", async () => {
    const service = await buildService({
      findByIds: vi.fn().mockResolvedValue([qualified()]),
    });
    await expect(
      service.execute({
        tenantId: "dev-tenant",
        subjectType: "container",
        subjectId: SUBJECT,
        evidenceIds: ["e1"],
      }),
    ).resolves.toBeUndefined();
  });
});
