<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { isEvidenceUuid } from "../api/evidence";
import CustomsActionPanel from "../components/customs/CustomsActionPanel.vue";
import CustomsCasePanel from "../components/customs/CustomsCasePanel.vue";
import CustomsWorkQueue from "../components/customs/CustomsWorkQueue.vue";
import TaskArchivePanel from "../components/task/TaskArchivePanel.vue";
import TaskContextPanel from "../components/task/TaskContextPanel.vue";
import type { TaskContextPanelMode } from "../components/task/TaskContextPanel.vue";
import RoleWorkbenchFrame from "../components/workbench/RoleWorkbenchFrame.vue";
import {
  useCustomsCommands,
  type CustomsCaseDraft,
} from "../composables/useCustomsCommands";
import { useCustomsWorkbench } from "../composables/useCustomsWorkbench";
import { useStuffingTaskOperation } from "../composables/useStuffingTaskOperation";
import {
  useTaskAiAssistance,
  type TaskAiAssistanceContext,
  type TaskAiAssistancePanelModel,
  type TaskAiAssistanceRetryTarget,
} from "../composables/useTaskAiAssistance";
import {
  useTaskCollaboration,
  type TaskCollaborationContext,
  type TaskCollaborationRetryTarget,
} from "../composables/useTaskCollaboration";
import type { CustomsQueueItem } from "../data/customsWorkbench";

const route = useRoute();
const router = useRouter();
const containerId = computed(() =>
  String(route.query.containerId ?? "").trim(),
);
const taskId = computed(() => String(route.query.taskId ?? "").trim());
const {
  selectedContainer,
  nodes,
  queueItems,
  selectedTask,
  customsNode,
  clearanceCase,
  dates,
  arrivalFact,
  customsActualFact,
  loading,
  queueLoading,
  error,
  warnings,
  loadQueue,
  reload,
} = useCustomsWorkbench(containerId, taskId);
const commands = useCustomsCommands(reload);
const taskOperation = useStuffingTaskOperation(
  selectedTask,
  clearanceCase,
  reload,
);
const contextMode = shallowRef<TaskContextPanelMode>("work");
const contextModeLabels: Record<TaskContextPanelMode, string> = {
  work: "办理",
  archive: "档案",
  collaboration: "协作",
  ai: "AI 辅助",
};
const taskContextKey = computed(() =>
  selectedContainer.value && selectedTask.value
    ? `container:${selectedContainer.value.id}|node_task:${selectedTask.value.id}`
    : null,
);
const taskSubjectRef = computed(() =>
  selectedContainer.value
    ? { kind: "container" as const, id: selectedContainer.value.id }
    : null,
);
const taskWorkRef = computed(() =>
  selectedTask.value
    ? { kind: "node_task" as const, id: selectedTask.value.id }
    : null,
);
const collaborationContext = computed<TaskCollaborationContext | null>(() =>
  taskContextKey.value &&
  selectedTask.value &&
  taskSubjectRef.value &&
  taskWorkRef.value
    ? {
        contextKey: taskContextKey.value,
        taskId: selectedTask.value.id,
        subjectRef: taskSubjectRef.value,
        workRef: taskWorkRef.value,
      }
    : null,
);
const collaboration = useTaskCollaboration(collaborationContext);
const availableAiContext = computed<TaskAiAssistanceContext | null>(() =>
  taskContextKey.value &&
  selectedTask.value &&
  taskSubjectRef.value &&
  taskWorkRef.value &&
  isEvidenceUuid(taskSubjectRef.value.id) &&
  isEvidenceUuid(taskWorkRef.value.id)
    ? {
        contextKey: taskContextKey.value,
        taskId: selectedTask.value.id,
        subjectRef: taskSubjectRef.value,
        workRef: taskWorkRef.value,
      }
    : null,
);
const aiRefreshInFlight = shallowRef(false);
const aiActivatedContextKey = shallowRef<string | null>(null);
const aiContext = computed<TaskAiAssistanceContext | null>(() =>
  availableAiContext.value?.contextKey === aiActivatedContextKey.value
    ? availableAiContext.value
    : null,
);
const formContainer = shallowRef(selectedContainer.value);
const formClearanceCase = shallowRef(clearanceCase.value);
const aiAssistance = useTaskAiAssistance(aiContext, {
  refreshTask: refreshTaskForAi,
});
const aiPanelModel = computed<TaskAiAssistancePanelModel | null>(() => {
  const task = selectedTask.value;
  const selected = selectedContainer.value;
  if (!availableAiContext.value || !task || !selected) return null;
  return {
    ...aiAssistance,
    facts: {
      objectLabel:
        selected.containerNumber ?? selected.orderNumber ?? "货柜待选择",
      taskLabel: customsNode.value?.name ?? "清关任务",
      actionLabel: "领取",
      responsibilityLabel: taskResponsibility(task),
      dueLabel: task.nextAction?.dueAt
        ? formatDueAt(task.nextAction.dueAt)
        : "未设截止",
    },
  };
});
const contextModes = computed<readonly TaskContextPanelMode[]>(() => {
  if (!collaborationContext.value) return ["work"];
  return availableAiContext.value
    ? ["work", "archive", "collaboration", "ai"]
    : ["work", "archive", "collaboration"];
});
const contextLabel = computed(() =>
  contextMode.value === "work"
    ? "清关办理"
    : `任务上下文 · ${contextModeLabels[contextMode.value]}`,
);
const contextSummary = computed(() =>
  contextMode.value === "archive"
    ? "核对记录"
    : contextMode.value === "collaboration"
      ? "共同处理"
      : contextMode.value === "ai"
        ? "核对建议"
        : collaborationContext.value
          ? "继续办理"
          : "待选择",
);
const mobileContextLabel = computed(() => contextModeLabels[contextMode.value]);
const currentContainerLabel = computed(
  () =>
    selectedContainer.value?.containerNumber ??
    selectedContainer.value?.orderNumber ??
    "货柜待选择",
);
const currentTaskLabel = computed(() =>
  selectedTask.value ? "清关任务" : "清关任务待选择",
);
const currentNodeLabel = computed(() =>
  customsNode.value
    ? `${String(customsNode.value.sequence).padStart(2, "0")} ${customsNode.value.name}`
    : "清关节点待加载",
);
onMounted(() => void loadQueue());

