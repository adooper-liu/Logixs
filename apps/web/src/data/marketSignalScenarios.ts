export type MarketSignalWorkflowState =
  | "needs_decision"
  | "watching"
  | "handed_off"
  | "dismissed"
  | "selection_return_requested"
  | "returned_from_selection"
  | "voided"
  | "archived";

export type MarketSignalDecision =
  "watch" | "handoff" | "dismiss" | "void" | "archive";

export type MarketSignalGapCode =
  | "market"
  | "channel"
  | "category"
  | "observed_fact"
  | "hypothesis"
  | "source_evidence"
  | "source_name";

export interface MarketSignalGap {
  code: MarketSignalGapCode;
  label: string;
  fieldLabel: string;
  inputKind: "text" | "textarea" | "evidence";
  placeholder: string;
}

export interface MarketSignalSupplement {
  id: string;
  gapCode: MarketSignalGapCode;
  label: string;
  content: string;
  sourceName: string | null;
  sourceUrl: string | null;
}

export interface MarketSignalSupplementDraft {
  gapCode: MarketSignalGapCode;
  content: string;
  sourceName: string;
  sourceUrl: string;
}

export interface MarketSignalEvidence {
  id: string;
  sourceName: string;
  observedAt: string;
  detail: string;
  previewText: string;
  sourceUrl: string | null;
  attachmentName: string | null;
}

export interface MarketSignalScenario {
  id: string;
  version: number;
  title: string;
  workReason: string;
  selectionReturnBasis?: "insufficient_evidence" | "wrong_direction" | null;
  selectionReturnReason?: string | null;
  urgency: "today" | "this_week" | "normal";
  urgencyLabel: string;
  market: string | null;
  channel: string | null;
  category: string | null;
  owner: string;
  activeValidation: null | {
    responsibleActorId: string;
    nextReviewDate: string;
    watchFocus: string | null;
    waitingReason: string | null;
  };
  observedFacts: readonly string[];
  hypothesis: string | null;
  evidence: readonly MarketSignalEvidence[];
  supplements: readonly MarketSignalSupplement[];
  gaps: readonly MarketSignalGap[];
  initialState: MarketSignalWorkflowState;
  /** 服务端 updatedAt；继续观察分组按它做同日检查的稳定次序。 */
  updatedAt: string;
}

/**
 * 与服务端 watching 列表同序：检查日升序、无检查日在后，同日按 updatedAt、id 倒序。
 * 只用于本地写入或改期后立即重排，不产生到期结论。
 */
export function compareWatchingOrder(
  left: Pick<MarketSignalScenario, "id" | "updatedAt" | "activeValidation">,
  right: Pick<MarketSignalScenario, "id" | "updatedAt" | "activeValidation">,
): number {
  const leftDue = left.activeValidation?.nextReviewDate ?? null;
  const rightDue = right.activeValidation?.nextReviewDate ?? null;
  if (leftDue !== rightDue) {
    if (leftDue === null) return 1;
    if (rightDue === null) return -1;
    return leftDue < rightDue ? -1 : 1;
  }
  if (left.updatedAt !== right.updatedAt) {
    return left.updatedAt < right.updatedAt ? 1 : -1;
  }
  if (left.id === right.id) return 0;
  return left.id < right.id ? 1 : -1;
}

export interface MarketSignalDecisionDraft {
  decision: MarketSignalDecision;
  judgmentNote: string;
  opportunityStatement: string;
  nextReviewDate: string;
  watchFocus: string;
  waitingReason: string;
  dismissReason: string;
}

export interface MarketSignalDecisionResult {
  decision: MarketSignalDecision;
  completion: "completed" | "pending_completion";
  statusLabel: string;
  message: string;
  nextOwner: string;
  pendingItems: readonly string[];
  handoffFacts: readonly string[];
}

export interface MarketSignalOperationReceipt {
  signalId: string;
  signalTitle: string;
  result: MarketSignalDecisionResult;
}

export interface ManualMarketSignalDraft {
  title: string;
  market: string;
  channel: string;
  category: string;
  observedFact: string;
  hypothesis: string;
  sourceName: string;
  sourceUrl: string;
}

export interface MarketSignalQueueItem extends MarketSignalScenario {
  workflowState: MarketSignalWorkflowState;
}

export function createMarketSignalDraft(): MarketSignalDecisionDraft {
  return {
    decision: "handoff",
    judgmentNote: "",
    opportunityStatement: "",
    nextReviewDate: "",
    watchFocus: "",
    waitingReason: "",
    dismissReason: "",
  };
}

