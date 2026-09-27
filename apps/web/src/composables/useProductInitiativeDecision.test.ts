import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import {
  outcomeHintFor,
  REVIEW_POINTS,
  useProductInitiativeDecision,
} from "./useProductInitiativeDecision";

const getProductInitiative = vi.fn();
const decideProductInitiative = vi.fn();
const registerMarketSignalEvidence = vi.fn();

vi.mock("../api/marketSignals", () => ({
  getProductInitiative: (...args: unknown[]) => getProductInitiative(...args),
  decideProductInitiative: (...args: unknown[]) =>
    decideProductInitiative(...args),
  registerMarketSignalEvidence: (...args: unknown[]) =>
    registerMarketSignalEvidence(...args),
}));

const HANDOFF_ID = "22222222-2222-4222-8222-222222222222";
const SIGNAL_ID = "11111111-1111-4111-8111-111111111111";
const EVIDENCE_ID = "00000000-0000-4000-8000-000000000001";

describe("useProductInitiativeDecision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProductInitiative.mockResolvedValue(detail());
    decideProductInitiative.mockResolvedValue({});
    registerMarketSignalEvidence.mockResolvedValue(undefined);
  });

  it("四项要点与目标结果都缺时列出全部缺口，且不能立项", async () => {
    const state = await mountComposable();

    expect(state.blockingGaps.value).toEqual([
      "目标结果",
      ...REVIEW_POINTS.map((point) => point.label),
    ]);
    expect(state.canApprove.value).toBe(false);
    expect(
      outcomeHintFor({
        outcome: "approve",
        gaps: state.blockingGaps.value,
        reason: "",
      }),
    ).toBe("还差 5 项才能立项");
  });

  it("非立项去向的说明只看向因，不冒充已关闭也不冒充已立项", () => {
    expect(
      outcomeHintFor({ outcome: "defer", gaps: ["合规风险"], reason: "" }),
    ).toContain("不会关闭");
    expect(
      outcomeHintFor({
        outcome: "defer",
        gaps: ["合规风险"],
        reason: "证据还不够",
      }),
    ).toContain("会关闭");
  });

  it("引用证据且写明结论后该项不再算缺口", async () => {
    const state = await mountComposable();

    state.toggleEvidence("compliance_risk", EVIDENCE_ID);
    state.points.compliance_risk.conclusion = "无强制认证，需注意材料标识";

    expect(state.blockingGaps.value).not.toContain("合规风险");
    // 再点一次取消引用，缺口回来
    state.toggleEvidence("compliance_risk", EVIDENCE_ID);
    expect(state.blockingGaps.value).toContain("合规风险");
  });

  it("只引用证据但没有结论仍算缺口", async () => {
    const state = await mountComposable();

    state.toggleEvidence("competitive_supply", EVIDENCE_ID);

    expect(state.blockingGaps.value).toContain("竞争供给");
  });

  it("提交立项时带上服务端版本、幂等键与四项要点", async () => {
    // 服务端已有第 3 版草稿：提交必须带这个版本，而不是 0
    getProductInitiative.mockResolvedValue(
      detail({ initiative: initiative() }),
    );
    const state = await mountComposable();
    fillAll(state);
    getProductInitiative.mockResolvedValue(
      detail({
        initiative: { ...initiative(), currentDestination: "handed_off" },
      }),
    );

    await state.decide("approve");
    await flushPromises();

    expect(decideProductInitiative).toHaveBeenCalledWith(
      HANDOFF_ID,
      expect.objectContaining({
        contractVersion: "product-initiative-decision.v1",
        outcome: "approve",
        expectedInitiativeVersion: 3,
        objective: "把折叠宠物出行包做成可发布版本",
        reviewPoints: expect.arrayContaining([
          expect.objectContaining({
            code: "compliance_risk",
            evidenceRefs: [EVIDENCE_ID],
          }),
        ]),
        idempotencyKey: expect.stringContaining(
          `product-initiative-approve:${HANDOFF_ID}:3:`,
        ),
      }),
    );
    expect(state.receipt.value).toContain("已立项");
    // 成功后重读服务端，不用前端临时状态冒充结果
    expect(getProductInitiative).toHaveBeenCalledTimes(2);
  });

  it("暂缓没填原因时不提交原因字段，交给服务端按待补处理", async () => {
    const state = await mountComposable();

    await state.decide("defer");
    await flushPromises();

    const [, command] = decideProductInitiative.mock.calls[0]!;
    expect(command).not.toHaveProperty("deferReason");
  });

  it("用服务端已有判断回填草稿，刷新后接着补", async () => {
    getProductInitiative.mockResolvedValue(
      detail({
        initiative: {
          ...initiative(),
          objective: "上次写了一半的目标",
          reviewPoints: [
            {
              code: "competitive_supply",
              evidenceRefs: [EVIDENCE_ID],
              conclusion: "头部集中",
            },
          ],
        },
      }),
    );

    const state = await mountComposable();

    expect(state.objective.value).toBe("上次写了一半的目标");
    expect(state.points.competitive_supply).toEqual({
      evidenceRefs: [EVIDENCE_ID],
      conclusion: "头部集中",
    });
    expect(state.blockingGaps.value).not.toContain("竞争供给");
  });

  it("已立项是终态，界面不再提供判断动作", async () => {
    getProductInitiative.mockResolvedValue(
      detail({
        initiative: { ...initiative(), currentDestination: "handed_off" },
      }),
    );

    const state = await mountComposable();

    expect(state.decided.value).toBe(true);
  });
});

async function mountComposable() {
  let state!: ReturnType<typeof useProductInitiativeDecision>;
  const Host = defineComponent({
    setup() {
      state = useProductInitiativeDecision({
        handoffId: HANDOFF_ID,
        signalId: SIGNAL_ID,
      });
      return () => h("div");
    },
  });
  mount(Host);
  await flushPromises();
  return state;
}

function fillAll(state: ReturnType<typeof useProductInitiativeDecision>): void {
  state.objective.value = "把折叠宠物出行包做成可发布版本";
  for (const point of REVIEW_POINTS) {
    state.toggleEvidence(point.code, EVIDENCE_ID);
    state.points[point.code].conclusion = `${point.label} 的结论`;
  }
}

function initiative() {
  return {
    initiativeId: "55555555-5555-4555-8555-555555555555",
    outcome: "defer" as const,
    completion: "pending_completion" as const,
    currentDestination: "needs_decision" as const,
    responsibleActorId: "dev-operator",
    objective: null,
    reviewPoints: [],
    reason: null,
    pendingFieldCodes: [],
    version: 3,
    createdAt: "2026-09-27T00:00:00.000Z",
    updatedAt: "2026-09-27T00:00:00.000Z",
  };
}

function detail(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}
