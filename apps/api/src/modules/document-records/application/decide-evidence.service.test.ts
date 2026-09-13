import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { EVIDENCE_REPOSITORY } from "../domain/evidence.repository";
import { DecideEvidenceService } from "./decide-evidence.service";

function record(
  state: string,
  tenantId = "dev-tenant",
  validity = "effective",
) {
  return {
    id: "e1",
    tenantId,
    verificationState: state,
    validity,
  };
}

async function buildService(
  repository: Record<string, ReturnType<typeof vi.fn>>,
) {
  const module = await Test.createTestingModule({
    providers: [
      DecideEvidenceService,
      { provide: EVIDENCE_REPOSITORY, useValue: repository },
    ],
  }).compile();
  return module.get(DecideEvidenceService);
}

const base = {
  evidenceId: "e1",
  tenantId: "dev-tenant",
  actorOrServiceId: "dev-operator",
  reasonCode: "manual_review",
};

describe("DecideEvidenceService", () => {
  it("不存在 → RESOURCE_NOT_FOUND", async () => {
    const service = await buildService({
      findById: vi.fn().mockResolvedValue(null),
    });
    await expect(
      service.execute({ ...base, decision: "verified" }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
  });

  it("跨租户 → AUTHORIZATION_SCOPE_DENIED", async () => {
    const appendDecision = vi.fn();
    const service = await buildService({
      findById: vi.fn().mockResolvedValue(record("pending", "other")),
      appendDecision,
    });
    await expect(
      service.execute({ ...base, decision: "rejected" }),
    ).rejects.toThrow("AUTHORIZATION_SCOPE_DENIED");
    expect(appendDecision).not.toHaveBeenCalled();
  });

  it("pending 可核验或拒绝；已是目标态不追加", async () => {
    const appendDecision = vi.fn().mockResolvedValue({
      record: record("verified"),
      decisionId: "d1",
      appended: true,
    });
    const pending = await buildService({
      findById: vi.fn().mockResolvedValue(record("pending")),
      appendDecision,
    });
    await expect(
      pending.execute({ ...base, decision: "verified" }),
    ).resolves.toMatchObject({ appended: true, decisionId: "d1" });

    const replay = await buildService({
      findById: vi.fn().mockResolvedValue(record("rejected")),
      appendDecision,
    });
    await expect(
      replay.execute({ ...base, decision: "rejected" }),
    ).resolves.toEqual({
      record: record("rejected"),
      decisionId: null,
      appended: false,
    });
    expect(appendDecision).toHaveBeenCalledTimes(1);
  });

  it("撤销引用原核验决定；无原决定拒绝", async () => {
    const appendDecision = vi.fn().mockResolvedValue({
      record: record("revoked", "dev-tenant", "revoked"),
      decisionId: "d2",
      appended: true,
    });
    const ok = await buildService({
      findById: vi.fn().mockResolvedValue(record("verified")),
      findLatestVerifiedDecisionId: vi.fn().mockResolvedValue("d1"),
      appendDecision,
    });
    await expect(
      ok.execute({ ...base, decision: "revoked" }),
    ).resolves.toMatchObject({ appended: true });
    expect(appendDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "revoked",
        nextState: "revoked",
        nextValidity: "revoked",
        previousDecisionId: "d1",
      }),
    );

    const missing = await buildService({
      findById: vi.fn().mockResolvedValue(record("verified")),
      findLatestVerifiedDecisionId: vi.fn().mockResolvedValue(null),
      appendDecision,
    });
    await expect(
      missing.execute({ ...base, decision: "revoked" }),
    ).rejects.toThrow("BUSINESS_STATE_VIOLATION");
  });
});
