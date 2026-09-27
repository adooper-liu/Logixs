<script setup lang="ts">
import {
  AlertCircle,
  BriefcaseBusiness,
  LoaderCircle,
  RefreshCw,
  UserRound,
} from "@lucide/vue";
import { computed, shallowRef } from "vue";
import { useRoute, useRouter } from "vue-router";
import MarketSignalCreatePanel from "../components/market-signals/MarketSignalCreatePanel.vue";
import MarketSignalDecisionPanel from "../components/market-signals/MarketSignalDecisionPanel.vue";
import MarketSignalEvidencePanel from "../components/market-signals/MarketSignalEvidencePanel.vue";
import MarketSignalOperationReceipt from "../components/market-signals/MarketSignalOperationReceipt.vue";
import MarketSignalQueue from "../components/market-signals/MarketSignalQueue.vue";
import PageHeader from "../components/ui/PageHeader.vue";
import { useMarketSignalWorkbench } from "../composables/useMarketSignalWorkbench";
import type { ManualMarketSignalDraft } from "../data/marketSignalScenarios";

const route = useRoute();
const router = useRouter();
const showCreatePanel = shallowRef(false);

const requestedSignalId = computed(() => String(route.query.signalId ?? ""));

async function selectSignal(id: string): Promise<void> {
  await router.replace({
    path: "/workspaces/market-signals",
    query: { signalId: id },
  });
}

const {
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
} = useMarketSignalWorkbench({
  selectedId: requestedSignalId,
  selectSignal,
});

async function createSignal(draft: ManualMarketSignalDraft): Promise<void> {
  const created = await registerSignal(draft);
  if (created) showCreatePanel.value = false;
}
</script>

<template>
  <main class="market-workbench page-frame">
    <PageHeader
      eyebrow="经营岗位工作台"
      title="市场与经营信号"
      summary="看清变化依据，给每条信号一个明确去向；不要求先做产品方案，也不因普通资料未齐而停住。"
    />

    <section v-if="error" class="operation-error" role="alert">
      <AlertCircle :size="17" aria-hidden="true" />
      <span>{{ error }}</span>
      <button type="button" @click="loadSignals">
        <RefreshCw :size="15" aria-hidden="true" />重新加载
      </button>
    </section>

    <section v-else-if="loading" class="loading-state" role="status">
      <LoaderCircle :size="17" aria-hidden="true" />正在读取经营信号
    </section>

    <section class="work-context" aria-label="当前岗位与处理目标">
      <span class="context-icon"
        ><BriefcaseBusiness :size="18" aria-hidden="true"
      /></span>
      <span><small>谁在工作</small><b>经营与市场负责人</b></span>
      <span><small>本次结果</small><b>判断信号去向</b></span>
      <span class="current-owner">
        <UserRound :size="16" aria-hidden="true" />
        <span
          ><small>当前责任</small
          ><b>{{ selectedSignal?.owner || "经营与市场团队" }}</b></span
        >
      </span>
    </section>

    <MarketSignalCreatePanel
      v-if="showCreatePanel"
      @create="createSignal"
      @cancel="showCreatePanel = false"
    />

    <MarketSignalOperationReceipt
      v-if="receipt"
      :receipt="receipt"
      @dismiss="clearReceipt"
    />

    <div class="workbench-grid">
      <section
        class="workbench-pane workbench-pane--queue"
        aria-label="待处理信号"
      >
        <MarketSignalQueue
          :items="queueItems"
          :selected-id="selectedSignal?.id ?? ''"
          @select="selectSignal"
          @create="showCreatePanel = true"
        />
      </section>
      <section class="workbench-pane" aria-label="信号事实与依据">
        <MarketSignalEvidencePanel
          v-if="selectedSignal"
          :signal="selectedSignal"
          @supplement="supplementSignal"
        />
        <p v-else class="empty-workbench">
          暂无经营信号。登记一条刚发生的市场变化后即可开始判断。
        </p>
      </section>
      <section class="workbench-pane" aria-label="信号处理动作">
        <MarketSignalDecisionPanel
          v-if="selectedSignal"
          v-model="selectedDraft"
          :busy="saving"
          @submit="submitDecision"
        />
        <p v-else class="empty-workbench">选择一条信号后显示可执行动作。</p>
      </section>
    </div>
  </main>
</template>

<style scoped>
.market-workbench {
  min-width: 0;
}

.operation-error,
.loading-state {
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
  grid-template-columns: minmax(260px, 0.7fr) minmax(430px, 1.4fr) minmax(
      300px,
      0.8fr
    );
  align-items: start;
  gap: var(--space-3);
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

@media (max-width: 1280px) {
  .workbench-grid {
    grid-template-columns: minmax(260px, 0.65fr) minmax(0, 1.35fr);
  }

  .workbench-pane:last-child {
    grid-column: 1 / -1;
  }

  .workbench-pane--queue {
    position: static;
  }
}

@media (max-width: 680px) {
  .work-context,
  .workbench-grid {
    grid-template-columns: 1fr;
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
