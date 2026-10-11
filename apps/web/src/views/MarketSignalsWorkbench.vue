<script setup lang="ts">
import { AlertCircle, LoaderCircle, RefreshCw } from "@lucide/vue";
import { computed, ref, shallowRef } from "vue";
import { useRoute, useRouter } from "vue-router";
import MarketSignalActiveValidation from "../components/market-signals/MarketSignalActiveValidation.vue";
import MarketSignalCreatePanel from "../components/market-signals/MarketSignalCreatePanel.vue";
import MarketSignalDecisionPanel from "../components/market-signals/MarketSignalDecisionPanel.vue";
import MarketSignalEvidencePanel from "../components/market-signals/MarketSignalEvidencePanel.vue";
import MarketSignalOperationReceipt from "../components/market-signals/MarketSignalOperationReceipt.vue";
import MarketSignalQueue from "../components/market-signals/MarketSignalQueue.vue";
import MarketSelectionFeedback from "../components/market-signals/MarketSelectionFeedback.vue";
import WorkbenchDecisionStrip from "../components/workbench/WorkbenchDecisionStrip.vue";
import WorkbenchLayout from "../components/workbench/WorkbenchLayout.vue";
import WorkbenchPageHeader from "../components/workbench/WorkbenchPageHeader.vue";
import WorkbenchPane from "../components/workbench/WorkbenchPane.vue";
import WorkbenchResponsibilityBand from "../components/workbench/WorkbenchResponsibilityBand.vue";
import { useMarketSignalWorkbench } from "../composables/useMarketSignalWorkbench";
import { useAuthSession } from "../auth/useAuthSession";
import type { ManualMarketSignalDraft } from "../data/marketSignalScenarios";

const route = useRoute();
const router = useRouter();
const { actorId } = useAuthSession();
const showCreatePanel = shallowRef(false);
const leftCollapsed = ref(false);
const rightCollapsed = ref(false);
const mobileScreen = ref<"queue" | "detail" | "context">("queue");

const requestedSignalId = computed(() => String(route.query.signalId ?? ""));

async function selectSignal(id: string): Promise<void> {
  await router.replace({
    path: "/workspaces/market-signals",
    query: { signalId: id },
  });
}

async function clearSignalSelection(): Promise<void> {
  await router.replace({
    path: "/workspaces/market-signals",
    query: {},
  });
}

const {
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
} = useMarketSignalWorkbench({
  selectedId: requestedSignalId,
  selectSignal,
});

const queueCounts = computed(() => {
  const counts = Object.fromEntries(
    Object.entries(pages).flatMap(([key, page]) =>
      page.totalCount === null ? [] : [[key, page.totalCount]],
    ),
  );
  // `handed_off` 的服务端总数含尚未接受项；这些已由责任投影移入独立待办组。
  counts.handed_off = queueItems.value.filter(
    ({ workflowState }) => workflowState === "handed_off",
  ).length;
  return counts;
});
const queueGroupErrors = computed(() =>
  Object.fromEntries(
    Object.entries(pages).flatMap(([key, page]) =>
      page.error ? [[key, page.error]] : [],
    ),
  ),
);
const queueLoadingMore = computed(() =>
  Object.fromEntries(
    Object.entries(pages).map(([key, page]) => [key, page.loadingMore]),
  ),
);

const isClosed = computed(
  () =>
    selectedSignal.value?.initialState === "voided" ||
    selectedSignal.value?.initialState === "archived",
);
const isReturnRequest = computed(
  () => selectedSignal.value?.initialState === "selection_return_requested",
);

const closedLabel = computed(() => {
  if (selectedSignal.value?.initialState === "voided") return "已作废关闭";
  if (selectedSignal.value?.initialState === "archived") return "已归档关闭";
  return "";
});

const responsibilityItems = computed(() => [
  {
    label: "当前对象",
    value: selectedSignal.value?.title ?? null,
    state: selectedSignal.value ? ("known" as const) : ("unknown" as const),
  },
  { label: "本次结果", value: "判断信号去向", state: "known" as const },
  {
    label: "当前责任",
    value:
      selectedSignal.value?.owner === "经营与市场团队"
        ? "经营与市场负责人"
        : selectedSignal.value?.owner || "经营与市场负责人",
    state: "known" as const,
  },
  {
    label: "下一责任",
    value: selectedSignal.value?.responsibility?.responsibleTeamCode ?? null,
    state: selectedSignal.value?.responsibility?.responsibleTeamCode
      ? ("known" as const)
      : ("unknown" as const),
  },
]);
const decisionConclusion = computed(() => {
  if (!selectedSignal.value) return "等待选择信号";
  if (isClosed.value) return `${closedLabel.value} · 只读回看`;
  if (isReturnRequest.value) return "选品请求退回 · 等待接回";
  return "办理中 · 判断信号去向";
});

async function createSignal(draft: ManualMarketSignalDraft): Promise<void> {
  const created = await registerSignal(draft);
  if (created) showCreatePanel.value = false;
}
</script>

