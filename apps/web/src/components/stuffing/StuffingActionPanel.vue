<script setup lang="ts">
import { ArrowRight, CheckCircle2, Clock3 } from "@lucide/vue";
import { computed } from "vue";
import type { ContainerStuffingSnapshot } from "../../api/containerStuffing";
import type { ContainerCargoScope } from "../../api/containers";
import type {
  LifecycleDateFact,
  RecordLifecycleDateFactResult,
} from "../../api/lifecycleDateFacts";
import type { NodeTaskDetail } from "../../api/nodeTasks";
import type { StuffingSnapshotDraft } from "../../composables/useStuffingCommands";
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
import StuffingActualTimeForm from "./StuffingActualTimeForm.vue";
import StuffingSnapshotForm from "./StuffingSnapshotForm.vue";

const props = defineProps<{
  containerNumber: string | null;
  cargo: ContainerCargoScope | null;
  snapshot: ContainerStuffingSnapshot | null;
  actualFact: LifecycleDateFact | null;
  task: NodeTaskDetail | null;
  submission: SubmissionView | null;
  taskSubmitting: boolean;
  snapshotSaving: boolean;
  snapshotError: string;
  snapshotMessage: string;
  dateSubmitting: boolean;
  dateError: string;
  dateResult: RecordLifecycleDateFactResult | null;
}>();

const emit = defineEmits<{
  saveSnapshot: [draft: StuffingSnapshotDraft];
  submitActual: [localDateTime: string];
  executeTask: [];
  retryTask: [];
}>();

const actionLabel = computed(() => {
  if (props.task?.nextAction?.actionCode === CLAIM_WORK_ORDER_ACTION)
    return CLAIM_WORK_ORDER_LABEL;
  if (props.task?.nextAction?.actionCode === COMPLETE_WORK_ORDER_ACTION)
    return COMPLETE_WORK_ORDER_LABEL;
  return null;
});
</script>

<template>
  <div class="action-panel">
    <header class="panel-header">
      <span
        ><small>当前操作</small>
        <h2>记录装箱并确认实际发生</h2></span
      ><CheckCircle2 :size="20" />
    </header>
    <StuffingSnapshotForm
      :container-number="containerNumber"
      :cargo="cargo"
      :snapshot="snapshot"
      :saving="snapshotSaving"
      :error="snapshotError"
      :message="snapshotMessage"
      @save="emit('saveSnapshot', $event)"
    />
    <StuffingActualTimeForm
      :snapshot="snapshot"
      :actual-fact="actualFact"
      :result="dateResult"
      :submitting="dateSubmitting"
      :error="dateError"
      @submit="emit('submitActual', $event)"
    />
    <section class="task-command">
      <header>
        <span>装箱工单</span
        ><b>{{
          task?.state === "completed"
            ? "已完成"
            : task?.nextAction
              ? "可处理"
              : "等待中"
        }}</b>
      </header>
      <p v-if="!task">这柜当前没有装箱工单。</p>
      <template v-else>
        <div v-if="task.nextAction?.dueAt" class="due">
          <Clock3 :size="13" />{{
            new Date(task.nextAction.dueAt).toLocaleString()
          }}
        </div>
        <button
          v-if="actionLabel"
          type="button"
          class="task-action"
          :disabled="taskSubmitting"
          @click="emit('executeTask')"
        >
          {{ taskSubmitting ? "正在提交…" : actionLabel
          }}<ArrowRight :size="15" />
        </button>
        <p v-else>
          {{
            task.state === "completed"
              ? "工单已落账。"
              : "当前没有服务端允许的工单动作。"
          }}
        </p>
        <SubmissionProgress
          v-if="submission"
          :submission="submission"
          :action-label="actionLabel ?? undefined"
          @retry="emit('retryTask')"
        />
      </template>
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
.panel-header small {
  color: var(--muted);
  font-size: 10px;
}
.panel-header h2 {
  margin: 0;
  font-size: 15px;
}
.panel-header > svg {
  color: var(--brand-strong);
}
.task-command > header {
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--surface-2);
  font-size: 12px;
}
.task-command > header b {
  color: var(--brand-strong);
  font-size: 10px;
}
.task-command > p,
.due {
  margin: 0;
  padding: 10px 12px;
  color: var(--muted);
  font-size: 11px;
}
.due {
  display: flex;
  align-items: center;
  gap: 5px;
}
.task-action {
  width: calc(100% - 24px);
  min-height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 0 12px 12px;
  border: 1px solid var(--brand);
  border-radius: var(--radius-control);
  background: var(--brand);
  color: var(--on-brand);
  font-weight: 700;
  cursor: pointer;
}
.task-action:disabled {
  opacity: 0.6;
}
.task-command :deep(.submission) {
  margin: 12px;
}
</style>
