import { HttpException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { DecideProductInitiativeService } from "./decide-product-initiative.service";
import { GetProductInitiativeService } from "./get-product-initiative.service";
import type { ProductInitiativeRecord } from "../domain/product-initiative.repository";

const HANDOFF_ID = "22222222-2222-4222-8222-222222222222";
const SIGNAL_ID = "11111111-1111-4111-8111-111111111111";
const EVIDENCE_ID = "00000000-0000-4000-8000-000000000001";

describe("DecideProductInitiativeService", () => {
  it("并发判定用服务端读到的版本，而不是信客户端自称的版本", async () => {
    // 服务端是 4，客户端自称 2：若服务端误用客户端的值，两者相等就会放行。
    const { service, persistDecision } = decideHarness({ currentVersion: 4 });

    await expect(
      service.execute({
        tenantId: "t",
        actorId: "selector-1",
        handoffId: HANDOFF_ID,
        command: completeCommand({ expectedInitiativeVersion: 2 }),
      }),
    ).rejects.toMatchObject({ status: 409 });

    expect(persistDecision).not.toHaveBeenCalled();
  });

  it("落库记录映射成契约形状", async () => {
    const { service } = decideHarness({ currentVersion: 0 });

    await expect(
      service.execute({
        tenantId: "t",
        actorId: "selector-1",
        handoffId: HANDOFF_ID,
        command: completeCommand(),
      }),
    ).resolves.toMatchObject({
      initiativeId: "55555555-5555-4555-8555-555555555555",
      currentDestination: "handed_off",
      responsibleActorId: "selector-1",
      version: 1,
    });
  });

  it("缺租户或操作人时拒绝而不是放行", async () => {
    const { service } = decideHarness({ currentVersion: 0 });

    await expect(
      service.execute({
        tenantId: "",
        actorId: "selector-1",
        handoffId: HANDOFF_ID,
        command: completeCommand(),
      }),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it("领域校验失败映射为 400 而不是 500", async () => {
    const { service } = decideHarness({ currentVersion: 0 });

    await expect(
      service.execute({
        tenantId: "t",
        actorId: "selector-1",
        handoffId: HANDOFF_ID,
        command: completeCommand({ objective: undefined }),
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("GetProductInitiativeService", () => {
  it("还没有立项判断时返回空并列出该信号已登记的证据", async () => {
    const service = new GetProductInitiativeService(
      { findByHandoffId: vi.fn().mockResolvedValue(null) } as never,
      {
        findByHandoffId: vi
          .fn()
          .mockResolvedValue({ handoff: { signalId: SIGNAL_ID } }),
      } as never,
      { executeDetails: vi.fn().mockResolvedValue([candidate()]) } as never,
    );

    await expect(
      service.execute({ tenantId: "t", handoffId: HANDOFF_ID }),
    ).resolves.toEqual({
      handoffId: HANDOFF_ID,
      initiative: null,
      evidenceCandidates: [
        {
          evidenceId: EVIDENCE_ID,
          sourceName: "站点类目周报",
          summary: "在售同款 320 个",
          contentRef: "https://example.test/report",
          recordedAt: "2026-09-27T00:00:00.000Z",
        },
      ],
    });
  });

  it("已有立项判断时按记录返回，不再回查机会", async () => {
    const opportunities = { findByHandoffId: vi.fn() };
    const service = new GetProductInitiativeService(
      {
        findByHandoffId: vi
          .fn()
          .mockResolvedValue(record({ signalId: SIGNAL_ID })),
      } as never,
      opportunities as never,
      { executeDetails: vi.fn().mockResolvedValue([]) } as never,
    );

    const detail = await service.execute({
      tenantId: "t",
      handoffId: HANDOFF_ID,
    });

    expect(detail.initiative).toMatchObject({ version: 1 });
    expect(opportunities.findByHandoffId).not.toHaveBeenCalled();
  });

  it("机会不存在时返回 404 而不是空结果", async () => {
    const service = new GetProductInitiativeService(
      { findByHandoffId: vi.fn().mockResolvedValue(null) } as never,
      { findByHandoffId: vi.fn().mockResolvedValue(null) } as never,
      { executeDetails: vi.fn() } as never,
    );

    await expect(
      service.execute({ tenantId: "t", handoffId: HANDOFF_ID }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

function decideHarness(input: { currentVersion: number }) {
  const persistDecision = vi.fn().mockResolvedValue({
    record: record({ signalId: SIGNAL_ID }),
    duplicate: false,
  });
  const service = new DecideProductInitiativeService({
    currentVersion: vi.fn().mockResolvedValue(input.currentVersion),
    persistDecision,
  } as never);
  return { service, persistDecision };
}

function record(overrides: Partial<ProductInitiativeRecord>) {
  return {
    initiativeId: "55555555-5555-4555-8555-555555555555",
    handoffId: HANDOFF_ID,
    signalId: SIGNAL_ID,
    version: 1,
    outcome: "approve",
    completion: "completed",
    currentDestination: "handed_off",
    responsibleActorId: "selector-1",
    responsibilityAccepted: true,
    receivingTeamOrRole: "产品开发 / NPI",
    resourceDescription: "结构工程 1 人",
    targetDate: new Date("2026-11-15T00:00:00.000Z"),
    nextDecisionDate: new Date("2026-10-20T00:00:00.000Z"),
    nextDecisionQuestion: "是否进入 EVT 打样",
    validationFocus: null,
    reconsiderationDate: null,
    objective: "把折叠宠物出行包做成可发布版本",
    reviewPoints: [],
    reason: null,
    pendingFieldCodes: [],
    createdAt: new Date("2026-09-27T00:00:00.000Z"),
    updatedAt: new Date("2026-09-27T00:00:00.000Z"),
    ...overrides,
  } as ProductInitiativeRecord;
}

function candidate() {
  return {
    evidenceId: EVIDENCE_ID,
    subjectId: SIGNAL_ID,
    sourceName: "站点类目周报",
    summary: "在售同款 320 个",
    contentRef: "https://example.test/report",
    recordedAt: new Date("2026-09-27T00:00:00.000Z"),
    verificationState: "unverified",
  };
}

function completeCommand(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: "product-initiative-decision.v1",
    requestId: "55555555-5555-4555-8555-555555555555",
    outcome: "approve",
    expectedInitiativeVersion: 0,
    objective: "把折叠宠物出行包做成可发布版本",
    acceptResponsibility: true,
    receivingTeamOrRole: "产品开发 / NPI",
    resourceDescription: "结构工程 1 人",
    targetDate: "2026-11-15",
    nextDecisionDate: "2026-10-20",
    nextDecisionQuestion: "是否进入 EVT 打样",
    reviewPoints: [
      "target_user_and_market",
      "competitive_supply",
      "price_band_and_margin",
      "compliance_risk",
    ].map((code) => ({
      code,
      evidenceRefs: [EVIDENCE_ID],
      conclusion: "结论",
    })),
    idempotencyKey: "k",
    ...overrides,
  } as never;
}
