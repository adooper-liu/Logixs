import type {
  MarketSignalDetailV1,
  MarketSignalPageV1,
  MarketSignalPendingFieldCodeV1,
  MarketSignalUpdateCommandV1,
  MarketSignalV1,
  ProductOpportunityV1,
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
  listProductOpportunities,
  registerMarketSignalEvidence,
  takeBackSelectionReturn,
  updateMarketSignal,
} from "../api/marketSignals";
import {
  buildMarketSignalResult,
  compareWatchingOrder,
  createMarketSignalDraft,
  marketSignalGap,
  type ManualMarketSignalDraft,
  type MarketSignalDecisionDraft,
  type MarketSignalOperationReceipt,
  type MarketSignalQueueItem,
  type MarketSignalScenario,
  type MarketSignalSupplementDraft,
  type MarketSignalWorkflowState,
} from "../data/marketSignalScenarios";

interface UseMarketSignalWorkbenchOptions {
  selectedId: MaybeRefOrGetter<string>;
  selectSignal: (id: string) => Promise<void>;
}

const MARKET_DESTINATIONS: readonly MarketSignalV1["currentDestination"][] = [
  "needs_decision",
  "selection_return_requested",
  "returned_from_selection",
  "watching",
  "handed_off",
  "dismissed",
  "voided",
  "archived",
];
const QUEUE_STATES: readonly MarketSignalWorkflowState[] = [
  "awaiting_selection_acceptance",
  ...MARKET_DESTINATIONS,
];

export interface QueuePageState {
  nextCursor: string | null;
  /** 旧 API 不提供分组总数时为 null，界面退回到已加载条数。 */
  totalCount: number | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  /** 每次重载分组递增；迟到的旧响应据此丢弃。 */
  generation: number;
}