<template>
  <main class="market-workbench page-frame">
    <WorkbenchLayout
      v-model:left-collapsed="leftCollapsed"
      v-model:right-collapsed="rightCollapsed"
      v-model:mobile-screen="mobileScreen"
      left-rail-label="经营信号队列"
      right-rail-label="信号操作上下文"
      :left-rail-summary="`${queueItems.length} 个信号`"
      :right-rail-summary="isClosed ? '只读' : '可办理'"
    >
      <template #header>
        <WorkbenchPageHeader
          stage-code="market_signals"
          eyebrow="经营岗位工作台"
        />
      </template>
      <template #responsibility>
        <WorkbenchResponsibilityBand
          region-label="岗位、对象与责任上下文"
          :items="responsibilityItems"
        />
      </template>
      <template #decision>
        <div class="market-feedback">
          <section v-if="error" class="operation-error" role="alert">
            <AlertCircle :size="17" aria-hidden="true" />
            <span>{{ error }}</span>
            <button type="button" @click="loadSignals">
              <RefreshCw :size="15" aria-hidden="true" />重新加载
            </button>
          </section>
          <section
            v-else-if="takebackReceipt"
            class="takeback-receipt"
            role="status"
          >
            {{ takebackReceipt }}
          </section>
          <section v-else-if="loading" class="loading-state" role="status">
            <LoaderCircle :size="17" aria-hidden="true" />正在读取经营信号
          </section>
          <MarketSignalOperationReceipt
            v-if="receipt"
            :receipt="receipt"
            @dismiss="clearReceipt"
          />
          <WorkbenchDecisionStrip
            region-label="当前结论与办理缺口"
            :conclusion="decisionConclusion"
            :tone="isClosed ? 'neutral' : isReturnRequest ? 'warn' : 'info'"
            :disabled-reason="
              isClosed
                ? '关闭态不可补录、不可重开；保留事实与责任回看。'
                : undefined
            "
          >
            <template v-if="selectedSignal && isClosed" #conclusionDetail>
              <span
                >{{ selectedSignal.title }} · {{ selectedSignal.owner }}</span
              >
            </template>
          </WorkbenchDecisionStrip>
        </div>
      </template>
      <template #queue>
        <WorkbenchPane
          id="market-signal-queue"
          title="经营信号队列"
          region-label="对象与任务队列"
        >
          <MarketSignalQueue
            :items="queueItems"
            :selected-id="selectedSignal?.id ?? ''"
            :counts="queueCounts"
            :has-more="hasMore"
            :loading-more="queueLoadingMore"
            :group-errors="queueGroupErrors"
            @select="selectSignal"
            @clear="clearSignalSelection"
            @create="showCreatePanel = true"
            @load-more="loadMore"
            @retry-group="retryGroup"
          />
        </WorkbenchPane>
      </template>
      <template #queueRail
        ><strong>{{ queueItems.length }}</strong
        ><span>信号</span></template
      >
      <template #detail>
        <WorkbenchPane
          id="market-signal-detail"
          title="信号事实与依据"
          region-label="事实、缺口与推进任务"
        >
          <MarketSignalCreatePanel
            v-if="showCreatePanel"
            @create="createSignal"
            @cancel="showCreatePanel = false"
          />
          <MarketSignalActiveValidation
            v-if="selectedSignal"
            :validation="selectedSignal.activeValidation"
            :actor-id="actorId"
          />
          <MarketSignalEvidencePanel
            v-if="selectedSignal"
            :signal="selectedSignal"
            :closed="isClosed"
            @supplement="supplementSignal"
          />
          <MarketSelectionFeedback
            v-if="selectedSignal?.responsibility"
            :responsibility="selectedSignal.responsibility"
            :latest-decision="selectedSignal.latestSelectionDecision"
          />
          <p v-else-if="!selectedSignal" class="empty-workbench">
            {{
              queueItems.length
                ? "请从左侧当前分组选择一条信号。"
                : "暂无经营信号。登记一条刚发生的市场变化后即可开始判断。"
            }}
          </p>
        </WorkbenchPane>
      </template>
      <template #context>
        <WorkbenchPane
          id="market-signal-context"
          title="信号操作上下文"
          region-label="当前事项操作上下文"
        >
          <div v-if="selectedSignal && isReturnRequest" class="return-request">
            <small>选品请求退回</small>
            <b v-if="selectedSignal.selectionReturnBasis">{{
              selectedSignal.selectionReturnBasis === "wrong_direction"
                ? "方向错误"
                : "证据不足"
            }}</b>
            <p>{{ selectedSignal.selectionReturnReason }}</p>
            <button type="button" :disabled="saving" @click="takeBackReturn">
              {{ saving ? "正在接回" : "接回" }}
            </button>
          </div>
          <MarketSignalDecisionPanel
            v-else-if="selectedSignal"
            v-model="selectedDraft"
            :busy="saving"
            :closed="isClosed"
            :closed-label="closedLabel"
            :active-validation="selectedSignal.activeValidation"
            :actor-id="actorId"
            @submit="submitDecision"
          />
          <p v-else class="empty-workbench">
            {{
              queueItems.length
                ? "请从左侧当前分组选择一条信号后再判断去向。"
                : "选择一条信号后显示可执行动作。"
            }}
          </p>
        </WorkbenchPane>
      </template>
      <template #contextRail
        ><span>{{ isClosed ? "只读" : "动作" }}</span></template
      >
    </WorkbenchLayout>
  </main>
