import type {
  ProductInitiativeDecisionCommandV1,
  ProductInitiativeDetailV1,
  ProductInitiativeReviewPointCodeV1,
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

/**
 * 评审要点。`gating` 表示**缺了它就不能立项**。
 *
 * 与**服务端 `PRODUCT_INITIATIVE_GATE` 是同一份口径，两处改动必须一起动**。
 * `customer_feedback` **不是门槛**：它由「售后原声」这类专业要求喂证据，
 * 缺了进待补但不挡立项 —— 把它加成第 5 项门槛，会让存量记录追溯性变成不合格。
 */
export const REVIEW_POINTS = [
  { code: "target_user_and_market", label: "目标用户与市场", gating: true },
  { code: "competitive_supply", label: "竞争供给", gating: true },
  { code: "price_band_and_margin", label: "价格带与利润", gating: true },
  { code: "compliance_risk", label: "合规风险", gating: true },
  { code: "customer_feedback", label: "客户反馈与痛点", gating: false },
] as const satisfies readonly {
  code: ProductInitiativeReviewPointCodeV1;
  label: string;
  gating: boolean;
}[];

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
export interface ProductInitiativeGap {
  label: string;
  panel: "objective" | "review_points";
}

/** 交给面板渲染的只读视图；`missing` 由本模块唯一计算，面板不重复判定。 */
export interface ProductInitiativeReviewPointView {
  code: ProductInitiativeReviewPointCodeV1;
  label: string;
  evidenceRefs: readonly string[];
  conclusion: string;
  missing: boolean;
  /** 缺了它能不能立项。非门槛的缺了只提示，不挡。 */
  gating: boolean;
}

/**
 * 一条评审要点算不算成立。服务端 `productInitiativePendingFieldCodes` 用同一口径
 * （有结论没证据、或有证据没结论都不算成立），改动时两边必须一起动。
 */
export function reviewPointMissing(draft: ReviewPointDraft): boolean {
  return draft.evidenceRefs.length === 0 || !draft.conclusion.trim();
}

export function useProductInitiativeDecision(options: {
  handoffId: MaybeRefOrGetter<string>;
  signalId: MaybeRefOrGetter<string>;
}) {
  const detail = shallowRef<ProductInitiativeDetailV1 | null>(null);
  const loading = shallowRef(false);
  const saving = shallowRef(false);
  const error = shallowRef<string | null>(null);
  const receipt = shallowRef<string | null>(null);
  const objective = shallowRef("");
  const destination = shallowRef<ProductInitiativeOutcome>("approve");
  const deferReason = shallowRef("");
  const rejectReason = shallowRef("");
  const returnReason = shallowRef("");
  const points = reactive<
    Record<ProductInitiativeReviewPointCodeV1, ReviewPointDraft>
  >({
    target_user_and_market: { evidenceRefs: [], conclusion: "" },
    competitive_supply: { evidenceRefs: [], conclusion: "" },
    price_band_and_margin: { evidenceRefs: [], conclusion: "" },
    compliance_risk: { evidenceRefs: [], conclusion: "" },
    customer_feedback: { evidenceRefs: [], conclusion: "" },
  });

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
  const initiative = computed(() => detail.value?.initiative ?? null);
  /** 已立项就是终态，界面不再提供任何判断动作。 */
  const decided = computed(
    () => initiative.value?.currentDestination === "handed_off",
  );

  /** 四项要点的只读视图：缺口判定只在这里做一次，面板与按钮都读同一份。 */
  const reviewPointViews = computed<ProductInitiativeReviewPointView[]>(() =>
    REVIEW_POINTS.map((point) => ({
      code: point.code,
      label: point.label,
      evidenceRefs: points[point.code].evidenceRefs,
      conclusion: points[point.code].conclusion,
      missing: reviewPointMissing(points[point.code]),
      gating: point.gating,
    })),
  );

  /** 挡住立项的缺口：目标结果 + **门槛**要点。 */
  const blockingGaps = computed<ProductInitiativeGap[]>(() => {
    const missing: ProductInitiativeGap[] = [];
    if (!objective.value.trim()) {
      missing.push({ label: "目标结果", panel: "objective" });
    }
    for (const point of reviewPointViews.value) {
      if (point.missing && point.gating) {
        missing.push({ label: point.label, panel: "review_points" });
      }
    }
    return missing;
  });
  /**
   * 不挡立项、但补了更扎实的要点。**单独列出来**，不混进"还差 N 项" ——
   * 混进去会让人以为非补不可，而那正是"证据收了没地方下结论"要修的另一半。
   */
  const optionalGaps = computed<string[]>(() =>
    reviewPointViews.value
      .filter((point) => point.missing && !point.gating)
      .map((point) => point.label),
  );
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
    loading.value = true;
    error.value = null;
    try {
      const loaded = await getProductInitiative(handoffId);
      if (token !== loadToken) return;
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
    rejectReason.value = "";
    returnReason.value = "";
    for (const point of REVIEW_POINTS) {
      points[point.code] = { evidenceRefs: [], conclusion: "" };
    }
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
    destination.value = saved?.outcome ?? "approve";
    deferReason.value = saved?.outcome === "defer" ? (saved.reason ?? "") : "";
    rejectReason.value =
      saved?.outcome === "reject" ? (saved.reason ?? "") : "";
    returnReason.value =
      saved?.outcome === "return_to_market" ? (saved.reason ?? "") : "";
    for (const point of REVIEW_POINTS) {
      const savedPoint = saved?.reviewPoints.find(
        (item) => item.code === point.code,
      );
      points[point.code] = {
        evidenceRefs: [...(savedPoint?.evidenceRefs ?? [])],
        conclusion: savedPoint?.conclusion ?? "",
      };
    }
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
    if (saving.value) return false;
    const chosen = outcome ?? destination.value;
    saving.value = true;
    error.value = null;
    receipt.value = null;
    const handoffId = toValue(options.handoffId);
    const expectedInitiativeVersion = initiative.value?.version ?? 0;
    try {
      await decideProductInitiative(handoffId, {
        contractVersion: "product-initiative-decision.v1",
        requestId: crypto.randomUUID(),
        outcome: chosen,
        expectedInitiativeVersion,
        idempotencyKey: `product-initiative-${chosen}:${handoffId}:${expectedInitiativeVersion}:${crypto.randomUUID()}`,
        ...(objective.value.trim()
          ? { objective: objective.value.trim() }
          : {}),
        reviewPoints: REVIEW_POINTS.map((point) => ({
          code: point.code,
          evidenceRefs: points[point.code].evidenceRefs,
          conclusion: points[point.code].conclusion.trim() || null,
        })),
        ...(chosen === "defer" && deferReason.value.trim()
          ? { deferReason: deferReason.value.trim() }
          : {}),
        ...(chosen === "reject" && rejectReason.value.trim()
          ? { rejectReason: rejectReason.value.trim() }
          : {}),
        ...(chosen === "return_to_market" && returnReason.value.trim()
          ? { returnReason: returnReason.value.trim() }
          : {}),
      });
      // 成功后从服务端重读，不用前端临时状态冒充落库结果。
      await load();
      receipt.value = RECEIPTS[chosen];
      return true;
    } catch (caught) {
      const raw = message(caught);
      // 冲突意味着别人已经改过这条机会：重读版本，别让人拿着旧版本反复撞同一堵墙。
      // 重读会清空 error，所以说明要放在重读之后写，否则冲突提示会被自己抹掉。
      if (raw.includes(VERSION_CONFLICT)) await load();
      error.value = initiativeErrorMessage(raw);
      return false;
    } finally {
      saving.value = false;
    }
  }

  return {
    detail,
    initiative,
    decided,
    evidenceCandidates,
    loading,
    saving,
    error,
    receipt,
    objective,
    destination,
    currentReason,
    points,
    reviewPointViews,
    blockingGaps,
    optionalGaps,
    canApprove,
    load,
    setDestination,
    toggleEvidence,
    addEvidence,
    decide,
  };
}

const RECEIPTS: Record<ProductInitiativeOutcome, string> = {
  approve: "已立项，并交给产品开发与 NPI 队列。",
  defer: "已暂缓，仍留在选品队列。",
  reject: "已记录不立项。",
  return_to_market: "已退回经营团队重新判断。",
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
}): string {
  if (input.outcome === "approve") {
    return input.gaps.length > 0
      ? `还差 ${input.gaps.length} 项才能立项`
      : "可以立项";
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
  if (raw.includes(VERSION_CONFLICT)) {
    return "这条机会的立项判断已被其他人更新过。已重新读取最新版本，请核对后再提交。";
  }
  if (raw.includes("PRODUCT_INITIATIVE_ALREADY_APPROVED")) {
    return "这条机会已经立项，不能再改动判断；如需新版本，请走 NPI 侧。";
  }
  if (raw.includes("PRODUCT_INITIATIVE_INCOMPLETE")) {
    return "评审要点或目标结果还没齐，不能立项；补齐后再提交。";
  }
  if (raw.includes("PRODUCT_INITIATIVE_OPPORTUNITY_NOT_FOUND")) {
    return "找不到这条机会的交接，可能已被新版替代。请回队列重新选择。";
  }
  return raw;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "操作失败，请稍后重试";
}
