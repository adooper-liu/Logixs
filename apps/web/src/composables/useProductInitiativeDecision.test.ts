import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import type {
  ProductInitiativeUnitEconomicsDraftV1,
  ProductInitiativeUnitEconomicsSnapshotV1,
} from "@logix/contracts";
import {
  CONCLUSION_MAX_LENGTH,
  OBJECTIVE_MAX_LENGTH,
  outcomeHintFor,
  REASON_MAX_LENGTH,
  BUSINESS_CASE_DIMENSIONS,
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
const INVALID_EVIDENCE_A = "00000000-0000-4000-8000-000000000091";
const INVALID_EVIDENCE_B = "00000000-0000-4000-8000-000000000092";

/** 只关心缺了什么时，标签就够了；"在哪补"由面板负责呈现。 */
function gapLabels(state: {
  blockingGaps: { value: { label: string }[] };
}): string[] {
  return state.blockingGaps.value.map((gap) => gap.label);
}

describe("useProductInitiativeDecision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProductInitiative.mockResolvedValue(detail());
    decideProductInitiative.mockResolvedValue({});
    registerMarketSignalEvidence.mockResolvedValue(undefined);
  });

  it("门槛要点与目标结果都缺时列出缺口；非门槛的另列，不混进「还差 N 项」", async () => {
    const state = await mountComposable();

    const labels = state.blockingGaps.value.map((gap) => gap.label);
    expect(labels.slice(0, 12)).toEqual([
      "目标结果",
      "由我对此立项负责",
      "承接团队或岗位",
      "资源说明",
      "目标日期",
      "下一决策日期",
      "下一决策问题",
      ...BUSINESS_CASE_DIMENSIONS.map((point) => point.label),
    ]);
    expect(labels).toContain("单位经济 · 币种");
    expect(labels).toContain("单位经济 · 基准情景 · 销售价 · 最低值");
    expect(labels).toHaveLength(61);
    expect(state.blockingGapGroups.value).toEqual([
      { panel: "objective", label: "目标结果", count: 1 },
      { panel: "responsibility_resources", label: "责任与资源", count: 3 },
      { panel: "timeline_decision", label: "时间与下一决策", count: 3 },
      { panel: "review_points", label: "评审依据", count: 5 },
      { panel: "unit_economics", label: "单位经济", count: 49 },
    ]);
    expect(state.requiredCount.value).toBe(5);
    // 非门槛的缺了只提示 —— 混进去会让人以为非补不可。
    expect(state.optionalGaps.value).toEqual([]);
    expect(state.canApprove.value).toBe(false);
    expect(
      outcomeHintFor({
        outcome: "approve",
        gaps: state.blockingGapGroups.value,
        reason: "",
        reconsiderationDate: "",
      }),
    ).toBe("还差 5 类才能立项");
  });

  it("非立项去向的说明按所需事实判断，不冒充已关闭也不冒充已立项", () => {
    expect(
      outcomeHintFor({
        outcome: "defer",
        gaps: ["合规风险"],
        reason: "",
        reconsiderationDate: "",
      }),
    ).toContain("不会关闭");
    expect(
      outcomeHintFor({
        outcome: "defer",
        gaps: ["合规风险"],
        reason: "证据还不够",
        reconsiderationDate: "",
      }),
    ).toContain("不会关闭");
    expect(
      outcomeHintFor({
        outcome: "defer",
        gaps: ["合规风险"],
        reason: "",
        reconsiderationDate: "2026-10-20",
      }),
    ).toContain("不会关闭");
    expect(
      outcomeHintFor({
        outcome: "defer",
        gaps: ["合规风险"],
        reason: "证据还不够",
        reconsiderationDate: "2026-10-20",
      }),
    ).toContain("提交后本次判断会关闭");
    expect(
      outcomeHintFor({
        outcome: "return_to_market",
        gaps: [],
        reason: "请重新核对方向",
        reconsiderationDate: "",
        returnBasis: "",
      }),
    ).toBe("请选择退回依据");
  });

  it("引用证据且写明结论后该项不再算缺口", async () => {
    const state = await mountComposable();

    state.businessCase.supply_technical_feasibility.evidenceRefs = [
      EVIDENCE_ID,
    ];
    state.businessCase.supply_technical_feasibility.decision =
      "supports_investment";
    state.businessCase.supply_technical_feasibility.conclusion =
      "供应验证有依据";

    expect(gapLabels(state)).not.toContain("供应与技术可行性");
    // 再点一次取消引用，缺口回来
    state.businessCase.supply_technical_feasibility.evidenceRefs = [];
    expect(gapLabels(state)).toContain("供应与技术可行性");
  });

  it("只引用证据但没有结论仍算缺口", async () => {
    const state = await mountComposable();

    state.businessCase.value_differentiation.evidenceRefs = [EVIDENCE_ID];

    expect(gapLabels(state)).toContain("价值与差异");
  });

  it("提交立项时带上服务端版本、幂等键与五面草稿", async () => {
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
        businessCaseDraft: expect.arrayContaining([
          expect.objectContaining({
            dimensionCode: "strategy_portfolio",
            decision: "supports_investment",
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
    decideProductInitiative.mockResolvedValueOnce({
      currentDestination: "needs_decision",
    });
    const state = await mountComposable();

    await state.decide("defer");
    await flushPromises();

    const [, command] = decideProductInitiative.mock.calls[0]!;
    expect(command).not.toHaveProperty("deferReason");
    expect(state.receipt.value).toBe("已保存但仍待补验证重点或重判日期。");
  });

  it("只有服务端形成 deferred 才回执已暂缓", async () => {
    decideProductInitiative.mockResolvedValueOnce({
      currentDestination: "deferred",
    });
    const state = await mountComposable();

    await state.decide("defer");
    await flushPromises();

    expect(state.receipt.value).toBe("已暂缓，仍留在选品队列。");
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
          businessCaseDraft: [
            {
              dimensionCode: "customer_need",
              decision: "validate_before_investment",
              conclusion: "仍在验证真实需求",
              evidenceRefs: [EVIDENCE_ID],
              criticalUnknown: "真实购买量",
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
    expect(state.businessCase.customer_need).toMatchObject({
      decision: "validate_before_investment",
      criticalUnknown: "真实购买量",
    });
    expect(gapLabels(state)).toContain("客户与需求");
    expect(gapLabels(state)).toContain("价值与差异");
  });

  it("已立项是终态，界面不再提供判断动作", async () => {
    getProductInitiative.mockResolvedValue(
      detail({
        initiative: { ...initiative(), currentDestination: "handed_off" },
      }),
    );

    const state = await mountComposable();

    expect(state.decided.value).toBe(true);
    expect(state.legacyReadOnly.value).toBe(false);
  });

  it.each(["rejected", "deferred"] as const)(
    "completed legacy %s 仅供查看，不能提交新决定",
    async (currentDestination) => {
      getProductInitiative.mockResolvedValue(
        detail({
          initiative: {
            ...initiative(),
            outcome: currentDestination === "rejected" ? "reject" : "defer",
            completion: "completed",
            currentDestination,
            businessCaseDraft: [],
            businessCaseSnapshot: null,
            reviewPoints: [
              {
                code: "competitive_supply",
                evidenceRefs: [EVIDENCE_ID],
                conclusion: "历史评审",
              },
            ],
          },
        }),
      );
      const state = await mountComposable();

      expect(state.legacyReadOnly.value).toBe(true);
      expect(state.decided.value).toBe(true);
      expect(
        state.reviewPointViews.value.find(
          (point) => point.code === "competitive_supply",
        )?.conclusion,
      ).toBe("历史评审");
      expect(await state.decide("reject")).toBe(false);
      expect(decideProductInitiative).not.toHaveBeenCalled();
    },
  );

  it("pending legacy 仍可建立空五面草稿", async () => {
    getProductInitiative.mockResolvedValue(
      detail({
        initiative: {
          ...initiative(),
          businessCaseDraft: [],
          businessCaseSnapshot: null,
        },
      }),
    );
    const state = await mountComposable();

    expect(state.legacyReadOnly.value).toBe(false);
    expect(state.decided.value).toBe(false);
    await state.decide("defer");
    expect(decideProductInitiative).toHaveBeenCalledOnce();
    expect(
      decideProductInitiative.mock.calls[0]?.[1].businessCaseDraft,
    ).toEqual(
      BUSINESS_CASE_DIMENSIONS.map(({ code }) => ({
        dimensionCode: code,
        conclusion: null,
        criticalUnknown: null,
        evidenceRefs: [],
      })),
    );
  });

  it("新式已拒绝但五面草稿为空时保留再判断入口", async () => {
    getProductInitiative.mockResolvedValue(
      detail({
        initiative: {
          ...initiative(),
          completion: "completed",
          currentDestination: "rejected",
          businessCaseDraft: [],
          businessCaseSnapshot: null,
          pendingFieldCodes: ["customer_need"],
        },
      }),
    );
    const state = await mountComposable();

    expect(state.legacyReadOnly.value).toBe(false);
    expect(state.decided.value).toBe(false);
  });

  it("换一条机会就重读那一条的立项判断，不沿用上一条", async () => {
    const state = await mountComposable();
    state.businessCase.customer_need.conclusion = "上一条机会的判断";
    expect(getProductInitiative).toHaveBeenCalledTimes(1);

    handoffId.value = OTHER_HANDOFF_ID;
    await flushPromises();

    expect(getProductInitiative).toHaveBeenLastCalledWith(OTHER_HANDOFF_ID);
    expect(state.businessCase.customer_need.conclusion).toBe("");
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

  it("NPI 退回不是选品决定去向，回填时不把它当成退回经营", async () => {
    getProductInitiative.mockResolvedValue(
      detail({
        initiative: {
          ...initiative(),
          outcome: "returned_from_npi",
          completion: "completed",
          currentDestination: "returned_from_npi",
          reason: "样品结构与立项目标不符",
          objective: "可折叠宠物出行包",
        },
      }),
    );

    const state = await mountComposable();

    expect(state.destination.value).toBe("approve");
    expect(state.currentReason.value).toBe("");
    expect(state.objective.value).toBe("可折叠宠物出行包");
    expect(state.decided.value).toBe(false);
    expect(state.legacyReadOnly.value).toBe(false);
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
        validationFocus: "证据不足，等双十一数据",
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
    state.receivingTeamOrRole.value = "产品开发 / NPI";
    state.resourceDescription.value = "结构工程 1 人";
    state.reconsiderationDate.value = "2026-10-20";
    state.setUnitEconomicsCurrency("CAD");
    state.setUnitEconomicsRangeValue(
      "conservative",
      "salePrice",
      "min",
      "80.00",
    );

    await state.decide("defer");
    await flushPromises();

    expect(state.error.value).toContain("已被其他人更新过");
    expect(state.error.value).not.toContain(
      "PRODUCT_INITIATIVE_VERSION_CONFLICT",
    );
    expect(getProductInitiative).toHaveBeenCalledTimes(2);
    expect(state.receivingTeamOrRole.value).toBe("产品开发 / NPI");
    expect(state.resourceDescription.value).toBe("结构工程 1 人");
    expect(state.reconsiderationDate.value).toBe("2026-10-20");
    expect(state.unitEconomicsDraft.currencyCode).toBe("CAD");
    expect(state.unitEconomicsDraft.scenarios.conservative.salePrice.min).toBe(
      "80.00",
    );
  });

  it("无效证据显示具体引用并保留当前未提交草稿", async () => {
    decideProductInitiative.mockRejectedValue(
      new Error(
        `暂时无法保存本次立项判断（400）：PRODUCT_INITIATIVE_EVIDENCE_INVALID: ${INVALID_EVIDENCE_A},${INVALID_EVIDENCE_B}`,
      ),
    );
    const state = await mountComposable();
    state.objective.value = "尚未保存的目标结果";
    state.points.compliance_risk.evidenceRefs = [INVALID_EVIDENCE_B];
    state.points.compliance_risk.conclusion = "尚未保存的合规结论";

    await state.decide("approve");
    await flushPromises();

    expect(state.error.value).toBe(
      `该证据不存在或不属于当前机会，请重新选择：${INVALID_EVIDENCE_A}、${INVALID_EVIDENCE_B}`,
    );
    expect(state.objective.value).toBe("尚未保存的目标结果");
    expect(state.points.compliance_risk).toEqual({
      evidenceRefs: [INVALID_EVIDENCE_B],
      conclusion: "尚未保存的合规结论",
    });
    expect(getProductInitiative).toHaveBeenCalledTimes(1);
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
    state.returnBasis.value = "wrong_direction";

    await state.decide();
    await flushPromises();

    expect(decideProductInitiative).toHaveBeenCalledWith(
      HANDOFF_ID,
      expect.objectContaining({
        outcome: "return_to_market",
        returnReason: "该由经营团队重新判断",
        returnBasis: "wrong_direction",
      }),
    );
  });

  it("回填服务端单位经济草稿与计算快照，不在前端重算贡献", async () => {
    getProductInitiative.mockResolvedValue(
      detail({
        initiative: {
          ...initiative(),
          unitEconomicsDraft: completeUnitEconomicsDraft(),
          unitEconomicsSnapshot: completeUnitEconomicsSnapshot(),
        },
      }),
    );

    const state = await mountComposable();

    expect(state.unitEconomicsDraft.currencyCode).toBe("CAD");
    expect(state.unitEconomicsDraft.scenarios.conservative.salePrice.min).toBe(
      "100.00",
    );
    expect(
      state.unitEconomicsSnapshot.value?.scenarios.conservative.contribution,
    ).toEqual({ min: "50.00", max: "95.00" });
    expect(
      state.blockingGaps.value.filter((gap) => gap.panel === "unit_economics"),
    ).toEqual([]);
  });

  it("所有去向都提交可恢复的部分单位经济草稿，且不回传只读市场", async () => {
    const state = await mountComposable();
    state.setUnitEconomicsCurrency("CAD");
    state.setUnitEconomicsRangeValue("baseline", "salePrice", "min", "80.00");
    state.setUnitEconomicsBasis("baseline", "salePrice", "evidence");
    state.toggleUnitEconomicsEvidence("baseline", "salePrice", EVIDENCE_ID);

    await state.decide("defer");
    await flushPromises();

    const [, command] = decideProductInitiative.mock.calls[0]!;
    expect(command.unitEconomicsDraft).toEqual({
      channelCode: "Amazon CA",
      currencyCode: "CAD",
      scenarios: {
        baseline: {
          salePrice: {
            min: "80.00",
            basis: "evidence",
            evidenceRefs: [EVIDENCE_ID],
          },
        },
      },
    });
    expect(command.unitEconomicsDraft).not.toHaveProperty("marketCode");
  });

  it("切换到待验证假设会清除不再合法的证据引用", async () => {
    const state = await mountComposable();
    state.setUnitEconomicsBasis("baseline", "salePrice", "evidence");
    state.toggleUnitEconomicsEvidence("baseline", "salePrice", EVIDENCE_ID);

    state.setUnitEconomicsBasis("baseline", "salePrice", "assumption");

    expect(state.unitEconomicsDraft.scenarios.baseline.salePrice).toMatchObject(
      {
        basis: "assumption",
        evidenceRefs: [],
      },
    );
  });

  it("服务端确认负贡献缺口后就地要求理由，填写后保留该事实供重提", async () => {
    decideProductInitiative.mockRejectedValueOnce(
      new Error(
        "暂时无法保存本次立项判断（400）：PRODUCT_INITIATIVE_INCOMPLETE: negativeConservativeReason",
      ),
    );
    const state = await mountComposable();

    await state.decide("approve");

    expect(state.negativeContributionNeedsReason.value).toBe(true);
    expect(gapLabels(state)).toContain("单位经济 · 仍要投入的理由");

    state.setNegativeConservativeReason("战略品类入口仍需小规模验证");

    expect(state.negativeContributionNeedsReason.value).toBe(true);
    expect(gapLabels(state)).not.toContain("单位经济 · 仍要投入的理由");
  });

  it("无 active 币种 release 时明确暴露空选项，不填默认币种", async () => {
    getProductInitiative.mockResolvedValue(detail({ currencyOptions: [] }));

    const state = await mountComposable();

    expect(state.currencyOptions.value).toEqual([]);
    expect(state.unitEconomicsDraft.currencyCode).toBe("");
  });

  it("只有服务端形成 return_requested 才回执等待市场接回", async () => {
    const state = await mountComposable();
    state.returnBasis.value = "wrong_direction";
    state.currentReason.value = "请重新核对方向";
    decideProductInitiative.mockResolvedValueOnce({
      currentDestination: "needs_decision",
    });

    await state.decide("return_to_market");
    expect(state.receipt.value).toBe("已保存退回判断，尚未形成退回请求。");

    decideProductInitiative.mockResolvedValueOnce({
      currentDestination: "return_requested",
    });
    await state.decide("return_to_market");
    expect(state.receipt.value).toBe("已请求退回市场，等待市场接回。");
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
    state = useProductInitiativeDecision({
      handoffId,
      signalId: SIGNAL_ID,
      marketCode: "CA",
      channelCode: "Amazon CA",
    });
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
  for (const point of BUSINESS_CASE_DIMENSIONS) {
    state.businessCase[point.code].evidenceRefs = [EVIDENCE_ID];
    state.businessCase[point.code].decision = "supports_investment";
    state.businessCase[point.code].conclusion = point.label + " 的结论";
  }
}

function initiative() {
  return {
    initiativeId: "55555555-5555-4555-8555-555555555555",
    outcome: "defer" as const,
    completion: "pending_completion" as const,
    currentDestination: "needs_decision" as const,
    responsibleActorId: "dev-operator",
    responsibilityAccepted: null,
    receivingTeamOrRole: null,
    resourceDescription: null,
    targetDate: null,
    nextDecisionDate: null,
    nextDecisionQuestion: null,
    validationFocus: null,
    reconsiderationDate: null,
    unitEconomicsDraft: null,
    unitEconomicsSnapshot: null,
    negativeConservativeReason: null,
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
    currencyOptions: [
      { code: "CAD", name: "Canadian Dollar", minorUnit: 2 },
      { code: "USD", name: "US Dollar", minorUnit: 2 },
    ],
    ...overrides,
  };
}

function completeUnitEconomicsDraft(): ProductInitiativeUnitEconomicsDraftV1 {
  const price = {
    min: "100.00",
    max: "120.00",
    basis: "assumption" as const,
    evidenceRefs: [],
  };
  const cost = {
    min: "5.00",
    max: "10.00",
    basis: "assumption" as const,
    evidenceRefs: [],
  };
  const scenario = () => ({
    salePrice: { ...price },
    landedCost: { ...cost },
    platformFee: { ...cost },
    fulfillmentFee: { ...cost },
    advertisingCost: { ...cost },
    returnCost: { ...cost },
  });
  return {
    marketCode: "CA",
    channelCode: "Amazon CA",
    currencyCode: "CAD",
    scenarios: {
      baseline: scenario(),
      conservative: scenario(),
    },
  };
}

function completeUnitEconomicsSnapshot(): ProductInitiativeUnitEconomicsSnapshotV1 {
  const draft = completeUnitEconomicsDraft();
  const scenario = draft.scenarios!.baseline!;
  return {
    marketCode: "CA",
    channelCode: "Amazon CA",
    currencyCode: "CAD",
    scenarios: {
      baseline: {
        ...scenario,
        contribution: { min: "50.00", max: "95.00" },
      } as ProductInitiativeUnitEconomicsSnapshotV1["scenarios"]["baseline"],
      conservative: {
        ...scenario,
        contribution: { min: "50.00", max: "95.00" },
      } as ProductInitiativeUnitEconomicsSnapshotV1["scenarios"]["conservative"],
    },
  };
}
