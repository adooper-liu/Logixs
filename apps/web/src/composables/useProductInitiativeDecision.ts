import type {
  ProductInitiativeDecisionCommandV1,
  ProductInitiativeDetailV1,
  ProductInitiativeReviewPointCodeV1,
} from "@logix/contracts";
import {
  computed,
  onMounted,
  reactive,
  shallowRef,
  toValue,
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
] as const satisfies readonly {
  code: ProductInitiativeReviewPointCodeV1;
  label: string;
}[];

export type ProductInitiativeOutcome =
  ProductInitiativeDecisionCommandV1["outcome"];

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

/** 交给面板渲染的只读视图；`missing` 由本模块唯一计算，面板不重复判定。 */
export interface ProductInitiativeReviewPointView {
  code: ProductInitiativeReviewPointCodeV1;
  label: string;
  evidenceRefs: readonly string[];
  conclusion: string;
  missing: boolean;
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
  });

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
    })),
  );

  /** 还差哪些才算能立项；按钮文案与缺口清单都读它。 */
  const blockingGaps = computed<string[]>(() => {
    const missing: string[] = [];
    if (!objective.value.trim()) missing.push("目标结果");
    for (const point of reviewPointViews.value) {
      if (point.missing) missing.push(point.label);
    }
    return missing;
  });
  const canApprove = computed(() => blockingGaps.value.length === 0);

  onMounted(load);

  async function load(): Promise<void> {
    const handoffId = toValue(options.handoffId);
    if (!handoffId) return;
    loading.value = true;
    error.value = null;
    try {
      const loaded = await getProductInitiative(handoffId);
      detail.value = loaded;
      hydrate(loaded);
    } catch (caught) {
      error.value = message(caught);
      detail.value = null;
    } finally {
      loading.value = false;
    }
  }

  /** 用服务端已有判断回填草稿，刷新或换班后接着补。 */
  function hydrate(loaded: ProductInitiativeDetailV1): void {
    objective.value = loaded.initiative?.objective ?? "";
    for (const point of REVIEW_POINTS) {
      const saved = loaded.initiative?.reviewPoints.find(
        (item) => item.code === point.code,
      );
      points[point.code] = {
        evidenceRefs: [...(saved?.evidenceRefs ?? [])],
        conclusion: saved?.conclusion ?? "",
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

  /** 登记一条新证据到来源信号；登完重新加载，让它出现在候选里。 */
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
      await load();
      receipt.value = "已把新增证据登记到来源信号，可在要点里引用它。";
      return true;
    } catch (caught) {
      error.value = message(caught);
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function decide(outcome: ProductInitiativeOutcome): Promise<boolean> {
    if (saving.value) return false;
    saving.value = true;
    error.value = null;
    receipt.value = null;
    const handoffId = toValue(options.handoffId);
    const expectedInitiativeVersion = initiative.value?.version ?? 0;
    try {
      await decideProductInitiative(handoffId, {
        contractVersion: "product-initiative-decision.v1",
        requestId: crypto.randomUUID(),
        outcome,
        expectedInitiativeVersion,
        idempotencyKey: `product-initiative-${outcome}:${handoffId}:${expectedInitiativeVersion}:${crypto.randomUUID()}`,
        ...(objective.value.trim()
          ? { objective: objective.value.trim() }
          : {}),
        reviewPoints: REVIEW_POINTS.map((point) => ({
          code: point.code,
          evidenceRefs: points[point.code].evidenceRefs,
          conclusion: points[point.code].conclusion.trim() || null,
        })),
        ...(outcome === "defer" && deferReason.value.trim()
          ? { deferReason: deferReason.value.trim() }
          : {}),
        ...(outcome === "reject" && rejectReason.value.trim()
          ? { rejectReason: rejectReason.value.trim() }
          : {}),
        ...(outcome === "return_to_market" && returnReason.value.trim()
          ? { returnReason: returnReason.value.trim() }
          : {}),
      });
      // 成功后从服务端重读，不用前端临时状态冒充落库结果。
      await load();
      receipt.value = RECEIPTS[outcome];
      return true;
    } catch (caught) {
      error.value = message(caught);
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
    deferReason,
    rejectReason,
    returnReason,
    points,
    reviewPointViews,
    blockingGaps,
    canApprove,
    load,
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
  gaps: readonly string[];
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

function message(error: unknown): string {
  return error instanceof Error ? error.message : "操作失败，请稍后重试";
}
