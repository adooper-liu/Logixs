<script setup lang="ts">
import { ArrowRight, CheckCircle2, Clock3, ShieldAlert } from "@lucide/vue";
import { computed } from "vue";
import type { NodeTaskDetail } from "../../api/nodeTasks";
import type { ReplenishmentOrderWorkbenchItem } from "../../api/replenishmentOrders";
import type { ExternalWorkItem } from "../../api/workItems";
import { cargoReadyRoleLabel } from "../../data/cargoReadyWorkbench";
import {
  CLAIM_WORK_ORDER_ACTION,
  CLAIM_WORK_ORDER_LABEL,
} from "../../data/claimReceiptContract";
import {
  COMPLETE_WORK_ORDER_ACTION,
  COMPLETE_WORK_ORDER_LABEL,
} from "../../data/completeReceiptContract";
import type { SubmissionView } from "../../data/sample";
import SubmissionProgress from "../task/SubmissionProgress.vue";

const props = defineProps<{
  order: ReplenishmentOrderWorkbenchItem;
  task: NodeTaskDetail | null;
  remediationItems: readonly ExternalWorkItem[];
  submission: SubmissionView | null;
  submitting: boolean;
}>();

const emit = defineEmits<{
  execute: [];
  retry: [];
}>();

const actionLabel = computed(() => {
  if (props.task?.nextAction?.actionCode === CLAIM_WORK_ORDER_ACTION)
    return CLAIM_WORK_ORDER_LABEL;
  if (props.task?.nextAction?.actionCode === COMPLETE_WORK_ORDER_ACTION)
    return COMPLETE_WORK_ORDER_LABEL;
  return null;
});

const actionState = computed(() => {
  if (props.task?.state === "completed") return "备货确认已落账";
  if (actionLabel.value) return "现在可以处理";
  if (props.order.workReason.responsibility === "waiting_other")
    return "正在等待责任岗";
  return props.order.nextAction?.label ?? "等待下一动作";
});

const primaryContainerId = computed(
  () => props.order.relatedContainers[0]?.id ?? null,
);

const pendingCapability = computed(() => {
  const code = props.order.nextAction?.code;
  if (actionLabel.value || !code) return null;
  if (code === "master_data.review_product")
    return "物料属性写入需由主数据服务返回可提交动作。当前缺口已定位，但尚无可执行写入口。";
  if (code === "shipment.resolve_sku_identity")
    return "SKU 匹配需由导入或主数据服务返回候选与确认动作。当前不能在此直接落库。";
  if (code === "shipment.allocate_cargo")
    return "装柜分配需由装载服务返回候选货柜和数量校验。当前不能在此直接落库。";
  if (code === "work_execution.continue_cargo_ready")
    return "关联货柜尚未返回可执行的备货工单，请等待节点初始化或刷新。";
  return "当前没有可安全提交的服务端动作。";
});

const canImportLines = computed(
  () => props.order.nextAction?.code === "replenishment.import",
);
</script>

<template>
  <div class="action-panel">
    <header class="panel-header">
      <span>
        <small>现在可以做什么</small>
        <h2>{{ actionState }}</h2>
      </span>
      <CheckCircle2 :size="20" aria-hidden="true" />
    </header>

    <section class="task-context">
      <div>
        <small>当前原因</small>
        <b>{{ order.workReason.detail }}</b>
      </div>
      <div>
        <small>完成标准</small>
        <b> SKU 身份与必要属性明确，适用资料齐全，并完成本次装柜分配 </b>
      </div>
      <div v-if="task?.nextAction?.dueAt">
        <small>处理时限</small>
        <b
          ><Clock3 :size="13" />{{
            new Date(task.nextAction.dueAt).toLocaleString()
          }}</b
        >
      </div>
    </section>

    <section v-if="actionLabel || canImportLines" class="command-area">
      <p v-if="task?.nextAction?.actionCode === COMPLETE_WORK_ORDER_ACTION">
        系统将复用已核验的物料、装载与合规事实，无需重复录入。
      </p>
      <button
        v-if="actionLabel"
        type="button"
        class="primary-action"
        :disabled="submitting"
        @click="emit('execute')"
      >
        {{ submitting ? "正在提交…" : actionLabel }}
        <ArrowRight :size="16" aria-hidden="true" />
      </button>
      <router-link v-else class="primary-action" to="/import">
        导入备货明细<ArrowRight :size="16" aria-hidden="true" />
      </router-link>
    </section>

    <p v-else-if="pendingCapability" class="pending-capability">
      {{ pendingCapability }}
    </p>
    <p v-else class="no-action">
      当前无需操作。页面会在责任岗完成前置工作后刷新可执行动作。
    </p>

    <SubmissionProgress
      v-if="submission"
      :submission="submission"
      :action-label="actionLabel ?? undefined"
      @retry="emit('retry')"
    />

    <section class="remediation" aria-label="相关合规整改">
      <header>
        <span><ShieldAlert :size="16" aria-hidden="true" />等待合规处理</span>
        <b>{{ remediationItems.length }}</b>
      </header>
      <p v-if="!remediationItems.length">当前没有开放的合规整改项。</p>
      <article v-for="item in remediationItems" :key="item.id">
        <b>{{ item.title }}</b>
        <span>{{ item.detail }}</span>
        <small>责任：{{ cargoReadyRoleLabel(item.assignedRoleCode) }}</small>
      </article>
      <router-link
        v-if="primaryContainerId"
        :to="{
          path: '/compliance',
          query: { containerId: primaryContainerId },
        }"
      >
        进入合规处理<ArrowRight :size="14" aria-hidden="true" />
      </router-link>
    </section>
  </div>
</template>

<style scoped>
.action-panel {
  min-width: 0;
}

.panel-header {
  min-height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3);
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
}

.panel-header > span {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.panel-header small,
.task-context small,
.remediation small,
.remediation article > span {
  color: var(--muted);
  font-size: var(--text-micro);
}

.panel-header h2 {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: var(--text-title);
}

.panel-header > svg {
  flex: none;
  color: var(--brand-strong);
}

.task-context {
  display: grid;
}

.task-context > div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3);
  border-bottom: 1px solid var(--line);
}

.task-context b {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  overflow-wrap: anywhere;
  font-size: var(--text-micro);
}

.command-area {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3);
  border-bottom: 1px solid var(--line-strong);
  background: var(--brand-soft);
}

.command-area > p {
  margin: 0;
  color: var(--ink-soft);
  font-size: var(--text-micro);
}

.primary-action {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid var(--brand);
  border-radius: var(--radius-control);
  background: var(--brand);
  color: var(--on-brand);
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}

.primary-action:disabled {
  cursor: wait;
  opacity: 0.6;
}

.pending-capability,
.no-action,
.remediation > p {
  margin: 0;
  padding: var(--space-3);
  color: var(--muted);
  font-size: var(--text-label);
}

.pending-capability {
  border-left: 3px solid var(--warn);
  background: var(--warn-bg);
  color: var(--ink-soft);
}

.action-panel :deep(.submission) {
  margin: var(--space-3);
}

.remediation {
  border-top: 1px solid var(--line-strong);
}

.remediation > header {
  min-height: 38px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--surface-2);
  font-size: var(--text-label);
}

.remediation > header span,
.remediation a {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.remediation article {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3);
  border-top: 1px solid var(--line);
}

.remediation article > b {
  font-size: var(--text-micro);
}

.remediation a {
  min-height: 44px;
  padding: var(--space-2) var(--space-3);
  border-top: 1px solid var(--line);
  color: var(--brand-strong);
  font-size: var(--text-micro);
  font-weight: 700;
  text-decoration: none;
}
</style>
