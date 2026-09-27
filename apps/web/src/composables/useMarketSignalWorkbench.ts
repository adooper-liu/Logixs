import type {
  MarketSignalDetailV1,
  MarketSignalPendingFieldCodeV1,
  MarketSignalUpdateCommandV1,
  MarketSignalV1,
} from "@logix/contracts";
import {
  computed,
  onMounted,
  reactive,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import {
  createMarketSignal,
  decideMarketSignal,
  getMarketSignal,
  listMarketSignals,
  registerMarketSignalEvidence,
  updateMarketSignal,
} from "../api/marketSignals";
import {
  buildMarketSignalResult,
  createMarketSignalDraft,
  marketSignalGap,
  type ManualMarketSignalDraft,
  type MarketSignalDecisionDraft,
  type MarketSignalOperationReceipt,
  type MarketSignalQueueItem,
  type MarketSignalScenario,
  type MarketSignalSupplementDraft,
} from "../data/marketSignalScenarios";

interface UseMarketSignalWorkbenchOptions {
  selectedId: MaybeRefOrGetter<string>;
  selectSignal: (id: string) => Promise<void>;
}

export function useMarketSignalWorkbench(
  options: UseMarketSignalWorkbenchOptions,
) {
  const signals = shallowRef<readonly MarketSignalScenario[]>([]);
  const receipt = shallowRef<MarketSignalOperationReceipt | null>(null);
  const drafts = reactive<Record<string, MarketSignalDecisionDraft>>({});
  const loading = shallowRef(true);
  const saving = shallowRef(false);
  const error = shallowRef<string | null>(null);

  const selectedSignal = computed(
    () =>
      signals.value.find((item) => item.id === toValue(options.selectedId)) ??
      signals.value[0] ??
      null,
  );
  const selectedDraft = computed({
    get: (): MarketSignalDecisionDraft =>
      drafts[selectedSignal.value?.id ?? "__empty"] ??
      createMarketSignalDraft(),
    set: (value: MarketSignalDecisionDraft): void => {
      drafts[selectedSignal.value?.id ?? "__empty"] = value;
    },
  });
  const queueItems = computed<readonly MarketSignalQueueItem[]>(() =>
    signals.value.map((signal) => ({
      ...signal,
      workflowState: signal.initialState,
    })),
  );

  watch(
    () => selectedSignal.value?.id,
    (id) => {
      if (!id) return;
      drafts[id] ??= createMarketSignalDraft();
      void loadDetail(id);
    },
  );

  onMounted(loadSignals);

  async function loadSignals(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const page = await listMarketSignals();
      signals.value = page.items.map((signal) => toScenario(signal));
      const requested = toValue(options.selectedId);
      const initial =
        signals.value.find(({ id }) => id === requested) ?? signals.value[0];
      if (initial && initial.id !== requested) {
        await options.selectSignal(initial.id);
      } else if (initial) {
        await loadDetail(initial.id);
      }
    } catch (caught) {
      error.value = message(caught);
      signals.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function loadDetail(id: string): Promise<void> {
    try {
      const detail = await getMarketSignal(id);
      replaceScenario(toScenario(detail.signal, detail));
    } catch (caught) {
      error.value = message(caught);
    }
  }

  async function registerSignal(
    draft: ManualMarketSignalDraft,
  ): Promise<boolean> {
    const title = draft.title.trim();
    if (!title || saving.value) return false;
    saving.value = true;
    error.value = null;
    const signalId = crypto.randomUUID();
    try {
      let created = await createMarketSignal({
        contractVersion: "market-signal-create.v1",
        requestId: signalId,
        title,
        ...(draft.market.trim() ? { marketCode: draft.market.trim() } : {}),
        ...(draft.channel.trim() ? { channelCode: draft.channel.trim() } : {}),
        ...(draft.category.trim()
          ? { categoryRef: draft.category.trim() }
          : {}),
        ...(draft.observedFact.trim()
          ? { observedFactSummary: draft.observedFact.trim() }
          : {}),
        ...(draft.hypothesis.trim()
          ? { hypothesis: draft.hypothesis.trim() }
          : {}),
        idempotencyKey: `market-signal-create:${signalId}`,
      });
      if (draft.sourceName.trim() || draft.sourceUrl.trim()) {
        await registerMarketSignalEvidence({
          signalId,
          sourceName: draft.sourceName.trim() || "业务人员补充",
          sourceUrl: draft.sourceUrl.trim(),
          content: draft.observedFact.trim() || title,
        });
        created = (await getMarketSignal(signalId)).signal;
      }
      signals.value = [toScenario(created), ...signals.value];
      receipt.value = null;
      await options.selectSignal(signalId);
      await loadDetail(signalId);
      return true;
    } catch (caught) {
      error.value = message(caught);
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function submitDecision(): Promise<void> {
    const signal = selectedSignal.value;
    if (!signal || saving.value) return;
    saving.value = true;
    error.value = null;
    try {
      const draft = selectedDraft.value;
      const response = await decideMarketSignal(signal.id, {
        contractVersion: "market-signal-decision.v1",
        expectedSignalVersion: signal.version,
        decisionType: draft.decision,
        ...(draft.judgmentNote.trim()
          ? { judgmentNote: draft.judgmentNote.trim() }
          : {}),
        ...(draft.opportunityStatement.trim()
          ? { opportunityStatement: draft.opportunityStatement.trim() }
          : {}),
        ...(draft.nextReviewDate
          ? { nextReviewDate: draft.nextReviewDate }
          : {}),
        ...(draft.watchFocus.trim()
          ? { watchFocus: draft.watchFocus.trim() }
          : {}),
        ...(draft.dismissReason.trim()
          ? { dismissReason: draft.dismissReason.trim() }
          : {}),
        idempotencyKey: `market-signal-decision:${signal.id}:${signal.version}:${crypto.randomUUID()}`,
      });
      replaceScenario(toScenario(response.signal));
      const result = buildMarketSignalResult(signal, draft);
      if (response.handoff) {
        result.pendingItems =
          response.handoff.pendingFieldCodes.map(pendingFieldLabel);
      }
      receipt.value = {
        signalId: signal.id,
        signalTitle: signal.title,
        result,
      };
      if (response.completion === "completed") {
        const next = signals.value.find(
          (item) =>
            item.initialState === "needs_decision" && item.id !== signal.id,
        );
        if (next) await options.selectSignal(next.id);
      }
    } catch (caught) {
      error.value = message(caught);
      await loadDetail(signal.id);
    } finally {
      saving.value = false;
    }
  }

  async function supplementSignal(
    draft: MarketSignalSupplementDraft,
  ): Promise<boolean> {
    const signal = selectedSignal.value;
    if (!signal || saving.value) return false;
    saving.value = true;
    error.value = null;
    try {
      const field = updateForGap(draft);
      if (field) {
        replaceScenario(
          toScenario(
            await updateMarketSignal(signal.id, {
              contractVersion: "market-signal-update.v1",
              expectedSignalVersion: signal.version,
              ...field,
              idempotencyKey: `market-signal-update:${signal.id}:${signal.version}:${draft.gapCode}:${crypto.randomUUID()}`,
            }),
          ),
        );
      } else {
        await registerMarketSignalEvidence({
          signalId: signal.id,
          sourceName: draft.sourceName.trim() || "业务人员补充",
          sourceUrl: draft.sourceUrl.trim(),
          content: draft.content.trim(),
        });
      }
      await loadDetail(signal.id);
      return true;
    } catch (caught) {
      error.value = message(caught);
      return false;
    } finally {
      saving.value = false;
    }
  }

  function replaceScenario(next: MarketSignalScenario): void {
    signals.value = signals.value.map((item) =>
      item.id === next.id ? next : item,
    );
  }

  function clearReceipt(): void {
    receipt.value = null;
  }

  return {
    selectedSignal,
    selectedDraft,
    queueItems,
    receipt,
    loading,
    saving,
    error,
    loadSignals,
    registerSignal,
    submitDecision,
    supplementSignal,
    clearReceipt,
  };
}

function toScenario(
  signal: MarketSignalV1,
  detail?: MarketSignalDetailV1,
): MarketSignalScenario {
  return {
    id: signal.signalId,
    title: signal.title,
    workReason: workReason(signal),
    urgency: "normal",
    urgencyLabel: destinationLabel(signal.currentDestination),
    market: signal.marketCode ?? null,
    channel: signal.channelCode ?? null,
    category: signal.categoryRef ?? null,
    owner:
      signal.ownerTeamCode === "market_intelligence"
        ? "经营与市场团队"
        : signal.ownerTeamCode,
    observedFacts: signal.observedFactSummary
      ? [signal.observedFactSummary]
      : [],
    hypothesis: signal.hypothesis ?? null,
    evidence: (detail?.evidence ?? []).map((evidence) => ({
      id: evidence.evidenceId,
      sourceName: evidence.sourceName,
      observedAt: evidence.recordedAt.slice(0, 10),
      detail: evidence.summary,
      previewText: evidence.summary,
      sourceUrl: /^https?:\/\//i.test(evidence.contentRef)
        ? evidence.contentRef
        : null,
      attachmentName: null,
    })),
    supplements: [],
    gaps: [
      ...signal.pendingFieldCodes.flatMap((code) => {
        const gapCode = gapCodeForPending(code);
        return gapCode ? [marketSignalGap(gapCode)] : [];
      }),
      // 来源名称不是服务端的待补字段码：它在"已有证据、但该证据没写来源名"时
      // 由前端判定。与 source_evidence（完全没有证据记录）互斥，不会同时出现。
      // 解析方式沿用兜底路径 —— 登记一条带来源名的证据，不改写原记录。
      ...((detail?.evidence ?? []).some((item) => !item.sourceName.trim())
        ? [marketSignalGap("source_name")]
        : []),
    ],
    initialState: signal.currentDestination,
    version: signal.version,
  };
}

function updateForGap(
  draft: MarketSignalSupplementDraft,
): Partial<MarketSignalUpdateCommandV1> | null {
  const content = draft.content.trim();
  if (draft.gapCode === "market") return { marketCode: content };
  if (draft.gapCode === "channel") return { channelCode: content };
  if (draft.gapCode === "category") return { categoryRef: content };
  if (draft.gapCode === "observed_fact") {
    return { observedFactSummary: content };
  }
  if (draft.gapCode === "hypothesis") return { hypothesis: content };
  return null;
}

function gapCodeForPending(code: MarketSignalPendingFieldCodeV1) {
  if (code === "market_code") return "market" as const;
  if (code === "channel_code") return "channel" as const;
  if (code === "category_ref") return "category" as const;
  if (code === "observed_fact_summary") return "observed_fact" as const;
  if (code === "hypothesis") return "hypothesis" as const;
  if (code === "evidence_refs") return "source_evidence" as const;
  return null;
}

function pendingFieldLabel(code: MarketSignalPendingFieldCodeV1): string {
  const labels: Record<MarketSignalPendingFieldCodeV1, string> = {
    market_code: "市场待补",
    channel_code: "渠道待补",
    category_ref: "商品类别待选择",
    observed_fact_summary: "观察事实待补",
    hypothesis: "经营假设待补",
    evidence_refs: "来源证据待补",
    opportunity_statement: "机会说明待补",
    next_review_date: "下次查看日期待补",
    dismiss_reason: "不采纳原因待补",
  };
  return labels[code];
}

function workReason(signal: MarketSignalV1): string {
  if (signal.currentDestination === "watching") return "已安排继续观察";
  if (signal.currentDestination === "handed_off") return "已交给选品团队";
  if (signal.currentDestination === "dismissed") return "已记录不采纳";
  return "需要判断下一步去向";
}

function destinationLabel(
  destination: MarketSignalV1["currentDestination"],
): string {
  if (destination === "watching") return "继续观察";
  if (destination === "handed_off") return "已交接";
  if (destination === "dismissed") return "不采纳";
  return "待判断";
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "操作失败，请稍后重试";
}
