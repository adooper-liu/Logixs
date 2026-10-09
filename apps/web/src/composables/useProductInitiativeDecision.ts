import type {
  ProductInitiativeDecisionCommandV1,
  ProductInitiativeBusinessCaseDimensionCodeV1,
  ProductInitiativeBusinessCaseDecisionV1,
  ProductInitiativeDetailV1,
  ProductInitiativeReviewPointCodeV1,
  ProductInitiativeReturnBasisV1,
  ProductInitiativeUnitEconomicsBasisV1,
  ProductInitiativeUnitEconomicsDraftV1,
  ProductInitiativeUnitEconomicsSnapshotV1,
  ProductInitiativeRiskAssessmentDraftV1,
  ProductInitiativeRiskCodeV1,
} from "@logix/contracts";
import {
  computed,
  reactive,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import {
  decideProductInitiative,
  getProductInitiative,
  registerMarketSignalEvidence,
} from "../api/marketSignals";

export const REVIEW_POINTS = [
  { code: "target_user_and_market", label: "目标用户与市场" },
  { code: "competitive_supply", label: "竞争供给" },
  { code: "price_band_and_margin", label: "价格带与利润" },
  { code: "compliance_risk", label: "合规风险" },
  { code: "customer_feedback", label: "客户反馈与痛点" },
] as const satisfies readonly {
  code: ProductInitiativeReviewPointCodeV1;
  label: string;
}[];

export const BUSINESS_CASE_DIMENSIONS = [
  { code: "customer_need", label: "客户与需求" },
  { code: "value_differentiation", label: "价值与差异" },
  { code: "commercial_viability", label: "商业可行性" },
  { code: "supply_technical_feasibility", label: "供应与技术可行性" },
  { code: "strategy_portfolio", label: "战略与组合" },
] as const satisfies readonly {
  code: ProductInitiativeBusinessCaseDimensionCodeV1;
  label: string;
}[];

export const RISK_ASSESSMENTS = [
  { code: "compliance", label: "合规" },
  { code: "intellectual_property", label: "知识产权" },
  { code: "packaging_logistics", label: "包装物流" },
  { code: "returns", label: "退货" },
  { code: "platform_restrictions", label: "平台限制" },
] as const satisfies readonly {
  code: ProductInitiativeRiskCodeV1;
  label: string;
}[];

export interface RiskAssessmentView extends ProductInitiativeRiskAssessmentDraftV1 {
  label: string;
  missing: boolean;
}

export interface BusinessCaseDraftState {
  decision: ProductInitiativeBusinessCaseDecisionV1 | "";
  conclusion: string;
  evidenceRefs: string[];
  criticalUnknown: string;
}

export interface BusinessCaseDimensionView extends BusinessCaseDraftState {
  code: ProductInitiativeBusinessCaseDimensionCodeV1;
  label: string;
  missing: boolean;
}

export type ProductInitiativeOutcome =
  ProductInitiativeDecisionCommandV1["outcome"];

/**
 * 与服务端契约一致的长度上限（`product-initiative.schema.json`）。
 * 前端先拦住，别让人写完整段分析才被 400 拒绝；上限本身由测试对着 schema 校验，
 * 契约改了这里会红，不会悄悄漂移。
 */
export const CONCLUSION_MAX_LENGTH = 4000;
export const OBJECTIVE_MAX_LENGTH = 4000;
export const REASON_MAX_LENGTH = 500;
export const TEAM_OR_ROLE_MAX_LENGTH = 200;
export const RESOURCE_DESCRIPTION_MAX_LENGTH = 2000;
export const NEXT_DECISION_QUESTION_MAX_LENGTH = 1000;
export const VALIDATION_FOCUS_MAX_LENGTH = 2000;
export const NEGATIVE_CONSERVATIVE_REASON_MAX_LENGTH = 2000;

export const UNIT_ECONOMICS_SCENARIOS = [
  { code: "baseline", label: "基准情景" },
  { code: "conservative", label: "保守情景" },
] as const;

export const UNIT_ECONOMICS_FIELDS = [
  { code: "salePrice", label: "销售价" },
  { code: "landedCost", label: "落地成本" },
  { code: "platformFee", label: "平台费" },
  { code: "fulfillmentFee", label: "履约费" },
  { code: "advertisingCost", label: "广告成本" },
  { code: "returnCost", label: "退货成本" },
] as const;

export type UnitEconomicsScenarioCode =
  (typeof UNIT_ECONOMICS_SCENARIOS)[number]["code"];
export type UnitEconomicsFieldCode =
  (typeof UNIT_ECONOMICS_FIELDS)[number]["code"];

export interface UnitEconomicsRangeDraftState {
  min: string;
  max: string;
  basis: ProductInitiativeUnitEconomicsBasisV1 | "";
  evidenceRefs: string[];
}

export interface UnitEconomicsDraftState {
  currencyCode: string;
  scenarios: Record<
    UnitEconomicsScenarioCode,
    Record<UnitEconomicsFieldCode, UnitEconomicsRangeDraftState>
  >;
}

export interface UnitEconomicsRangeChange {
  scenario: UnitEconomicsScenarioCode;
  field: UnitEconomicsFieldCode;
  endpoint: "min" | "max";
  value: string;
}

export interface UnitEconomicsBasisChange {
  scenario: UnitEconomicsScenarioCode;
  field: UnitEconomicsFieldCode;
  basis: ProductInitiativeUnitEconomicsBasisV1 | "";
}

export interface UnitEconomicsEvidenceChange {
  scenario: UnitEconomicsScenarioCode;
  field: UnitEconomicsFieldCode;
  evidenceId: string;
}

export interface ProductInitiativeEvidenceDraft {
  sourceName: string;
  sourceUrl: string;
  content: string;
}

/**
 * 评审要点草稿：事实由引用的证据呈现，因此这里只有引用与结论。
 * 缺任一项都算这条要点没成立 —— 与服务端的判定口径保持一致。
 */
interface ReviewPointDraft {
  evidenceRefs: string[];
  conclusion: string;
}

/**
 * 一处立项缺口。**必须带上"在哪补"** —— 缺的两类东西在两个不同的面板里：
 * 「目标结果」是动作面板里的输入框，评审要点在另一个面板。
 * 只说"还差 N 项"、或者一句话把全部缺口指去同一个面板，人就会在错的地方找。
 */
export type ProductInitiativeGapPanel =
  | "objective"
  | "responsibility_resources"
  | "timeline_decision"
  | "review_points"
  | "unit_economics";

export interface ProductInitiativeGap {
  label: string;
  panel: ProductInitiativeGapPanel;
}

export interface ProductInitiativeGapGroup {
  panel: ProductInitiativeGapPanel;
  label: string;
  count: number;
}

const GAP_GROUP_ORDER: readonly Omit<ProductInitiativeGapGroup, "count">[] = [
  { panel: "objective", label: "目标结果" },
  { panel: "responsibility_resources", label: "责任与资源" },
  { panel: "timeline_decision", label: "时间与下一决策" },
  { panel: "review_points", label: "评审依据" },
  { panel: "unit_economics", label: "单位经济" },
];

/** 交给面板渲染的只读视图；`missing` 由本模块唯一计算，面板不重复判定。 */
export interface ProductInitiativeReviewPointView {
  code: ProductInitiativeReviewPointCodeV1;
  label: string;
  evidenceRefs: readonly string[];
  conclusion: string;
  missing: boolean;
}

export function reviewPointMissing(draft: ReviewPointDraft): boolean {
  return draft.evidenceRefs.length === 0 || !draft.conclusion.trim();
}

export function useProductInitiativeDecision(options: {
  handoffId: MaybeRefOrGetter<string>;
  signalId: MaybeRefOrGetter<string>;
  marketCode?: MaybeRefOrGetter<string | null | undefined>;
  channelCode?: MaybeRefOrGetter<string | null | undefined>;
}) {
  const detail = shallowRef<ProductInitiativeDetailV1 | null>(null);
  const loading = shallowRef(false);
  const saving = shallowRef(false);
  const error = shallowRef<string | null>(null);
  const receipt = shallowRef<string | null>(null);
  const objective = shallowRef("");
  const destination = shallowRef<ProductInitiativeOutcome>("approve");
  const deferReason = shallowRef("");
  const acceptResponsibility = shallowRef(false);
  const receivingTeamOrRole = shallowRef("");
  const resourceDescription = shallowRef("");
  const targetDate = shallowRef("");
  const nextDecisionDate = shallowRef("");
  const nextDecisionQuestion = shallowRef("");
  const reconsiderationDate = shallowRef("");
  const rejectReason = shallowRef("");
  const returnReason = shallowRef("");
  const returnBasis = shallowRef<ProductInitiativeReturnBasisV1 | "">("");
  const unitEconomicsDraft = reactive<UnitEconomicsDraftState>(
    emptyUnitEconomicsDraft(),
  );
  const negativeConservativeReason = shallowRef("");
  const unitEconomicsDirty = shallowRef(false);
  const serverUnitEconomicsPending = shallowRef<Set<string>>(new Set());
  const points = reactive<
    Record<ProductInitiativeReviewPointCodeV1, ReviewPointDraft>
  >({
    target_user_and_market: { evidenceRefs: [], conclusion: "" },
    competitive_supply: { evidenceRefs: [], conclusion: "" },
    price_band_and_margin: { evidenceRefs: [], conclusion: "" },
    compliance_risk: { evidenceRefs: [], conclusion: "" },
    customer_feedback: { evidenceRefs: [], conclusion: "" },
  });
  const businessCase = reactive<
    Record<ProductInitiativeBusinessCaseDimensionCodeV1, BusinessCaseDraftState>
  >({
    customer_need: emptyBusinessCaseDimension(),
    value_differentiation: emptyBusinessCaseDimension(),
    commercial_viability: emptyBusinessCaseDimension(),
    supply_technical_feasibility: emptyBusinessCaseDimension(),
    strategy_portfolio: emptyBusinessCaseDimension(),
  });
  const riskAssessment = reactive<
    Record<ProductInitiativeRiskCodeV1, ProductInitiativeRiskAssessmentDraftV1>
  >(
    Object.fromEntries(
      RISK_ASSESSMENTS.map(({ code }) => [code, emptyRiskAssessment(code)]),
    ) as Record<
      ProductInitiativeRiskCodeV1,
      ProductInitiativeRiskAssessmentDraftV1
    >,
  );
  const touchedRiskCodes = new Set<ProductInitiativeRiskCodeV1>();

  // 三个带原因的去向各存各的：来回切换时已写了一半的依据不该被清掉，
  // 也不该把暂缓的理由带到退回里。
  const REASON_FIELDS = {
    defer: deferReason,
    reject: rejectReason,
    return_to_market: returnReason,
  } as const;
  /** 当前去向要写的原因；立项不需要原因，读出来是空串。 */
  const currentReason = computed({
    get: () => {
      const chosen = destination.value;
      return chosen === "approve" ? "" : REASON_FIELDS[chosen].value;
    },
    set: (value: string) => {
      const chosen = destination.value;
      if (chosen !== "approve") REASON_FIELDS[chosen].value = value;
    },
  });
  /** 去向也由服务端事实决定：已记过暂缓就不该一进来显示成立项。 */
  function setDestination(next: ProductInitiativeOutcome): void {
    destination.value = next;
  }

  const evidenceCandidates = computed(
    () => detail.value?.evidenceCandidates ?? [],
  );
  const currencyOptions = computed(() => detail.value?.currencyOptions ?? []);
  const initiative = computed(() => detail.value?.initiative ?? null);
  const marketCode = computed(() => toValue(options.marketCode) ?? "");
  const channelCode = computed(() => toValue(options.channelCode) ?? "");
  const unitEconomicsSnapshot =
    computed<ProductInitiativeUnitEconomicsSnapshotV1 | null>(() =>
      unitEconomicsDirty.value
        ? null
        : (initiative.value?.unitEconomicsSnapshot ?? null),
    );
  const negativeContributionNeedsReason = computed(
    () =>
      serverUnitEconomicsPending.value.has("negativeConservativeReason") ||
      isNegativeContribution(unitEconomicsSnapshot.value),
  );
  const legacyReadOnly = computed(() => {
    const current = initiative.value;
    return (
      current?.completion === "completed" &&
      (current.currentDestination === "rejected" ||
        current.currentDestination === "deferred") &&
      Array.isArray(current.riskAssessmentDraft) &&
      current.riskAssessmentDraft.length === 0 &&
      current.riskAssessmentSnapshot === null &&
      !RISK_ASSESSMENTS.some(({ code }) =>
        current.pendingFieldCodes.includes(`risk.${code}`),
      )
    );
  });
  const decided = computed(
    () =>
      initiative.value?.currentDestination === "handed_off" ||
      initiative.value?.currentDestination === "return_requested" ||
      legacyReadOnly.value,
  );
  const returnPending = computed(
    () => initiative.value?.currentDestination === "return_requested",
  );

  const reviewPointViews = computed<ProductInitiativeReviewPointView[]>(() =>
    REVIEW_POINTS.map((point) => ({
      code: point.code,
      label: point.label,
      evidenceRefs: points[point.code].evidenceRefs,
      conclusion: points[point.code].conclusion,
      missing: reviewPointMissing(points[point.code]),
    })),
  );
  const businessCaseViews = computed<BusinessCaseDimensionView[]>(() =>
    BUSINESS_CASE_DIMENSIONS.map(({ code, label }) => ({
      code,
      label,
      ...businessCase[code],
      missing:
        !businessCase[code].decision ||
        !businessCase[code].conclusion.trim() ||
        !businessCase[code].evidenceRefs.length ||
        businessCase[code].decision !== "supports_investment",
    })),
  );
  const riskAssessmentViews = computed<RiskAssessmentView[]>(() =>
    RISK_ASSESSMENTS.map(({ code, label }) => ({
      ...riskAssessment[code],
      label,
      missing:
        riskAssessment[code].applicability === "undetermined" ||
        (riskAssessment[code].applicability === "not_applicable" &&
          !riskAssessment[code].applicabilityReason?.trim()) ||
        (riskAssessment[code].applicability === "applicable" &&
          (riskAssessment[code].investmentDecision !== "supports_investment" ||
            !riskAssessment[code].conclusion?.trim() ||
            !riskAssessment[code].evidenceRefs.length)),
    })),
  );

  const commitmentRequirements = computed(() => [
    {
      label: "目标结果",
      panel: "objective" as const,
      missing: !objective.value.trim(),
    },
    {
      label: "由我对此立项负责",
      panel: "responsibility_resources" as const,
      missing: !acceptResponsibility.value,
    },
    {
      label: "承接团队或岗位",
      panel: "responsibility_resources" as const,
      missing: !receivingTeamOrRole.value.trim(),
    },
    {
      label: "资源说明",
      panel: "responsibility_resources" as const,
      missing: !resourceDescription.value.trim(),
    },
    {
      label: "目标日期",
      panel: "timeline_decision" as const,
      missing: !targetDate.value,
    },
    {
      label: "下一决策日期",
      panel: "timeline_decision" as const,
      missing: !nextDecisionDate.value,
    },
    {
      label: "下一决策问题",
      panel: "timeline_decision" as const,
      missing: !nextDecisionQuestion.value.trim(),
    },
  ]);

  const unitEconomicsGapCodes = computed(() => {
    const gaps = new Set<string>();
    if (!marketCode.value) gaps.add("unitEconomics.marketCode");
    if (!channelCode.value) gaps.add("unitEconomics.channelCode");
    if (!unitEconomicsDraft.currencyCode) {
      gaps.add("unitEconomics.currencyCode");
    }
    for (const scenario of UNIT_ECONOMICS_SCENARIOS) {
      for (const field of UNIT_ECONOMICS_FIELDS) {
        const range = unitEconomicsDraft.scenarios[scenario.code][field.code];
        const path = `unitEconomics.scenarios.${scenario.code}.${field.code}`;
        if (!range.min.trim()) gaps.add(`${path}.min`);
        if (!range.max.trim()) gaps.add(`${path}.max`);
        if (!range.basis) gaps.add(`${path}.basis`);
        if (
          !range.basis ||
          (range.basis === "evidence" && range.evidenceRefs.length === 0)
        ) {
          gaps.add(`${path}.evidenceRefs`);
        }
      }
    }
    for (const code of serverUnitEconomicsPending.value) gaps.add(code);
    if (
      gaps.has("negativeConservativeReason") &&
      negativeConservativeReason.value.trim()
    ) {
      gaps.delete("negativeConservativeReason");
    }
    return [...gaps];
  });

  /** 岗位只处理五类业务区域；精确字段码继续留在 blockingGaps 给服务端错误与定位。 */
  const requiredCount = computed(() => GAP_GROUP_ORDER.length);
  const blockingGaps = computed<ProductInitiativeGap[]>(() => [
    ...commitmentRequirements.value
      .filter((requirement) => requirement.missing)
      .map(({ label, panel }) => ({ label, panel })),
    ...businessCaseViews.value
      .filter((point) => point.missing)
      .map((point) => ({
        label: point.label,
        panel: "review_points" as const,
      })),
    ...riskAssessmentViews.value
      .filter((risk) => risk.missing)
      .map((risk) => ({
        label: `${risk.label}风险`,
        panel: "review_points" as const,
      })),
    ...unitEconomicsGapCodes.value.map((code) => ({
      label: unitEconomicsGapLabel(code),
      panel: "unit_economics" as const,
    })),
  ]);
  const blockingGapGroups = computed<ProductInitiativeGapGroup[]>(() => {
    const counts = new Map<ProductInitiativeGapPanel, number>();
    for (const gap of blockingGaps.value) {
      counts.set(gap.panel, (counts.get(gap.panel) ?? 0) + 1);
    }
    return GAP_GROUP_ORDER.flatMap((group) => {
      const count = counts.get(group.panel) ?? 0;
      return count > 0 ? [{ ...group, count }] : [];
    });
  });
  const optionalGaps = computed<string[]>(() => []);
  const canApprove = computed(() => blockingGaps.value.length === 0);

  // 换一条机会就要重读那一条的立项判断；只看 handoffId，不沿用上一条的草稿。
  // 立即执行的那一次发生在 setup 期间，所以 loadToken 必须先于本行初始化。
  let loadToken = 0;
  watch(
    () => toValue(options.handoffId),
    () => void load(),
    { immediate: true },
  );

  /**
   * 只允许最后一次请求写结果：队列是一列按钮，连点两条机会很常见，
   * 先发的请求后返回会把已经切走的那条机会的判断盖回来。
   */

  /**
   * `keepDraft` 用于"登记证据后刷新候选"这类刷新：候选要更新，
   * 但人还没保存的结论与目标结果不能被服务端的旧值悄悄盖掉。
   */
  async function load(options_?: { keepDraft?: boolean }): Promise<void> {
    const handoffId = toValue(options.handoffId);
    const token = ++loadToken;
    if (!handoffId) {
      reset();
      return;
    }
    if (detail.value?.handoffId !== handoffId) reset();
    loading.value = true;
    error.value = null;
    try {
      const loaded = await getProductInitiative(handoffId);
      if (token !== loadToken) return;
      if (loaded.handoffId !== handoffId) {
        detail.value = null;
        error.value = "读取到的立项判断与当前机会不一致，请重新加载。";
        return;
      }
      detail.value = loaded;
      if (!options_?.keepDraft) hydrate(loaded);
    } catch (caught) {
      if (token !== loadToken) return;
      error.value = initiativeErrorMessage(message(caught));
      detail.value = null;
    } finally {
      if (token === loadToken) loading.value = false;
    }
  }

  /** 没有可读的机会时清空草稿，避免把上一条的引用、原因和去向留给下一条。 */
  function reset(): void {
    detail.value = null;
    objective.value = "";
    destination.value = "approve";
    deferReason.value = "";
    acceptResponsibility.value = false;
    receivingTeamOrRole.value = "";
    resourceDescription.value = "";
    targetDate.value = "";
    nextDecisionDate.value = "";
    nextDecisionQuestion.value = "";
    reconsiderationDate.value = "";
    rejectReason.value = "";
    returnReason.value = "";
    returnBasis.value = "";
    Object.assign(unitEconomicsDraft, emptyUnitEconomicsDraft());
    negativeConservativeReason.value = "";
    unitEconomicsDirty.value = false;
    serverUnitEconomicsPending.value = new Set();
    for (const point of REVIEW_POINTS) {
      points[point.code] = { evidenceRefs: [], conclusion: "" };
    }
    for (const { code } of BUSINESS_CASE_DIMENSIONS)
      businessCase[code] = emptyBusinessCaseDimension();
  }

  /**
   * 用服务端已有判断回填草稿，刷新或换班后接着补。
   *
   * 去向与原因同样要回填：只回填要点不回填去向，会让人以为还没判断过，
   * 再点一次"暂缓"且不写原因，就把上次记下的原因连同关闭状态一起抹掉了
   * —— 服务端 `reason` 是整体覆盖写入，没有历史可恢复。
   */
  function hydrate(loaded: ProductInitiativeDetailV1): void {
    const saved = loaded.initiative;
    objective.value = saved?.objective ?? "";
    // `returned_from_npi` 不是选品决定去向，不能回填进决定草稿。
    const outcome = saved?.outcome;
    destination.value =
      outcome === "approve" ||
      outcome === "defer" ||
      outcome === "reject" ||
      outcome === "return_to_market"
        ? outcome
        : "approve";
    deferReason.value =
      saved?.outcome === "defer"
        ? (saved.validationFocus ?? saved.reason ?? "")
        : "";
    acceptResponsibility.value = saved?.responsibilityAccepted ?? false;
    receivingTeamOrRole.value = saved?.receivingTeamOrRole ?? "";
    resourceDescription.value = saved?.resourceDescription ?? "";
    targetDate.value = saved?.targetDate ?? "";
    nextDecisionDate.value = saved?.nextDecisionDate ?? "";
    nextDecisionQuestion.value = saved?.nextDecisionQuestion ?? "";
    reconsiderationDate.value = saved?.reconsiderationDate ?? "";
    rejectReason.value =
      saved?.outcome === "reject" ? (saved.reason ?? "") : "";
    returnReason.value =
      saved?.outcome === "return_to_market" ? (saved.reason ?? "") : "";
    returnBasis.value =
      saved?.outcome === "return_to_market" ? (saved.returnBasis ?? "") : "";
    Object.assign(
      unitEconomicsDraft,
      unitEconomicsDraftFrom(saved?.unitEconomicsDraft ?? null),
    );
    negativeConservativeReason.value = saved?.negativeConservativeReason ?? "";
    unitEconomicsDirty.value = false;
    serverUnitEconomicsPending.value = new Set(
      (saved?.pendingFieldCodes ?? []).filter(isUnitEconomicsPendingCode),
    );
    for (const point of REVIEW_POINTS) {
      const savedPoint = saved?.reviewPoints.find(
        (item) => item.code === point.code,
      );
      points[point.code] = {
        evidenceRefs: [...(savedPoint?.evidenceRefs ?? [])],
        conclusion: savedPoint?.conclusion ?? "",
      };
    }
    for (const { code } of BUSINESS_CASE_DIMENSIONS) {
      const savedPoint = saved?.businessCaseDraft?.find(
        (item) => item.dimensionCode === code,
      );
      businessCase[code] = {
        decision: savedPoint?.decision ?? "",
        conclusion: savedPoint?.conclusion ?? "",
        evidenceRefs: [...(savedPoint?.evidenceRefs ?? [])],
        criticalUnknown: savedPoint?.criticalUnknown ?? "",
      };
    }
    for (const { code } of RISK_ASSESSMENTS) {
      const savedRisk = saved?.riskAssessmentDraft?.find(
        (item) => item.riskCode === code,
      );
      Object.assign(
        riskAssessment[code],
        savedRisk ?? emptyRiskAssessment(code),
      );
      if (savedRisk) touchedRiskCodes.add(code);
      else touchedRiskCodes.delete(code);
    }
  }

  function updateRisk(
    code: ProductInitiativeRiskCodeV1,
    patch: Partial<ProductInitiativeRiskAssessmentDraftV1>,
  ): void {
    touchedRiskCodes.add(code);
    Object.assign(riskAssessment[code], patch);
  }

  /** 勾选/取消引用一条已登记证据。 */
  function toggleEvidence(
    code: ProductInitiativeReviewPointCodeV1,
    evidenceId: string,
  ): void {
    const draft = points[code];
    draft.evidenceRefs = draft.evidenceRefs.includes(evidenceId)
      ? draft.evidenceRefs.filter((id) => id !== evidenceId)
      : [...draft.evidenceRefs, evidenceId];
  }

  function setUnitEconomicsCurrency(value: string): void {
    unitEconomicsDraft.currencyCode = value;
    markUnitEconomicsChanged("unitEconomics.currencyCode");
  }

  function setUnitEconomicsRangeValue(
    scenario: UnitEconomicsScenarioCode,
    field: UnitEconomicsFieldCode,
    endpoint: "min" | "max",
    value: string,
  ): void {
    unitEconomicsDraft.scenarios[scenario][field][endpoint] = value;
    markUnitEconomicsChanged(
      `unitEconomics.scenarios.${scenario}.${field}.${endpoint}`,
    );
  }

  function setUnitEconomicsBasis(
    scenario: UnitEconomicsScenarioCode,
    field: UnitEconomicsFieldCode,
    basis: ProductInitiativeUnitEconomicsBasisV1 | "",
  ): void {
    const range = unitEconomicsDraft.scenarios[scenario][field];
    range.basis = basis;
    if (basis !== "evidence") range.evidenceRefs = [];
    const path = `unitEconomics.scenarios.${scenario}.${field}`;
    markUnitEconomicsChanged(`${path}.basis`);
    if (basis === "assumption") removeServerPending(`${path}.evidenceRefs`);
  }

  function toggleUnitEconomicsEvidence(
    scenario: UnitEconomicsScenarioCode,
    field: UnitEconomicsFieldCode,
    evidenceId: string,
  ): void {
    const range = unitEconomicsDraft.scenarios[scenario][field];
    range.evidenceRefs = range.evidenceRefs.includes(evidenceId)
      ? range.evidenceRefs.filter((id) => id !== evidenceId)
      : [...range.evidenceRefs, evidenceId];
    markUnitEconomicsChanged(
      `unitEconomics.scenarios.${scenario}.${field}.evidenceRefs`,
    );
  }

  function setNegativeConservativeReason(value: string): void {
    negativeConservativeReason.value = value;
  }

  function markUnitEconomicsChanged(code: string): void {
    unitEconomicsDirty.value = true;
    removeServerPending(code);
    removeServerPending("negativeConservativeReason");
    negativeConservativeReason.value = "";
  }

  function removeServerPending(code: string): void {
    if (!serverUnitEconomicsPending.value.has(code)) return;
    const next = new Set(serverUnitEconomicsPending.value);
    next.delete(code);
    serverUnitEconomicsPending.value = next;
  }

  /** 登记一条新证据到来源信号；登完刷新候选，让它能被引用。 */
  async function addEvidence(
    draft: ProductInitiativeEvidenceDraft,
  ): Promise<boolean> {
    const content = draft.content.trim();
    if (saving.value || !content) return false;
    saving.value = true;
    error.value = null;
    receipt.value = null;
    try {
      await registerMarketSignalEvidence({
        signalId: toValue(options.signalId),
        sourceName: draft.sourceName.trim() || "业务人员补充",
        sourceUrl: draft.sourceUrl.trim(),
        content,
      });
      await load({ keepDraft: true });
      receipt.value = "已把新增证据登记到来源信号，可在要点里引用它。";
      return true;
    } catch (caught) {
      error.value = initiativeErrorMessage(message(caught));
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function decide(outcome?: ProductInitiativeOutcome): Promise<boolean> {
    if (saving.value || decided.value) return false;
    const chosen = outcome ?? destination.value;
    saving.value = true;
    error.value = null;
    receipt.value = null;
    const handoffId = toValue(options.handoffId);
    const expectedInitiativeVersion = initiative.value?.version ?? 0;
    try {
      const saved = await decideProductInitiative(handoffId, {
        contractVersion: "product-initiative-decision.v1",
        requestId: crypto.randomUUID(),
        outcome: chosen,
        expectedInitiativeVersion,
        idempotencyKey: `product-initiative-${chosen}:${handoffId}:${expectedInitiativeVersion}:${crypto.randomUUID()}`,
        ...(objective.value.trim()
          ? { objective: objective.value.trim() }
          : {}),
        reviewPoints: [],
        businessCaseDraft: BUSINESS_CASE_DIMENSIONS.map(({ code }) => ({
          dimensionCode: code,
          ...(businessCase[code].decision
            ? { decision: businessCase[code].decision }
            : {}),
          conclusion: businessCase[code].conclusion.trim() || null,
          evidenceRefs: businessCase[code].evidenceRefs,
          criticalUnknown: businessCase[code].criticalUnknown.trim() || null,
        })),
        riskAssessmentDraft: RISK_ASSESSMENTS.filter(({ code }) =>
          touchedRiskCodes.has(code),
        ).map(({ code }) => ({
          ...riskAssessment[code],
          applicabilityReason:
            riskAssessment[code].applicabilityReason?.trim() || null,
          conclusion: riskAssessment[code].conclusion?.trim() || null,
          criticalUnknown: riskAssessment[code].criticalUnknown?.trim() || null,
        })),
        ...(chosen === "defer" && deferReason.value.trim()
          ? { validationFocus: deferReason.value.trim() }
          : {}),
        ...(chosen === "defer" && reconsiderationDate.value
          ? { reconsiderationDate: reconsiderationDate.value }
          : {}),
        ...(chosen === "approve" && acceptResponsibility.value
          ? { acceptResponsibility: true as const }
          : {}),
        ...(chosen === "approve" && receivingTeamOrRole.value.trim()
          ? { receivingTeamOrRole: receivingTeamOrRole.value.trim() }
          : {}),
        ...(chosen === "approve" && resourceDescription.value.trim()
          ? { resourceDescription: resourceDescription.value.trim() }
          : {}),
        ...(chosen === "approve" && targetDate.value
          ? { targetDate: targetDate.value }
          : {}),
        ...(chosen === "approve" && nextDecisionDate.value
          ? { nextDecisionDate: nextDecisionDate.value }
          : {}),
        ...(chosen === "approve" && nextDecisionQuestion.value.trim()
          ? { nextDecisionQuestion: nextDecisionQuestion.value.trim() }
          : {}),
        ...(chosen === "reject" && rejectReason.value.trim()
          ? { rejectReason: rejectReason.value.trim() }
          : {}),
        ...(chosen === "return_to_market" && returnReason.value.trim()
          ? { returnReason: returnReason.value.trim() }
          : {}),
        ...(chosen === "return_to_market" && returnBasis.value
          ? { returnBasis: returnBasis.value }
          : {}),
        unitEconomicsDraft: serializeUnitEconomicsDraft(
          unitEconomicsDraft,
          channelCode.value,
        ),
        ...(negativeConservativeReason.value.trim()
          ? {
              negativeConservativeReason:
                negativeConservativeReason.value.trim(),
            }
          : {}),
      });
      // 成功后从服务端重读，不用前端临时状态冒充落库结果。
      await load();
      receipt.value =
        chosen === "return_to_market"
          ? saved.currentDestination === "return_requested"
            ? RECEIPTS.return_to_market
            : "已保存退回判断，尚未形成退回请求。"
          : chosen === "defer"
            ? saved.currentDestination === "deferred"
              ? RECEIPTS.defer
              : "已保存但仍待补验证重点或重判日期。"
            : RECEIPTS[chosen];
      return true;
    } catch (caught) {
      const raw = message(caught);
      rememberServerUnitEconomicsGaps(raw);
      // 冲突意味着别人已经改过这条机会：重读版本，别让人拿着旧版本反复撞同一堵墙。
      // 重读会清空 error，所以说明要放在重读之后写，否则冲突提示会被自己抹掉。
      if (raw.includes(VERSION_CONFLICT)) await load({ keepDraft: true });
      error.value = initiativeErrorMessage(raw);
      return false;
    } finally {
      saving.value = false;
    }
  }

  function rememberServerUnitEconomicsGaps(raw: string): void {
    const incomplete = raw.match(/PRODUCT_INITIATIVE_INCOMPLETE:\s*([^\r\n]+)/);
    if (!incomplete?.[1]) return;
    const next = new Set(serverUnitEconomicsPending.value);
    for (const code of incomplete[1].split(",")) {
      const normalized = code.trim();
      if (isUnitEconomicsPendingCode(normalized)) next.add(normalized);
    }
    serverUnitEconomicsPending.value = next;
  }

  return {
    detail,
    initiative,
    decided,
    legacyReadOnly,
    returnPending,
    evidenceCandidates,
    currencyOptions,
    marketCode,
    channelCode,
    unitEconomicsDraft,
    unitEconomicsSnapshot,
    negativeContributionNeedsReason,
    negativeConservativeReason,
    loading,
    saving,
    error,
    receipt,
    objective,
    acceptResponsibility,
    receivingTeamOrRole,
    resourceDescription,
    targetDate,
    nextDecisionDate,
    nextDecisionQuestion,
    reconsiderationDate,
    destination,
    returnBasis,
    currentReason,
    points,
    businessCase,
    businessCaseViews,
    riskAssessment,
    riskAssessmentViews,
    updateRisk,
    reviewPointViews,
    requiredCount,
    blockingGaps,
    blockingGapGroups,
    optionalGaps,
    canApprove,
    load,
    setDestination,
    toggleEvidence,
    setUnitEconomicsCurrency,
    setUnitEconomicsRangeValue,
    setUnitEconomicsBasis,
    toggleUnitEconomicsEvidence,
    setNegativeConservativeReason,
    addEvidence,
    decide,
  };
}

function emptyBusinessCaseDimension(): BusinessCaseDraftState {
  return {
    decision: "",
    conclusion: "",
    evidenceRefs: [],
    criticalUnknown: "",
  };
}

function emptyRiskAssessment(
  riskCode: ProductInitiativeRiskCodeV1,
): ProductInitiativeRiskAssessmentDraftV1 {
  return {
    riskCode,
    applicability: "undetermined",
    applicabilityReason: null,
    investmentDecision: null,
    conclusion: null,
    evidenceRefs: [],
    criticalUnknown: "",
  };
}

function emptyUnitEconomicsDraft(): UnitEconomicsDraftState {
  const range = (): UnitEconomicsRangeDraftState => ({
    min: "",
    max: "",
    basis: "",
    evidenceRefs: [],
  });
  return {
    currencyCode: "",
    scenarios: {
      baseline: {
        salePrice: range(),
        landedCost: range(),
        platformFee: range(),
        fulfillmentFee: range(),
        advertisingCost: range(),
        returnCost: range(),
      },
      conservative: {
        salePrice: range(),
        landedCost: range(),
        platformFee: range(),
        fulfillmentFee: range(),
        advertisingCost: range(),
        returnCost: range(),
      },
    },
  };
}

function unitEconomicsDraftFrom(
  source: ProductInitiativeUnitEconomicsDraftV1 | null,
): UnitEconomicsDraftState {
  const draft = emptyUnitEconomicsDraft();
  draft.currencyCode = source?.currencyCode ?? "";
  for (const scenario of UNIT_ECONOMICS_SCENARIOS) {
    for (const field of UNIT_ECONOMICS_FIELDS) {
      const saved = source?.scenarios?.[scenario.code]?.[field.code];
      draft.scenarios[scenario.code][field.code] = {
        min: saved?.min ?? "",
        max: saved?.max ?? "",
        basis: saved?.basis ?? "",
        evidenceRefs: [...(saved?.evidenceRefs ?? [])],
      };
    }
  }
  return draft;
}

function serializeUnitEconomicsDraft(
  state: UnitEconomicsDraftState,
  channelCode: string,
): ProductInitiativeUnitEconomicsDraftV1 {
  const scenarios: NonNullable<
    ProductInitiativeUnitEconomicsDraftV1["scenarios"]
  > = {};
  for (const scenario of UNIT_ECONOMICS_SCENARIOS) {
    const scenarioDraft: NonNullable<
      ProductInitiativeUnitEconomicsDraftV1["scenarios"]
    >[UnitEconomicsScenarioCode] = {};
    for (const field of UNIT_ECONOMICS_FIELDS) {
      const range = state.scenarios[scenario.code][field.code];
      if (
        !range.min.trim() &&
        !range.max.trim() &&
        !range.basis &&
        range.evidenceRefs.length === 0
      ) {
        continue;
      }
      scenarioDraft[field.code] = {
        ...(range.min.trim() ? { min: range.min.trim() } : {}),
        ...(range.max.trim() ? { max: range.max.trim() } : {}),
        ...(range.basis ? { basis: range.basis } : {}),
        ...(range.basis
          ? { evidenceRefs: [...range.evidenceRefs] }
          : range.evidenceRefs.length
            ? { evidenceRefs: [...range.evidenceRefs] }
            : {}),
      };
    }
    if (Object.keys(scenarioDraft).length > 0) {
      scenarios[scenario.code] = scenarioDraft;
    }
  }
  return {
    ...(channelCode ? { channelCode } : {}),
    ...(state.currencyCode ? { currencyCode: state.currencyCode } : {}),
    ...(Object.keys(scenarios).length > 0 ? { scenarios } : {}),
  };
}

function isUnitEconomicsPendingCode(code: string): boolean {
  return (
    code === "negativeConservativeReason" || code.startsWith("unitEconomics.")
  );
}

export function unitEconomicsGapLabel(code: string): string {
  if (code === "unitEconomics.marketCode") return "单位经济 · 市场";
  if (code === "unitEconomics.channelCode") return "单位经济 · 渠道";
  if (code === "unitEconomics.currencyCode") return "单位经济 · 币种";
  if (code === "negativeConservativeReason") {
    return "单位经济 · 仍要投入的理由";
  }
  const match = code.match(
    /^unitEconomics\.scenarios\.(baseline|conservative)\.([^.]+)\.(min|max|basis|evidenceRefs)$/,
  );
  if (!match) return code;
  const scenario = UNIT_ECONOMICS_SCENARIOS.find(
    (item) => item.code === match[1],
  )?.label;
  const field = UNIT_ECONOMICS_FIELDS.find(
    (item) => item.code === match[2],
  )?.label;
  const part = {
    min: "最低值",
    max: "最高值",
    basis: "依据类型",
    evidenceRefs: "证据引用",
  }[match[3] as "min" | "max" | "basis" | "evidenceRefs"];
  return `单位经济 · ${scenario ?? match[1]} · ${field ?? match[2]} · ${part}`;
}

function isNegativeContribution(
  snapshot: ProductInitiativeUnitEconomicsSnapshotV1 | null,
): boolean {
  return Boolean(
    snapshot &&
    /^-/.test(snapshot.scenarios.conservative.contribution.min.trim()),
  );
}

const RECEIPTS: Record<ProductInitiativeOutcome, string> = {
  approve: "已立项，并交给产品开发与 NPI 队列。",
  defer: "已暂缓，仍留在选品队列。",
  reject: "已记录不立项。",
  return_to_market: "已请求退回市场，等待市场接回。",
};

/**
 * 主动作旁边那句说明。必须随去向、缺口与原因变化 —— 写成快照字符串就会在
 * 负责人补完要点后仍声称"还差 N 项"，或在没填原因时冒充"已关闭"。
 */
export function outcomeHintFor(input: {
  outcome: ProductInitiativeOutcome;
  /** 只用到条数；缺口长什么样（带不带"在哪补"）不关这句话的事。 */
  gaps: { readonly length: number };
  reason: string;
  reconsiderationDate: string;
  returnBasis?: ProductInitiativeReturnBasisV1 | "";
}): string {
  if (input.outcome === "approve") {
    return input.gaps.length > 0
      ? `还差 ${input.gaps.length} 类才能立项`
      : "可以立项";
  }
  if (input.outcome === "return_to_market" && !input.returnBasis) {
    return "请选择退回依据";
  }
  if (input.outcome === "defer") {
    return input.reason.trim() && input.reconsiderationDate
      ? "验证重点和重判日期已齐，提交后本次判断会关闭。"
      : "验证重点或重判日期未齐，保存后仍是待补，不会关闭。";
  }
  return input.reason.trim()
    ? "已写明原因，提交后本次判断会关闭。"
    : "不填原因也可以先保存：本次判断会留在待补里，不会关闭。";
}

const VERSION_CONFLICT = "PRODUCT_INITIATIVE_VERSION_CONFLICT";

/**
 * 把服务端的稳定错误码翻成岗位能读懂的话。原样透传只会让人看到
 * `PRODUCT_INITIATIVE_VERSION_CONFLICT` 这种代号，既不知道发生了什么，
 * 也不知道该重试还是该换个做法。未知错误保持原文，不编造解释。
 */
export function initiativeErrorMessage(raw: string): string {
  const invalidEvidence = raw.match(
    /PRODUCT_INITIATIVE_EVIDENCE_INVALID:\s*([0-9a-f-]+(?:,[0-9a-f-]+)*)/i,
  );
  if (invalidEvidence?.[1]) {
    return `该证据不存在或不属于当前机会，请重新选择：${invalidEvidence[1]
      .split(",")
      .join("、")}`;
  }
  if (raw.includes(VERSION_CONFLICT)) {
    return "这条机会的立项判断已被其他人更新过。已重新读取最新版本，请核对后再提交。";
  }
  if (raw.includes("PRODUCT_INITIATIVE_ALREADY_APPROVED")) {
    return "这条机会已经立项，不能再改动判断；如需新版本，请走 NPI 侧。";
  }
  if (raw.includes("PRODUCT_INITIATIVE_NOT_ACCEPTED")) {
    return "这条机会尚未接受交接，不能形成立项判断。请先领取并接受。";
  }
  if (raw.includes("PRODUCT_INITIATIVE_RETURN_PENDING")) {
    return "这条机会正在等待市场接回，暂时不能再作其他判断。";
  }
  if (raw.includes("PRODUCT_INITIATIVE_LEGACY_READ_ONLY")) {
    return "这条历史立项判断只供查阅，不可改写。请重新读取当前记录。";
  }
  if (raw.includes("VALIDATION_FORMAT: businessCaseDraft.criticalUnknown")) {
    return "投入前需验证时请说明会使结论失效的关键未知；其余判断不要填写阻断未知。";
  }
  if (raw.includes("VALIDATION_FORMAT: businessCaseDraft.decision")) {
    return "投入前需验证的判断只能暂缓并继续验证，不能立项或不立项。";
  }
  const incomplete = raw.match(/PRODUCT_INITIATIVE_INCOMPLETE:\s*([^\r\n]+)/);
  if (incomplete?.[1]) {
    const labels = incomplete[1]
      .split(",")
      .map((code) => code.trim())
      .map((code) =>
        isUnitEconomicsPendingCode(code)
          ? unitEconomicsGapLabel(code)
          : (PENDING_LABELS[code] ?? code),
      );
    return "还不能立项，请补齐：" + labels.join("、");
  }
  if (raw.includes("REFERENCE_CURRENCY_RELEASE_UNAVAILABLE")) {
    return "币种参考数据未接通，当前无法保存单位经济。";
  }
  const unknownCurrency = raw.match(/CURRENCY_UNKNOWN:\s*([A-Z]{3})/);
  if (unknownCurrency?.[1]) {
    return "币种 " + unknownCurrency[1] + " 不在当前参考目录中，请重新选择。";
  }
  if (raw.includes("PRODUCT_INITIATIVE_OPPORTUNITY_NOT_FOUND")) {
    return "找不到这条机会的交接，可能已被新版替代。请回队列重新选择。";
  }
  return raw;
}

const PENDING_LABELS: Record<string, string> = {
  objective: "目标结果",
  customer_need: "客户与需求",
  value_differentiation: "价值与差异",
  commercial_viability: "商业可行性",
  supply_technical_feasibility: "供应与技术可行性",
  strategy_portfolio: "战略与组合",
  target_user_and_market: "目标用户与市场",
  competitive_supply: "竞争供给",
  price_band_and_margin: "价格带与利润",
  compliance_risk: "合规风险",
  responsibility_commitment: "由我对此立项负责",
  receiving_team_or_role: "承接团队或岗位",
  resource_description: "资源说明",
  target_date: "目标日期",
  next_decision_date: "下一决策日期",
  next_decision_question: "下一决策问题",
};

function message(error: unknown): string {
  return error instanceof Error ? error.message : "操作失败，请稍后重试";
}
