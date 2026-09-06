<script setup lang="ts">
import { ChevronDown, ChevronUp } from "@lucide/vue";
import { computed, shallowRef, watch } from "vue";
import type {
  ContainerProjection,
  SubmissionView,
  TaskItem,
} from "../../data/sample";
import SubmissionProgress from "./SubmissionProgress.vue";
import TaskContextHeader from "./TaskContextHeader.vue";
import TaskEvidencePanel from "./TaskEvidencePanel.vue";
import TaskFocusFlow from "./TaskFocusFlow.vue";
import TaskInputPanel from "./TaskInputPanel.vue";
import TaskPreconditionPanel from "./TaskPreconditionPanel.vue";
import TaskResultPanel from "./TaskResultPanel.vue";
import { buildTaskFocus, type TaskFocusStepCode } from "./taskFocusContract";

const props = defineProps<{
  task: TaskItem;
  container: ContainerProjection;
  submission: SubmissionView;
  canSubmit: boolean;
  isSubmitting: boolean;
}>();

const emit = defineEmits<{
  claimTask: [];
  acknowledgeInput: [inputId: string];
  verifyEvidence: [evidenceId: string, value?: string];
  executeAction: [actionCode: string];
  reportException: [detail: string];
  retrySubmission: [];
}>();

const exceptionOpen = shallowRef(false);
const exceptionDetail = shallowRef("");
const showSupporting = shallowRef(false);
const focus = computed(() => buildTaskFocus(props.task, props.submission));
const submittedActionLabel = computed(
  () =>
    props.task.actions.find(
      (action) => action.actionCode === props.submission.actionCode,
    )?.label,
);
type WorkPanelCode = Extract<
  TaskFocusStepCode,
  "preconditions" | "inputs" | "evidence"
>;

const availablePanels = computed<WorkPanelCode[]>(() => {
  const panels: WorkPanelCode[] = [];
  if (props.task.preconditions.length) panels.push("preconditions");
  if (props.task.requiredInputs.length) panels.push("inputs");
  if (props.task.evidenceRequirements.length) panels.push("evidence");
  return panels;
});
const currentWorkPanel = computed<WorkPanelCode | undefined>(() => {
  const code = focus.value.currentCode;
  return availablePanels.value.includes(code as WorkPanelCode)
    ? (code as WorkPanelCode)
    : undefined;
});
const supportingPanels = computed(() =>
  availablePanels.value.filter((panel) => panel !== currentWorkPanel.value),
);
const isPanelComplete = (panel: WorkPanelCode) => {
  if (panel === "preconditions") {
    return props.task.preconditions.every((item) => item.state === "met");
  }
  if (panel === "inputs") {
    return props.task.requiredInputs.every((item) => item.state === "ready");
  }
  return props.task.evidenceRequirements
    .filter((item) => item.required)
    .every((item) => item.state === "verified");
};
const supportingCompleteCount = computed(
  () => supportingPanels.value.filter(isPanelComplete).length,
);

watch([() => props.task.taskId, () => focus.value.currentCode], () => {
  showSupporting.value = false;
});

const submitException = () => {
  const detail = exceptionDetail.value.trim();
  if (!detail) return;
  emit("reportException", detail);
  exceptionOpen.value = false;
  exceptionDetail.value = "";
};
</script>