watch(
  taskContextKey,
  (nextContextKey, previousContextKey) => {
    contextMode.value = "work";
    if (!aiRefreshInFlight.value && nextContextKey !== previousContextKey) {
      aiActivatedContextKey.value = null;
    }
  },
  { flush: "sync" },
);

watch(
  contextMode,
  (mode) => {
    if (mode === "ai" && availableAiContext.value) {
      aiActivatedContextKey.value = availableAiContext.value.contextKey;
    }
  },
  { flush: "sync" },
);

watch(
  clearanceCase,
  (value) => {
    if (!aiRefreshInFlight.value || value) formClearanceCase.value = value;
  },
  { immediate: true },
);

watch(
  selectedContainer,
  (value) => {
    if (!aiRefreshInFlight.value || value) formContainer.value = value;
  },
  { immediate: true },
);

function formatDueAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function taskResponsibility(task: NonNullable<typeof selectedTask.value>) {
  if (task.state === "completed") return "未知";
  if (task.nextAction?.assigneeId) return "已分配人员";
  if (task.nextAction?.assignmentState === "automatic") return "系统";
  return "待领取";
}

async function refreshTaskForAi(): Promise<void> {
  const requestContextKey = taskContextKey.value;
  aiRefreshInFlight.value = true;
  try {
    await reload();
  } finally {
    aiRefreshInFlight.value = false;
  }
  if (requestContextKey && taskContextKey.value === requestContextKey) {
    contextMode.value = "ai";
  }
}

function selectTask(item: CustomsQueueItem) {
  if (!item.task.containerId) return;
  void router.replace({
    path: "/workspaces/customs",
    query: { containerId: item.task.containerId, taskId: item.task.id },
  });
}

function saveCase(draft: CustomsCaseDraft) {
  if (containerId.value) void commands.saveCase(containerId.value, draft);
}

function submitActual(localDateTime: string) {
  if (!containerId.value || !clearanceCase.value) return;
  void commands.submitActual({
    containerId: containerId.value,
    localDateTime,
    expectedVersion: dates.value?.projectionVersion ?? 0,
    clearanceCase: clearanceCase.value,
  });
}

function submitCollaboration(): void {
  void collaboration.send();
}