</template>

<style scoped>
.market-workbench {
  min-width: 0;
}

.market-workbench--closed {
  filter: saturate(0.85);
}
.return-request {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-4);
}
.return-request small {
  color: var(--brand-strong);
  font-weight: 700;
}
.return-request b {
  color: var(--ink);
}
.return-request p {
  margin: 0;
  color: var(--ink-soft);
  line-height: var(--leading-body);
}
.return-request button {
  min-height: var(--touch-target);
  border: 1px solid var(--brand);
  border-radius: var(--radius-control);
  background: var(--brand);
  color: var(--on-brand);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.operation-error,
.loading-state,
.takeback-receipt {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-left: 3px solid var(--risk);
  background: var(--risk-bg);
  color: var(--ink-soft);
  font-size: var(--text-label);
}
.takeback-receipt {
  border-left-color: var(--ok);
  background: var(--ok-bg);
}

.operation-error svg,
.loading-state svg {
  flex: none;
  color: var(--risk);
}

.operation-error span {
  flex: 1;
}

.operation-error button {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0 var(--space-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
  font: inherit;
}

.loading-state {
  border-left-color: var(--info);
  background: var(--info-bg);
}

.loading-state svg {
  color: var(--info);
  animation: spin 1s linear infinite;
}

.empty-workbench {
  margin: 0;
  padding: var(--space-6) var(--space-4);
  color: var(--muted);
  font-size: var(--text-label);
  line-height: var(--leading-body);
  text-align: center;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.conclusion-strip {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--line-strong);
  border-left: 4px solid var(--ink-soft);
  border-radius: var(--radius-card);
  background: var(--surface-2);
}

.conclusion-strip small {
  color: var(--muted);
  font-size: var(--text-micro);
  font-weight: 700;
}

.conclusion-strip h2 {
  margin: var(--space-1) 0 0;
  color: var(--ink);
  font-size: var(--text-title);
  line-height: var(--leading-title);
}

.conclusion-strip h2 span {
  color: var(--ink-soft);
  font-weight: 600;
}

.conclusion-strip p {
  margin: var(--space-2) 0 0;
  color: var(--muted);
  font-size: var(--text-meta);
}

.conclusion-strip p.conclusion-strip__action {
  flex: none;
  max-width: 220px;
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-control);
  color: var(--ink-soft);
  font-size: var(--text-label);
  line-height: var(--leading-body);
  text-align: right;
}

.work-context {
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(150px, 1fr) minmax(130px, 0.8fr) minmax(
      170px,
      1fr
    );
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--line);
  border-left: 3px solid var(--brand);
  border-radius: var(--radius-card);
  background: var(--surface);
}

.work-context--quiet {
  padding: var(--space-2) var(--space-3);
  border-left-width: 2px;
  opacity: 0.88;
}

.context-icon {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-control);
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.work-context > span:not(.context-icon):not(.current-owner),
.current-owner > span {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.work-context small {
  color: var(--muted);
  font-size: var(--text-micro);
}

.work-context b {
  overflow-wrap: anywhere;
  color: var(--ink);
  font-size: var(--text-meta);
}

.current-owner {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--space-2);
  padding-left: var(--space-3);
  border-left: 1px solid var(--line);
}

.current-owner > svg {
  color: var(--brand-strong);
}

.workbench-grid {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(220px, 0.55fr) minmax(430px, 1.45fr) minmax(
      280px,
      0.75fr
    );
  align-items: start;
  gap: var(--space-3);
}

.workbench-grid--closed {
  grid-template-columns: minmax(200px, 0.42fr) minmax(0, 1.58fr);
}

.workbench-pane {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
  overflow: hidden;
}

.workbench-pane--queue {
  position: sticky;
  top: var(--space-3);
}

.workbench-grid--closed .workbench-pane--queue {
  opacity: 0.9;
}

@media (max-width: 1280px) {
  .workbench-grid {
    grid-template-columns: minmax(220px, 0.55fr) minmax(0, 1.45fr);
  }

  .workbench-pane:last-child {
    grid-column: 1 / -1;
  }

  .workbench-grid--closed .workbench-pane:last-child {
    grid-column: auto;
  }

  .workbench-pane--queue {
    position: static;
  }
}

@media (max-width: 680px) {
  .work-context,
  .workbench-grid,
  .workbench-grid--closed,
  .conclusion-strip {
    grid-template-columns: 1fr;
    display: grid;
  }

  .conclusion-strip__action {
    max-width: none;
    text-align: left;
  }

  .work-context {
    padding-left: var(--space-4);
  }

  .context-icon {
    display: none;
  }

  .current-owner {
    padding: var(--space-2) 0 0;
    border-top: 1px solid var(--line);
    border-left: 0;
  }

  .workbench-pane:last-child {
    grid-column: auto;
  }
}
</style>
