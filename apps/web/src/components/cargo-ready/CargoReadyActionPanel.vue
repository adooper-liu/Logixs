<script setup lang="ts">
import { ArrowRight, CheckCircle2, Clock3, ShieldAlert } from "@lucide/vue";
import { computed } from "vue";
import type { NodeTaskDetail } from "../../api/nodeTasks";
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
  containerId: string;
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

const taskStateLabel = computed(() => {
  if (!props.task) return "未选择任务";
  if (props.task.state === "completed") return "备货任务已完成";
  if (props.task.state === "blocked") return "任务受阻";
  if (props.task.readinessState === "waiting_conditions") return "等待前序条件";
  if (props.task.nextAction) return "可以处理";
  return "等待下一动作";
});
</script>

<template>
  <div class="action-panel">
    <header class="panel-header">
      <span>
        <small>当前操作</small>
        <h2>{{ taskStateLabel }}</h2>
      </span>
      <CheckCircle2 :size="20" aria-hidden="true" />
    </header>

    <section v-if="!task" class="empty-state">
      从左侧任务队列选择一项工作，系统会显示当前允许的操作。
    </section>

    <template v-else>
      <section class="task-context">
        <div>
          <small>任务目标</small>
          <b>核对本柜备货条件并完成当前工单</b>
        </div>
        <div>
          <small>完成条件</small>
          <b>
            {{
              task.completionEligibility === "eligible"
                ? "条件已满足"
                : "仍需补齐证据"
            }}
          </b>
        </div>
        <div v-if="task.nextAction?.dueAt">
          <small>处理时限</small>
          <b>
            <Clock3 :size="13" />
            {{ new Date(task.nextAction.dueAt).toLocaleString() }}
          </b>
        </div>
      </section>

      <section v-if="task.nextAction" class="command-area">
        <p v-if="task.nextAction.actionCode === COMPLETE_WORK_ORDER_ACTION">
          系统将复用已核验的装载与合规事实，本步骤无需重复录入。
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
        <p v-else class="unsupported" role="alert">
          当前动作需在对应专业工作台处理。
        </p>
      </section>
      <p v-else class="no-action">
        {{
          task.state === "completed"
            ? "本任务已落账，无需再次提交。"
            : "当前没有可执行动作。请先处理页面列出的缺口或等待责任方完成前置工作。"
        }}
      </p>

      <SubmissionProgress
        v-if="submission"
        :submission="submission"
        :action-label="actionLabel ?? undefined"
        @retry="emit('retry')"
      />
    </template>

    <section class="remediation" aria-label="合规整改项">
      <header>
        <span> <ShieldAlert :size="16" aria-hidden="true" />合规整改 </span>
        <b>{{ remediationItems.length }}</b>
      </header>
      <p v-if="!remediationItems.length">当前没有开放的合规整改项。</p>
      <article v-for="item in remediationItems" :key="item.id">
        <b>{{ item.title }}</b>
        <span>{{ item.detail }}</span>
        <small>责任：{{ cargoReadyRoleLabel(item.assignedRoleCode) }}</small>
      </article>
      <router-link :to="{ path: '/compliance', query: { containerId } }">
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
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
}
.panel-header > span {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.panel-header small,
.task-context small,
.remediation small,
.remediation article > span {
  color: var(--muted);
  font-size: 10px;
}
.panel-header h2 {
  margin: 0;
  font-size: 16px;
}
.panel-header > svg {
  color: var(--brand-strong);
}
.empty-state,
.no-action,
.unsupported,
.remediation > p {
  margin: 0;
  padding: 16px 12px;
  color: var(--muted);
  font-size: 12px;
}
.task-context {
  display: grid;
  gap: 0;
}
.task-context > div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
}
.task-context b {
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-wrap: anywhere;
  font-size: 11px;
}
.command-area {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-bottom: 1px solid var(--line-strong);
  background: var(--brand-soft);
}
.command-area > p {
  margin: 0;
  color: var(--ink-soft);
  font-size: 11px;
}
.primary-action {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid var(--brand);
  border-radius: var(--radius-control);
  background: var(--brand);
  color: var(--on-brand);
  font-weight: 700;
  cursor: pointer;
}
.primary-action:disabled {
  cursor: wait;
  opacity: 0.6;
}
.action-panel :deep(.submission) {
  margin: 12px;
}
.remediation {
  border-top: 1px solid var(--line-strong);
}
.remediation > header {
  min-height: 38px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  background: var(--surface-2);
  font-size: 12px;
}
.remediation > header span,
.remediation a {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.remediation article {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 12px;
  border-top: 1px solid var(--line);
}
.remediation article > b {
  font-size: 11px;
}
.remediation a {
  min-height: 36px;
  padding: 8px 12px;
  border-top: 1px solid var(--line);
  color: var(--brand-strong);
  font-size: 11px;
  font-weight: 700;
  text-decoration: none;
}
</style>