function retryCollaboration(target: TaskCollaborationRetryTarget): void {
  if (target === "thread") void collaboration.refresh();
  else void collaboration.retrySend();
}

function loadMoreCollaboration(): void {
  void collaboration.loadMore();
}

function confirmAi(): void {
  void aiAssistance.confirm();
}

function rejectAi(reason?: string): void {
  void aiAssistance.reject(reason);
}

function retryAi(target: TaskAiAssistanceRetryTarget): void {
  void aiAssistance.retry(target);
}

function refreshAi(): void {
  void aiAssistance.refresh();
}
</script>

<template>
  <RoleWorkbenchFrame
    stage-code="customs"
    workspace-label="进口清关"
    node-scope-label="进口清关"
    :selected-container="formContainer"
    :nodes="nodes"
    :selection-loading="loading && !aiRefreshInFlight"
    :container-list-error="error"
    :selection-error="error"
    :warnings="warnings"
    :context-label="contextLabel"
    :context-summary="contextSummary"
    :mobile-context-label="mobileContextLabel"
  >
    <template #queue>
      <CustomsWorkQueue
        :items="queueItems"
        :selected-task-id="selectedTask?.id ?? taskId"
        :loading="queueLoading"
        @select="selectTask"
      />
    </template>
    <template #primary>
      <CustomsCasePanel
        :clearance-case="clearanceCase"
        :arrival-fact="arrivalFact"
        :customs-actual-fact="customsActualFact"
        :node="customsNode"
      />
    </template>
    <template #secondary>
      <div class="customs-context">
        <TaskContextPanel
          v-if="formContainer"
          v-model="contextMode"
          :context-key="taskContextKey"
          :modes="contextModes"
          :collaboration="collaboration"
          :ai="aiPanelModel"
          @submit="submitCollaboration"
          @retry="retryCollaboration"
          @load-more="loadMoreCollaboration"
          @confirm-ai="confirmAi"
          @reject-ai="rejectAi"
          @retry-ai="retryAi"
          @refresh-ai="refreshAi"
        >
          <template #anchor>
            <section
              class="customs-context__anchor"
              aria-label="当前清关上下文"
            >
              <dl>
                <div>
                  <dt>当前货柜：</dt>
                  <dd>{{ currentContainerLabel }}</dd>
                </div>
                <div>
                  <dt>当前任务：</dt>
                  <dd>{{ currentTaskLabel }}</dd>
                </div>
                <div>
                  <dt>当前节点：</dt>
                  <dd>{{ currentNodeLabel }}</dd>
                </div>
              </dl>
            </section>
          </template>
          <template #work>
            <CustomsActionPanel
              :clearance-case="formClearanceCase"
              :task="selectedTask"
              :projection-version="dates?.projectionVersion ?? 0"
              :saving="commands.saving.value"
              :save-error="commands.saveError.value"
              :save-message="commands.saveMessage.value"
              :date-submitting="commands.dateSubmitting.value"
              :date-error="commands.dateError.value"
              :date-result="commands.dateResult.value"
              :task-submitting="taskOperation.submitting.value"
              @save="saveCase"
              @submit-actual="submitActual"
              @execute-task="taskOperation.execute()"
            />
          </template>
          <template #archive>
            <TaskArchivePanel
              v-if="selectedTask"
              :container-id="formContainer.id"
              :task-id="selectedTask.id"
              :outcome="selectedTask.outcome"
            />
          </template>
        </TaskContextPanel>
      </div>
    </template>
  </RoleWorkbenchFrame>
</template>

<style scoped>
.customs-context {
  min-width: 0;
}

.customs-context__anchor {
  display: none;
}

@media (max-width: 680px) {
  .customs-context__anchor {
    display: block;
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--line);
    background: var(--surface);
  }

  .customs-context__anchor dl {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2) var(--space-3);
    margin: 0;
  }

  .customs-context__anchor dl > div {
    min-width: 0;
  }

  .customs-context__anchor dl > div:first-child {
    grid-column: 1 / -1;
  }

  .customs-context__anchor dt,
  .customs-context__anchor dd {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .customs-context__anchor dt {
    color: var(--muted);
    font-size: var(--text-micro);
  }

  .customs-context__anchor dd {
    color: var(--ink);
    font-size: var(--text-label);
    font-weight: 600;
  }
}
</style>
