import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import {
  CONCLUSION_MAX_LENGTH,
  OBJECTIVE_MAX_LENGTH,
  outcomeHintFor,
  REASON_MAX_LENGTH,
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
const OTHER_HANDOFF_ID = "33333333-3333-4333-8333-333333333333";
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

  it("换一条机会就重读那一条的立项判断，不沿用上一条", async () => {
    await mountComposable();
    expect(getProductInitiative).toHaveBeenCalledTimes(1);

    handoffId.value = OTHER_HANDOFF_ID;
    await flushPromises();

    expect(getProductInitiative).toHaveBeenLastCalledWith(OTHER_HANDOFF_ID);
  });

  it("已记录的去向与原因回填，不让人以为还没判断过", async () => {
    getProductInitiative.mockResolvedValue(
      detail({
        initiative: {
          ...initiative(),
          outcome: "defer",
          completion: "completed",
          currentDestination: "deferred",
          reason: "证据不足，等双十一数据",
        },
      }),
    );

    const state = await mountComposable();

    expect(state.destination.value).toBe("defer");
    expect(state.currentReason.value).toBe("证据不足，等双十一数据");
  });

  it("回填后重放同一去向会带上已记录的原因，不会把它抹掉", async () => {
    getProductInitiative.mockResolvedValue(
      detail({
        initiative: {
          ...initiative(),
          outcome: "defer",
          completion: "completed",
          currentDestination: "deferred",
          reason: "证据不足，等双十一数据",
        },
      }),
    );
    const state = await mountComposable();

    await state.decide();
    await flushPromises();

    const [, command] = decideProductInitiative.mock.calls[0]!;
    expect(command).toEqual(
      expect.objectContaining({
        outcome: "defer",
        deferReason: "证据不足，等双十一数据",
      }),
    );
  });

  it("换一条机会不把上一条还没保存的原因带过去", async () => {
    await mountComposable();
    state.currentReason.value = "上一条写了一半的理由";

    handoffId.value = OTHER_HANDOFF_ID;
    await flushPromises();

    expect(state.destination.value).toBe("approve");
    expect(state.currentReason.value).toBe("");
  });

  it("登记证据只刷新候选，不清掉还没保存的草稿", async () => {
    const state = await mountComposable();
    state.objective.value = "写了一半的目标";
    state.points.compliance_risk.conclusion = "写了一半的结论";

    await state.addEvidence({
      sourceName: "站点周报",
      sourceUrl: "",
      content: "新登记的证据",
    });
    await flushPromises();

    expect(registerMarketSignalEvidence).toHaveBeenCalledWith({
      signalId: SIGNAL_ID,
      sourceName: "站点周报",
      sourceUrl: "",
      content: "新登记的证据",
    });
    expect(state.objective.value).toBe("写了一半的目标");
    expect(state.points.compliance_risk.conclusion).toBe("写了一半的结论");
    expect(getProductInitiative).toHaveBeenCalledTimes(2);
  });

  it("先发出的请求后返回时不覆盖当前机会", async () => {
    let releaseSlow!: (value: unknown) => void;
    getProductInitiative
      .mockReturnValueOnce(
        new Promise((resolve) => {
          releaseSlow = resolve;
        }),
      )
      .mockResolvedValue(
        detail({
          handoffId: OTHER_HANDOFF_ID,
          initiative: { ...initiative(), objective: "只属于第二条机会" },
        }),
      );
    const state = await mountComposable();

    handoffId.value = OTHER_HANDOFF_ID;
    await flushPromises();
    expect(state.objective.value).toBe("只属于第二条机会");

    // 慢的那条（前一条机会）现在才回来，不能把当前机会的判断盖回去
    releaseSlow(detail({ handoffId: HANDOFF_ID }));
    await flushPromises();

    expect(state.detail.value?.handoffId).toBe(OTHER_HANDOFF_ID);
    expect(state.objective.value).toBe("只属于第二条机会");
  });

  it("版本冲突给人话，并重新读取版本而不是让人反复撞同一堵墙", async () => {
    decideProductInitiative.mockRejectedValue(
      new Error(
        "暂时无法保存本次立项判断（409）：PRODUCT_INITIATIVE_VERSION_CONFLICT",
      ),
    );
    const state = await mountComposable();

    await state.decide("defer");
    await flushPromises();

    expect(state.error.value).toContain("已被其他人更新过");
    expect(state.error.value).not.toContain(
      "PRODUCT_INITIATIVE_VERSION_CONFLICT",
    );
    expect(getProductInitiative).toHaveBeenCalledTimes(2);
  });

  it("已立项后服务端拒绝不再判断时，说明是终态而不是普通失败", async () => {
    decideProductInitiative.mockRejectedValue(
      new Error(
        "暂时无法保存本次立项判断（409）：PRODUCT_INITIATIVE_ALREADY_APPROVED",
      ),
    );
    const state = await mountComposable();

    await state.decide("defer");
    await flushPromises();

    expect(state.error.value).toContain("已经立项");
    expect(state.error.value).not.toContain(
      "PRODUCT_INITIATIVE_ALREADY_APPROVED",
    );
    // 终态不是版本问题，不需要重读
    expect(getProductInitiative).toHaveBeenCalledTimes(1);
  });

  it("选中的去向决定默认提交去向，不用调用方再传一遍", async () => {
    const state = await mountComposable();
    state.setDestination("return_to_market");
    state.currentReason.value = "该由经营团队重新判断";

    await state.decide();
    await flushPromises();

    expect(decideProductInitiative).toHaveBeenCalledWith(
      HANDOFF_ID,
      expect.objectContaining({
        outcome: "return_to_market",
        returnReason: "该由经营团队重新判断",
      }),
    );
  });

  it("前端长度上限直接读契约，契约改了这里会红而不是悄悄漂移", () => {
    // vitest 以 apps/web 为工作目录，从那里回到仓库根。
    const schemaPath = resolve(
      process.cwd(),
      "../../packages/contracts/schemas/v1/product-initiative.schema.json",
    );
    const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as {
      $defs: Record<
        string,
        { properties: Record<string, { maxLength?: number }> }
      >;
    };
    const command = schema.$defs.ProductInitiativeDecisionCommandV1!;
    const point = schema.$defs.ProductInitiativeReviewPointV1!;

    expect(command.properties.objective!.maxLength).toBe(OBJECTIVE_MAX_LENGTH);
    expect(command.properties.deferReason!.maxLength).toBe(REASON_MAX_LENGTH);
    expect(command.properties.rejectReason!.maxLength).toBe(REASON_MAX_LENGTH);
    expect(command.properties.returnReason!.maxLength).toBe(REASON_MAX_LENGTH);
    expect(point.properties.conclusion!.maxLength).toBe(CONCLUSION_MAX_LENGTH);
  });
});

const handoffId = ref(HANDOFF_ID);
let state!: ReturnType<typeof useProductInitiativeDecision>;
const Host = defineComponent({
  setup() {
    state = useProductInitiativeDecision({ handoffId, signalId: SIGNAL_ID });
    return () => h("div");
  },
});

async function mountComposable() {
  handoffId.value = HANDOFF_ID;
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
