import type {
  MarketOpportunityHandoffV1,
  MarketSignalPendingFieldCodeV1,
} from "@logix/contracts";

/** 信号当前态中可用于合并的字段（不含改写快照行）。 */
export interface SignalLiveFields {
  marketCode: string | null;
  channelCode: string | null;
  categoryRef: string | null;
  observedFactSummary: string | null;
  hypothesis: string | null;
  evidenceRefs: readonly string[];
}

export interface MergedHandoffDisplay {
  /** 选品默认视图：快照 ∪ 信号后补 */
  display: MarketOpportunityHandoffV1;
  /** 相对快照有后补的字段码 */
  supplementedFieldCodes: MarketSignalPendingFieldCodeV1[];
}

function filled(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function pickText(
  snapshot: string | null | undefined,
  live: string | null | undefined,
): { value: string | null; supplemented: boolean } {
  if (filled(snapshot)) return { value: snapshot, supplemented: false };
  if (filled(live)) return { value: live.trim(), supplemented: true };
  return { value: snapshot ?? null, supplemented: false };
}

/**
 * 方案 A：快照行语义保留在入参 handoff；返回的 display 是工作视图。
 * 仅当快照为空/缺且信号当前有值时，用信号值并记入 supplementedFieldCodes。
 */
export function mergeHandoffWithSignalLive(
  handoff: MarketOpportunityHandoffV1,
  live: SignalLiveFields | null,
): MergedHandoffDisplay {
  if (!live) {
    return { display: handoff, supplementedFieldCodes: [] };
  }

  const supplemented: MarketSignalPendingFieldCodeV1[] = [];
  const market = pickText(handoff.marketCode, live.marketCode);
  if (market.supplemented) supplemented.push("market_code");
  const channel = pickText(handoff.channelCode, live.channelCode);
  if (channel.supplemented) supplemented.push("channel_code");
  const category = pickText(handoff.categoryRef, live.categoryRef);
  if (category.supplemented) supplemented.push("category_ref");
  const observed = pickText(
    handoff.observedFactSummary,
    live.observedFactSummary,
  );
  if (observed.supplemented) supplemented.push("observed_fact_summary");
  const hypothesis = pickText(handoff.hypothesis, live.hypothesis);
  if (hypothesis.supplemented) supplemented.push("hypothesis");

  const snapshotEvidence = handoff.evidenceRefs;
  const liveEvidence = live.evidenceRefs;
  let evidenceRefs = snapshotEvidence;
  if (snapshotEvidence.length === 0 && liveEvidence.length > 0) {
    evidenceRefs = [...liveEvidence];
    supplemented.push("evidence_refs");
  }

  const display: MarketOpportunityHandoffV1 = {
    ...handoff,
    marketCode: market.value,
    channelCode: channel.value,
    categoryRef: category.value,
    observedFactSummary: observed.value,
    hypothesis: hypothesis.value,
    evidenceRefs,
    pendingFieldCodes: pendingAfterMerge(
      handoff.pendingFieldCodes,
      supplemented,
    ),
  };

  return { display, supplementedFieldCodes: supplemented };
}

function pendingAfterMerge(
  snapshotPending: readonly MarketSignalPendingFieldCodeV1[],
  supplemented: readonly MarketSignalPendingFieldCodeV1[],
): MarketSignalPendingFieldCodeV1[] {
  const filled = new Set(supplemented);
  return snapshotPending.filter((code) => !filled.has(code));
}