<template>
  <div class="execution">
    <TaskContextHeader :task="task" :container="container" />

    <div class="focus-command">
      <TaskFocusFlow :steps="focus.steps" :current-code="focus.currentCode" />

      <TaskResultPanel
        :task="task"
        :can-submit="canSubmit"
        :is-submitting="isSubmitting"
        :attention-label="focus.attentionLabel"
        @claim="emit('claimTask')"
        @execute="emit('executeAction', $event)"
        @open-exception="exceptionOpen = true"
      />
    </div>

    <SubmissionProgress
      v-if="submission.stage !== 'idle'"
      data-testid="submission-progress"
      :submission="submission"
      :action-label="submittedActionLabel"
      @retry="emit('retrySubmission')"
    />

    <section
      v-if="currentWorkPanel"
      class="work-surface current-workspace"
      aria-label="当前工作区"
      data-testid="current-workspace"
    >
      <TaskPreconditionPanel
        v-if="currentWorkPanel === 'preconditions'"
        :key="`${task.taskId}-current-preconditions`"
        :conditions="task.preconditions"
        attention
        open-by-default
      />
      <TaskInputPanel
        v-else-if="currentWorkPanel === 'inputs'"
        :key="`${task.taskId}-current-inputs`"
        :inputs="task.requiredInputs"
        attention
        open-by-default
        @acknowledge="emit('acknowledgeInput', $event)"
      />
      <TaskEvidencePanel
        v-else-if="currentWorkPanel === 'evidence'"
        :key="`${task.taskId}-current-evidence`"
        :task-id="task.taskId"
        :evidence="task.evidenceRequirements"
        attention
        open-by-default
        @verify="
          (evidenceId, value) => emit('verifyEvidence', evidenceId, value)
        "
      />
    </section>

    <div v-if="supportingPanels.length" class="requirements">
      <button
        class="requirements-toggle"
        type="button"
        :aria-expanded="showSupporting"
        aria-controls="supporting-requirements"
        data-testid="requirements-disclosure"
        @click="showSupporting = !showSupporting"
      >
        <span>
          <b>全部要求</b>
          <small
            >{{ supportingCompleteCount }}/{{
              supportingPanels.length
            }}
            环节已完成</small
          >
        </span>
        <ChevronUp v-if="showSupporting" :size="16" aria-hidden="true" />
        <ChevronDown v-else :size="16" aria-hidden="true" />
      </button>

      <section
        v-if="showSupporting"
        id="supporting-requirements"
        class="work-surface supporting-requirements"
        aria-label="其他任务要求"
        data-testid="supporting-requirements"
      >
        <TaskPreconditionPanel
          v-if="supportingPanels.includes('preconditions')"
          :key="`${task.taskId}-supporting-preconditions`"
          :conditions="task.preconditions"
        />
        <TaskInputPanel
          v-if="supportingPanels.includes('inputs')"
          :key="`${task.taskId}-supporting-inputs`"
          :inputs="task.requiredInputs"
          @acknowledge="emit('acknowledgeInput', $event)"
        />
        <TaskEvidencePanel
          v-if="supportingPanels.includes('evidence')"
          :key="`${task.taskId}-supporting-evidence`"
          :task-id="task.taskId"
          :evidence="task.evidenceRequirements"
          @verify="
            (evidenceId, value) => emit('verifyEvidence', evidenceId, value)
          "
        />
      </section>
    </div>

    <el-dialog
      v-model="exceptionOpen"
      title="上报作业异常"
      width="min(440px, 92vw)"
    >
      <label class="exception-field">
        <span>异常说明</span>
        <textarea
          v-model="exceptionDetail"
          rows="4"
          placeholder="说明发生了什么、影响范围以及当前是否阻塞"
        ></textarea>
      </label>
      <template #footer>
        <button class="secondary" type="button" @click="exceptionOpen = false">
          取消
        </button>
        <button
          class="danger solid"
          type="button"
          :disabled="!exceptionDetail.trim()"
          @click="submitException"
        >
          确认上报
        </button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.execution {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.focus-command {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(320px, 0.85fr);
  gap: 12px;
  align-items: stretch;
}

.work-surface {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--surface);
}

.work-surface > :last-child {
  border-bottom: 0;
}

.current-workspace {
  border-left: 3px solid var(--brand);
}

.requirements {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.requirements-toggle {
  min-height: 38px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 11px;
  border: 1px solid var(--line);
  border-radius: var(--radius-s);
  background: var(--surface);
  color: var(--ink-soft);
  cursor: pointer;
}

.requirements-toggle > span {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.requirements-toggle b {
  color: var(--ink);
  font-size: 12px;
}

.requirements-toggle small {
  color: var(--muted);
  font-size: 10px;
}

.requirements-toggle svg {
  flex: none;
}

.exception-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.exception-field textarea {
  width: 100%;
  padding: 9px 10px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-s);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
}

.secondary,
.danger {
  min-height: 34px;
  padding: 7px 12px;
  border-radius: var(--radius-s);
  font-weight: 600;
  cursor: pointer;
}

.secondary {
  border: 1px solid var(--line-strong);
  background: var(--surface);
  color: var(--ink-soft);
}

.danger {
  border: 1px solid var(--risk);
  background: var(--surface);
  color: var(--risk);
}

.danger.solid {
  background: var(--risk);
  color: var(--on-risk);
}

.danger:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

@media (max-width: 1279px) {
  .focus-command {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .execution {
    gap: 10px;
  }

  .requirements-toggle {
    min-height: var(--touch-target);
  }
}
</style>