function emptyPage(): QueuePageState {
  return {
    nextCursor: null,
    totalCount: null,
    loading: false,
    loadingMore: false,
    error: null,
    generation: 0,
  };
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
  const takebackReceipt = shallowRef<string | null>(null);
  const pages = reactive<Record<MarketSignalWorkflowState, QueuePageState>>(
    Object.fromEntries(
      QUEUE_STATES.map((destination) => [destination, emptyPage()]),
    ) as unknown as Record<MarketSignalWorkflowState, QueuePageState>,
  );
  // 旧 API 忽略 destination、按跨状态顺序分页；探测到后只走一条全局游标。
  const legacy = reactive({
    active: false,
    nextCursor: null as string | null,
    loadingMore: false,
  });
  const details = new Map<string, MarketSignalDetailV1>();
  const responsibilities = new Map<string, ProductOpportunityV1>();
  const detailRequests = new Map<string, number>();
  const takebackKeys = new Map<string, string>();
  let loadGeneration = 0;

  const selectedSignal = computed(() => {
    const selectedId = toValue(options.selectedId);
    if (!selectedId) return null;
    return signals.value.find((item) => item.id === selectedId) ?? null;
  });
  const selectedDraft = computed({
    get: (): MarketSignalDecisionDraft =>
      drafts[selectedSignal.value?.id ?? "__empty"] ??
      createMarketSignalDraft(),
    set: (value: MarketSignalDecisionDraft): void => {
      drafts[selectedSignal.value?.id ?? "__empty"] = value;
    },
  });
  const queueItems = computed<readonly MarketSignalQueueItem[]>(() => {
    const items = signals.value.map((signal) => ({
      ...signal,
      workflowState: signal.initialState,
    }));
    const watching = items
      .filter((item) => item.workflowState === "watching")
      .sort(compareWatchingOrder);
    return [
      ...items.filter((item) => item.workflowState !== "watching"),
      ...watching,
    ];
  });
  const hasMore = computed(
    () =>
      Object.fromEntries(
        QUEUE_STATES.map((destination) => [
          destination,
          legacy.active
            ? Boolean(legacy.nextCursor)
            : Boolean(pages[destination].nextCursor),
        ]),
      ) as Record<MarketSignalWorkflowState, boolean>,
  );

  watch(
    () => toValue(options.selectedId),
    async (id) => {
      if (!id) return;
      drafts[id] ??= createMarketSignalDraft();
      if (!signals.value.some((item) => item.id === id)) {
        await ensureRequestedSignal(id);
        return;
      }
      await loadDetail(id);
    },
  );

  onMounted(loadSignals);

  async function loadSignals(): Promise<void> {
    const generation = ++loadGeneration;
    loading.value = true;
    error.value = null;
    responsibilities.clear();
    const responsibilityPage = pages.awaiting_selection_acceptance;
    responsibilityPage.generation += 1;
    const responsibilityGeneration = responsibilityPage.generation;
    responsibilityPage.loading = true;
    responsibilityPage.error = null;
    const responsibilityRequest = listProductOpportunities({
      responsibilityStatus: "retained_by_market",
      pageSize: 50,
    });
    if (legacy.active) {
      try {
        const [result, projected] = await Promise.all([
          listMarketSignals({ pageSize: 50 }),
          responsibilityRequest,
        ]);
        if (loadGeneration !== generation) return;
        legacy.nextCursor = result.nextCursor;
        signals.value = [];
        upsertSignals(result.items);
        applyResponsibilityPage(projected, true);
        await ensureRequestedSignal();
      } catch (caught) {
        error.value = message(caught);
      } finally {
        responsibilityPage.loading = false;
        if (loadGeneration === generation) loading.value = false;
      }
      return;
    }
    MARKET_DESTINATIONS.forEach((destination) => {
      pages[destination].generation += 1;
      pages[destination].loading = true;
      pages[destination].error = null;
    });
    const [results, responsibilityResult] = await Promise.all([
      Promise.allSettled(
        MARKET_DESTINATIONS.map((destination) =>
          listMarketSignals({ destination, pageSize: 50 }),
        ),
      ),
      Promise.allSettled([responsibilityRequest]).then(([result]) => result!),
    ]);
    if (loadGeneration !== generation) return;
    const legacyPage = results.find(
      (result): result is PromiseFulfilledResult<MarketSignalPageV1> =>
        result.status === "fulfilled" && result.value.totalCount === undefined,
    );
    if (legacyPage) {
      // 旧 API 对每个 destination 都返回同一份跨状态首页，只采用一份避免重复。
      legacy.active = true;
      legacy.nextCursor = legacyPage.value.nextCursor;
      signals.value = [];
      upsertSignals(legacyPage.value.items);
      MARKET_DESTINATIONS.forEach((destination) => {
        pages[destination] = {
          ...emptyPage(),
          generation: pages[destination].generation,
        };
      });
    } else {
      legacy.active = false;
      legacy.nextCursor = null;
      signals.value = [];
      results.forEach((result, index) => {
        const destination = MARKET_DESTINATIONS[index]!;
        const page = pages[destination];
        page.loading = false;
        page.loadingMore = false;
        if (result.status === "fulfilled") {
          upsertSignals(result.value.items);
          page.nextCursor = result.value.nextCursor;
          page.totalCount = result.value.totalCount ?? null;
          page.error = null;
        } else {
          page.nextCursor = null;
          page.totalCount = null;
          page.error = message(result.reason);
        }
      });
    }
    if (
      pages.awaiting_selection_acceptance.generation ===
      responsibilityGeneration
    ) {
      responsibilityPage.loading = false;
      if (responsibilityResult.status === "fulfilled") {
        applyResponsibilityPage(responsibilityResult.value, true);
        responsibilityPage.error = null;
      } else {
        responsibilityPage.nextCursor = null;
        responsibilityPage.totalCount = null;
        responsibilityPage.error = message(responsibilityResult.reason);
      }
    }
    if (results.every((result) => result.status === "rejected")) {
      error.value = message((results[0] as PromiseRejectedResult).reason);
    }
    await ensureRequestedSignal();
    const requested = toValue(options.selectedId);
    const matched = signals.value.find(({ id }) => id === requested);
    // 首屏无选中时默认第一条；筛选切换清空选中后不再回退到首条，避免右侧错位。
    const initial = matched ?? (requested ? null : (signals.value[0] ?? null));
    loading.value = false;
    if (initial && initial.id !== requested) {
      await options.selectSignal(initial.id);
    } else if (initial) {
      await loadDetail(initial.id);
    }
  }

  /** 深链对象可能不在各组首页：独立读取并并入其所属分组，不改分组总数。 */
  async function ensureRequestedSignal(
    requested = toValue(options.selectedId),
  ): Promise<void> {
    if (!requested || signals.value.some(({ id }) => id === requested)) return;
    await loadDetail(requested);
  }

  async function retryGroup(
    destination: MarketSignalWorkflowState,
  ): Promise<void> {
    if (destination === "awaiting_selection_acceptance") {
      await loadSignals();
      return;
    }
    if (legacy.active) {
      await loadSignals();
      return;
    }
    const page = pages[destination];
    page.generation += 1;
    const generation = page.generation;
    page.loading = true;
    page.loadingMore = false;
    page.error = null;
    try {
      const result = await listMarketSignals({ destination, pageSize: 50 });
      if (pages[destination].generation !== generation) return;
      replaceDestinationSignals(destination, result.items);
      page.nextCursor = result.nextCursor;
      page.totalCount = result.totalCount ?? null;
    } catch (caught) {
      if (pages[destination].generation !== generation) return;
      page.error = message(caught);
    } finally {
      if (pages[destination].generation === generation) page.loading = false;
    }
  }

  async function loadDetail(id: string): Promise<void> {
    const request = (detailRequests.get(id) ?? 0) + 1;
    detailRequests.set(id, request);
    try {
      const [detailResult, responsibilityResult] = await Promise.allSettled([
        getMarketSignal(id),
        listProductOpportunities({ signalId: id, pageSize: 1 }),
      ]);
      if (detailRequests.get(id) !== request) return;
      if (detailResult.status === "rejected") throw detailResult.reason;
      const detail = detailResult.value;
      if (responsibilityResult.status === "fulfilled") {
        const opportunity = responsibilityResult.value.items[0];
        if (opportunity) responsibilities.set(id, opportunity);
        else responsibilities.delete(id);
      }
      const responsibility = responsibilities.get(id);
      const current = signals.value.find((item) => item.id === id);
      // 保存后的新版本先到、旧详情后到时，只保护信号字段；证据与退回原因仍是独立详情事实。
      if (current && current.version > detail.signal.version) {
        details.set(id, detail);
        const enriched = toScenario(detail.signal, detail, responsibility);
        upsertScenario({
          ...current,
          evidence: enriched.evidence,
          workReason: detail.selectionReturnReason
            ? enriched.workReason
            : current.workReason,
          gaps: [
            ...current.gaps.filter((gap) => gap.code !== "source_name"),
            ...enriched.gaps.filter((gap) => gap.code === "source_name"),
          ],
        });
        return;
      }
      details.set(id, detail);
      upsertScenario(toScenario(detail.signal, detail, responsibility));
    } catch (caught) {
      if (detailRequests.get(id) !== request) return;
      error.value = message(caught);
    }
  }

  async function takeBackReturn(): Promise<boolean> {
    const selected = selectedSignal.value;
    if (
      !selected ||
      selected.initialState !== "selection_return_requested" ||
      saving.value
    ) {
      return false;
    }
    saving.value = true;
    error.value = null;
    takebackReceipt.value = null;
    try {
      await takeBackSelectionReturn(selected.id, {
        contractVersion: "market-selection-return-takeback.v1",
        expectedSignalVersion: selected.version,
        idempotencyKey: takebackKey(selected.id, selected.version),
      });
      await loadSignals();
      takebackReceipt.value =
        "已接回。信号已回到经营队列，可补充事实后重新判断并交接新版本。";
      return true;
    } catch (caught) {
      const raw = message(caught);
      if (raw.includes("VERSION_CONFLICT") || raw.includes("INVALID_STATE")) {
        await loadDetail(selected.id);
        error.value = "接回时信号已被更新，已重读最新状态，请核对后再试。";
      } else {
        error.value = raw;
      }
      return false;
    } finally {
      saving.value = false;
    }
  }

  function takebackKey(signalId: string, expectedVersion: number): string {
    const scope = `${signalId}:${expectedVersion}`;
    const current = takebackKeys.get(scope);
    if (current) return current;
    const created = `selection-return-takeback:${scope}:${crypto.randomUUID()}`;
    takebackKeys.set(scope, created);
    return created;
  }

  async function loadMore(
    destination: MarketSignalWorkflowState,
  ): Promise<void> {
    if (legacy.active) {
      await loadMoreLegacy();
      return;
    }
    const page = pages[destination];
    const cursor = page.nextCursor;
    if (!cursor || page.loadingMore) return;
    const generation = page.generation;
    page.loadingMore = true;
    try {
      if (destination === "awaiting_selection_acceptance") {
        const result = await listProductOpportunities({
          responsibilityStatus: "retained_by_market",
          cursor,
          pageSize: 50,
        });
        if (pages[destination].generation !== generation) return;
        applyResponsibilityPage(result, false);
        return;
      }
      const result = await listMarketSignals({
        destination,
        cursor,
        pageSize: 50,
      });
      if (pages[destination].generation !== generation) return;
      upsertSignals(result.items);
      page.nextCursor = result.nextCursor;
      page.totalCount = result.totalCount ?? page.totalCount;
    } catch (caught) {
      if (pages[destination].generation !== generation) return;
      page.error = message(caught);
    } finally {
      if (pages[destination].generation === generation) {
        page.loadingMore = false;
      }
    }
  }

  async function loadMoreLegacy(): Promise<void> {
    const cursor = legacy.nextCursor;
    if (!cursor || legacy.loadingMore) return;
    legacy.loadingMore = true;
    try {
      const result = await listMarketSignals({ cursor, pageSize: 50 });
      upsertSignals(result.items);
      legacy.nextCursor = result.nextCursor;
    } catch (caught) {
      error.value = message(caught);
    } finally {
      legacy.loadingMore = false;
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
          signalId: created.signalId,
          sourceName: draft.sourceName.trim() || "业务人员补充",
          sourceUrl: draft.sourceUrl.trim(),
          content: draft.observedFact.trim() || title,
        });
        created = (await getMarketSignal(created.signalId)).signal;
      }
      signals.value = [toScenario(created), ...signals.value];
      moveCount(null, created.currentDestination);
      receipt.value = null;
      await options.selectSignal(created.signalId);
      await loadDetail(created.signalId);
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
    const draft = selectedDraft.value;
    if (
      (draft.decision === "watch" &&
        (!draft.nextReviewDate || !draft.watchFocus.trim())) ||
      (draft.decision === "dismiss" && !draft.dismissReason) ||
      ((draft.decision === "void" || draft.decision === "archive") &&
        !draft.judgmentNote.trim())
    ) {
      return;
    }
    saving.value = true;
    error.value = null;
    try {
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
        ...(draft.waitingReason.trim()
          ? { waitingReason: draft.waitingReason.trim() }
          : {}),
        ...(draft.dismissReason.trim()
          ? { dismissReason: draft.dismissReason.trim() }
          : {}),
        idempotencyKey: `market-signal-decision:${signal.id}:${signal.version}:${crypto.randomUUID()}`,
      });
      loadGeneration += 1;
      loading.value = false;
      // 判断响应只带信号本体；证据与选品退回原因沿用已读详情，避免保存后丢失。
      upsertScenario(
        toScenario(
          response.signal,
          details.get(signal.id),
          responsibilities.get(signal.id),
        ),
      );
      moveCount(signal.initialState, response.signal.currentDestination);
      const result = buildMarketSignalResult(signal, draft);
      if (response.handoff) {
        result.pendingItems =
          response.handoff.pendingFieldCodes.map(pendingFieldLabel);
        await refreshResponsibility(signal.id);
      }
      receipt.value = {
        signalId: signal.id,
        signalTitle: signal.title,
        result,
      };
      if (response.completion === "completed" && draft.decision !== "watch") {
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
        upsertScenario(
          toScenario(
            await updateMarketSignal(signal.id, {
              contractVersion: "market-signal-update.v1",
              expectedSignalVersion: signal.version,
              ...field,
              idempotencyKey: `market-signal-update:${signal.id}:${signal.version}:${draft.gapCode}:${crypto.randomUUID()}`,
            }),
            details.get(signal.id),
            responsibilities.get(signal.id),
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

  // 分组计数来自服务端 totalCount；本地写成功后同步迁移计数，避免分组标签与列表不一致。
  function moveCount(
    from: MarketSignalWorkflowState | null,
    to: MarketSignalWorkflowState,
  ): void {
    if (from === to) return;
    if (from && pages[from].totalCount !== null) {
      pages[from].totalCount = Math.max(0, pages[from].totalCount - 1);
    }
    if (pages[to].totalCount !== null) pages[to].totalCount += 1;
  }

  function replaceDestinationSignals(
    destination: MarketSignalWorkflowState,
    items: readonly MarketSignalV1[],
  ): void {
    const incomingIds = new Set(items.map(({ signalId }) => signalId));
    signals.value = signals.value.filter(
      (item) => item.initialState !== destination || incomingIds.has(item.id),
    );
    upsertSignals(items);
  }

  function applyResponsibilityPage(
    result: Awaited<ReturnType<typeof listProductOpportunities>>,
    replace: boolean,
  ): void {
    const page = pages.awaiting_selection_acceptance;
    if (replace) {
      const incoming = new Set(
        result.items.map(({ handoff }) => handoff.signalId),
      );
      for (const [signalId, opportunity] of responsibilities) {
        if (
          opportunity.responsibility.status === "retained_by_market" &&
          !incoming.has(signalId)
        ) {
          responsibilities.delete(signalId);
        }
      }
    }
    result.items.forEach((opportunity) => {
      const signalId = opportunity.handoff.signalId;
      responsibilities.set(signalId, opportunity);
      const detail = details.get(signalId);
      upsertScenario(
        toScenario(
          detail?.signal ?? signalFromOpportunity(opportunity),
          detail,
          opportunity,
        ),
      );
    });
    page.nextCursor = result.nextCursor;
    page.totalCount = result.totalCount ?? result.items.length;
  }

  async function refreshResponsibility(signalId: string): Promise<void> {
    try {
      const result = await listProductOpportunities({ signalId, pageSize: 1 });
      const opportunity = result.items[0];
      if (!opportunity) return;
      responsibilities.set(signalId, opportunity);
      const detail = details.get(signalId);
      upsertScenario(
        toScenario(
          detail?.signal ?? signalFromOpportunity(opportunity),
          detail,
          opportunity,
        ),
      );
      const page = pages.awaiting_selection_acceptance;
      if (opportunity.responsibility.status === "retained_by_market") {
        page.totalCount = Math.max(page.totalCount ?? 0, 1);
      }
    } catch (caught) {
      pages.awaiting_selection_acceptance.error = message(caught);
    }
  }

  function upsertSignals(items: readonly MarketSignalV1[]): void {
    items.forEach((item) => {
      upsertScenario(
        toScenario(
          item,
          details.get(item.signalId),
          responsibilities.get(item.signalId),
        ),
      );
    });
  }

  function upsertScenario(next: MarketSignalScenario): void {
    const current = signals.value.find((item) => item.id === next.id);
    if (!current) {
      signals.value = [...signals.value, next];
      return;
    }
    if (current.version > next.version) return;
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
    pages,
    hasMore,
    receipt,
    loading,
    saving,
    error,
    takebackReceipt,
    loadSignals,
    loadMore,
    retryGroup,
    registerSignal,
    submitDecision,
    supplementSignal,
    takeBackReturn,
    clearReceipt,
  };
}

function toScenario(
  signal: MarketSignalV1,
  detail?: MarketSignalDetailV1,
  opportunity?: ProductOpportunityV1,
): MarketSignalScenario {
  const responsibility = opportunity?.responsibility ?? null;
  const awaitingAcceptance =
    signal.currentDestination === "handed_off" &&
    responsibility?.status === "retained_by_market";
  return {
    id: signal.signalId,
    title: signal.title,
    workReason: detail?.selectionReturnReason
      ? `选品请求退回：${detail.selectionReturnReason}`
      : awaitingAcceptance
        ? responsibility.assignedActorId
          ? `选品已领取，等待 ${responsibility.assignedActorId} 接受交接`
          : "已交给选品，等待领取并接受交接"
        : workReason(signal),
    urgency: "normal",
    urgencyLabel: awaitingAcceptance
      ? "待选品接受"
      : destinationLabel(signal.currentDestination),
    selectionReturnBasis: detail?.selectionReturnBasis ?? null,
    selectionReturnReason: detail?.selectionReturnReason ?? null,
    responsibility,
    latestSelectionDecision: opportunity?.latestSelectionDecision ?? null,
    market: signal.marketCode ?? null,
    channel: signal.channelCode ?? null,
    category: signal.categoryRef ?? null,
    owner: responsibility
      ? responsibility.responsibleTeamCode === "market_intelligence"
        ? "经营与市场团队"
        : responsibility.responsibleTeamCode === "product_selection"
          ? "选品团队"
          : "该交接已失效"
      : signal.ownerTeamCode === "market_intelligence"
        ? "经营与市场团队"
        : signal.ownerTeamCode,
    activeValidation: signal.activeValidation ?? null,
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
    initialState: awaitingAcceptance
      ? "awaiting_selection_acceptance"
      : signal.currentDestination,
    version: signal.version,
    updatedAt: signal.updatedAt,
  };
}

function signalFromOpportunity(
  opportunity: ProductOpportunityV1,
): MarketSignalV1 {
  const handoff = opportunity.handoff;
  return {
    signalId: handoff.signalId,
    title: handoff.title,
    marketCode: handoff.marketCode,
    channelCode: handoff.channelCode,
    categoryRef: handoff.categoryRef,
    observedFactSummary: handoff.observedFactSummary,
    hypothesis: handoff.hypothesis,
    evidenceRefs: handoff.evidenceRefs,
    currentDestination: "handed_off",
    ownerTeamCode: "market_intelligence",
    activeValidation: null,
    version: handoff.signalVersion,
    pendingFieldCodes: handoff.pendingFieldCodes,
    createdAt: handoff.createdAt,
    updatedAt: handoff.createdAt,
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

function workReason(signal: MarketSignalV1): string {
  if (signal.currentDestination === "watching") return "已安排继续观察";
  if (signal.currentDestination === "handed_off") return "已交给选品团队";
  if (signal.currentDestination === "dismissed") return "已记录不采纳";
  if (signal.currentDestination === "returned_from_selection") {
    return "选品已退回，需重新判断去向";
  }
  if (signal.currentDestination === "selection_return_requested") {
    return "选品请求退回，等待市场接回";
  }
  if (signal.currentDestination === "voided") return "已作废，只读回看";
  if (signal.currentDestination === "archived") return "已归档，只读回看";
  return "需要判断下一步去向";
}

function destinationLabel(
  destination: MarketSignalV1["currentDestination"],
): string {
  if (destination === "watching") return "继续观察";
  if (destination === "handed_off") return "已交接";
  if (destination === "dismissed") return "不采纳";
  if (destination === "returned_from_selection") return "选品退回";
  if (destination === "selection_return_requested") return "选品请求退回";
  if (destination === "voided") return "已作废";
  if (destination === "archived") return "已归档";
  return "待判断";
}

function pendingFieldLabel(code: MarketSignalPendingFieldCodeV1): string {
  const labels: Record<MarketSignalPendingFieldCodeV1, string> = {
    market_code: "市场未填",
    channel_code: "渠道未填",
    category_ref: "商品类别待选择",
    observed_fact_summary: "观察事实待补",
    hypothesis: "经营假设待补",
    evidence_refs: "来源证据待补",
    opportunity_statement: "机会说明待补",
    next_review_date: "下次检查日期待补",
    watch_focus: "验证重点待补",
    dismiss_reason: "不采纳原因待补",
    close_reason: "关闭理由待补",
  };
  return labels[code];
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "操作失败，请稍后重试";
}