export function buildMarketSignalResult(
  signal: MarketSignalScenario,
  draft: MarketSignalDecisionDraft,
): MarketSignalDecisionResult {
  const pendingItems = [
    ...signal.gaps.map((gap) => gap.label),
    ...(draft.decision === "handoff" && !draft.opportunityStatement.trim()
      ? ["机会说明待补"]
      : []),
  ];

  if (draft.decision === "watch") {
    const hasReviewDate = Boolean(draft.nextReviewDate);
    const hasFocus = Boolean(draft.watchFocus.trim());
    const completed = hasReviewDate && hasFocus;
    return {
      decision: draft.decision,
      completion: completed ? "completed" : "pending_completion",
      statusLabel: completed ? "已安排下一项验证" : "已保存，待补验证承诺",
      message: completed
        ? `由我负责，在 ${draft.nextReviewDate} 检查：${draft.watchFocus.trim()}`
        : "补充检查日期和验证重点后，才会形成当前验证承诺。",
      nextOwner: completed ? "我" : signal.owner,
      pendingItems: [
        ...pendingItems,
        ...(!hasReviewDate ? ["下次检查日期待补"] : []),
        ...(!hasFocus ? ["验证重点待补"] : []),
      ],
      handoffFacts: [],
    };
  }

  if (draft.decision === "dismiss") {
    const hasReason = Boolean(draft.dismissReason.trim());
    return {
      decision: draft.decision,
      completion: hasReason ? "completed" : "pending_completion",
      statusLabel: hasReason ? "已记录不采纳" : "已保存，待补不采纳原因",
      message: hasReason
        ? draft.dismissReason.trim()
        : "补充不采纳原因后，才会关闭这条信号。",
      nextOwner: signal.owner,
      pendingItems: [
        ...pendingItems,
        ...(!hasReason ? ["不采纳原因待补"] : []),
      ],
      handoffFacts: [],
    };
  }

  if (draft.decision === "void" || draft.decision === "archive") {
    const hasReason = Boolean(draft.judgmentNote.trim());
    const closing = draft.decision === "void" ? "作废" : "归档";
    return {
      decision: draft.decision,
      completion: hasReason ? "completed" : "pending_completion",
      statusLabel: hasReason ? `已${closing}` : `已保存，待补${closing}理由`,
      message: hasReason
        ? draft.judgmentNote.trim()
        : `补充${closing}理由后，信号才会离开在办队列。`,
      nextOwner: signal.owner,
      pendingItems: [
        ...pendingItems,
        ...(!hasReason ? [`${closing}理由待补`] : []),
      ],
      handoffFacts: [],
    };
  }

  return {
    decision: draft.decision,
    completion: "completed",
    statusLabel: "已交给选品团队队列",
    message: "下一步由选品人员领取并评估是否立项。",
    nextOwner: "选品团队（待领取）",
    pendingItems,
    handoffFacts: [
      [signal.market, signal.channel].filter(Boolean).join(" · ") ||
        "市场与渠道待补",
      `${signal.evidence.length} 项来源证据`,
      signal.hypothesis ? "经营假设已带入" : "经营假设待补",
    ],
  };
}

export function workflowStateForResult(
  result: MarketSignalDecisionResult,
): MarketSignalWorkflowState {
  if (result.completion === "pending_completion") return "needs_decision";
  if (result.decision === "watch") return "watching";
  if (result.decision === "dismiss") return "dismissed";
  if (result.decision === "void") return "voided";
  if (result.decision === "archive") return "archived";
  return "handed_off";
}

export function createManualMarketSignalDraft(): ManualMarketSignalDraft {
  return {
    title: "",
    market: "",
    channel: "",
    category: "",
    observedFact: "",
    hypothesis: "",
    sourceName: "",
    sourceUrl: "",
  };
}

export function marketSignalGap(code: MarketSignalGapCode): MarketSignalGap {
  switch (code) {
    case "market":
      return gap(
        code,
        "市场待补",
        "市场",
        "text",
        "填写实际销售市场，例如：加拿大",
      );
    case "channel":
      return gap(
        code,
        "渠道待补",
        "渠道",
        "text",
        "填写实际渠道，例如：Aosom.ca",
      );
    case "category":
      return gap(
        code,
        "商品类别待选择",
        "商品范围",
        "text",
        "填写或选择业务可识别的商品范围",
      );
    case "observed_fact":
      return gap(
        code,
        "观察事实待补",
        "观察到的事实",
        "textarea",
        "只写已经发生或已经观察到的变化",
      );
    case "hypothesis":
      return gap(
        code,
        "经营假设待补",
        "初步经营判断",
        "textarea",
        "说明可能意味着什么，暂时不当作事实",
      );
    case "source_evidence":
      return gap(
        code,
        "来源证据待补",
        "来源证据",
        "evidence",
        "摘录能支持这条信号的关键信息",
      );
    case "source_name":
      return gap(
        code,
        "来源名称待补",
        "来源名称",
        "text",
        "填写来源名称，例如：加拿大站客服周报",
      );
  }
}

function gap(
  code: MarketSignalGapCode,
  label: string,
  fieldLabel: string,
  inputKind: MarketSignalGap["inputKind"],
  placeholder: string,
): MarketSignalGap {
  return { code, label, fieldLabel, inputKind, placeholder };
}
