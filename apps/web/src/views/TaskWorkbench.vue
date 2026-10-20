<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import TaskArchivePanel from "../components/task/TaskArchivePanel.vue";
import TaskContextPanel from "../components/task/TaskContextPanel.vue";
import type { TaskContextPanelMode } from "../components/task/TaskContextPanel.vue";
import TaskExecutionPanel from "../components/task/TaskExecutionPanel.vue";
import TaskFrozenResultPanel from "../components/task/TaskFrozenResultPanel.vue";
import TaskQueue from "../components/task/TaskQueue.vue";
import PageHeader from "../components/ui/PageHeader.vue";
import WorkbenchDecisionStrip from "../components/workbench/WorkbenchDecisionStrip.vue";
import WorkbenchLayout from "../components/workbench/WorkbenchLayout.vue";
import WorkbenchPane from "../components/workbench/WorkbenchPane.vue";
import WorkbenchResponsibilityBand from "../components/workbench/WorkbenchResponsibilityBand.vue";
import type {
  WorkbenchMobileScreen,
  WorkbenchPaneState,
  WorkbenchResponsibilityItem,
} from "../components/workbench/workbenchLayout.types";
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
import { useTaskWorkspace } from "../composables/useTaskWorkspace";

const {
  loading,
  loadingMore,
  moreError,
  hasMore,
  error,
  tasks,
  activeTaskId,
  activeTask,
  activeContainer,
  activeTaskOutcome,
  activeSubmission,
  canSubmit,
  isSubmitting,
  selectTask,
  claimTask,
  acknowledgeInput,
  verifyEvidence,
  executeAction,
  reportException,
  retrySubmission,
  refreshTask,
  loadMore,
} = useTaskWorkspace();

const route = useRoute();
const router = useRouter();
const scopedContainer = computed(() =>
  String(route.query.containerId ?? "").trim(),
);
const leftCollapsed = shallowRef(false);
const rightCollapsed = shallowRef(false);
const mobileScreen = shallowRef<WorkbenchMobileScreen>("queue");
const contextMode = shallowRef<TaskContextPanelMode>("work");
const contextModeLabels: Record<TaskContextPanelMode, string> = {
  work: "办理",
  archive: "档案",
  collaboration: "协作",
  ai: "AI 辅助",
};
const actionableStatuses = new Set([
  "available",
  "in_progress",
  "blocked",
  "under_review",
]);
const humanTaskCount = computed(
  () =>
    tasks.value.filter(
      (task) =>
        task.queueKind === "human" && actionableStatuses.has(task.status),
    ).length,
);
const monitorCount = computed(
  () => tasks.value.filter((task) => task.queueKind === "monitor").length,
);
const visibleTask = computed(() =>
  loading.value || error.value ? undefined : activeTask.value,
);
const visibleContainer = computed(() =>
  visibleTask.value ? activeContainer.value : undefined,
);
const visibleOutcome = computed(() =>
  visibleTask.value ? activeTaskOutcome.value : null,
);
const taskContextKey = computed(() =>
  visibleTask.value && visibleContainer.value
    ? `container:${visibleContainer.value.containerRecordId}|node_task:${visibleTask.value.taskId}`
    : null,
);
const taskSubjectRef = computed(() =>
  visibleContainer.value
    ? {
        kind: "container" as const,
        id: visibleContainer.value.containerRecordId,
      }
    : null,
);
const taskWorkRef = computed(() =>
  visibleTask.value
    ? { kind: "node_task" as const, id: visibleTask.value.taskId }
    : null,
);
const collaborationContext = computed<TaskCollaborationContext | null>(() =>
  taskContextKey.value &&
  visibleTask.value &&
  taskSubjectRef.value &&
  taskWorkRef.value
    ? {
        contextKey: taskContextKey.value,
        taskId: visibleTask.value.taskId,
        subjectRef: taskSubjectRef.value,
        workRef: taskWorkRef.value,
      }
    : null,
);
const collaboration = useTaskCollaboration(collaborationContext);
const aiContext = computed<TaskAiAssistanceContext | null>(() =>
  taskContextKey.value &&
  visibleTask.value &&
  taskSubjectRef.value &&
  taskWorkRef.value
    ? {
        contextKey: taskContextKey.value,
        taskId: visibleTask.value.taskId,
        subjectRef: taskSubjectRef.value,
        workRef: taskWorkRef.value,
      }
    : null,
);
const aiAssistance = useTaskAiAssistance(aiContext, {
  refreshTask: refreshTaskForAi,
});
const aiPanelModel = computed<TaskAiAssistancePanelModel | null>(() => {
  const task = visibleTask.value;
  if (!aiContext.value || !task) return null;
  return {
    ...aiAssistance,
    facts: {
      objectLabel: task.containerNumber,
      taskLabel: task.nodeName,
      actionLabel: "领取",
      responsibilityLabel:
        task.status === "completed" ? "未知" : task.assignment.label,
      dueLabel: task.dueAt ? formatDueAt(task.dueAt) : "未设截止",
    },
  };
});
const taskContextModes = computed<readonly TaskContextPanelMode[]>(() =>
  collaborationContext.value && aiContext.value
    ? ["work", "archive", "collaboration", "ai"]
    : ["work", "archive"],
);
const contextTitle = computed(
  () => `任务上下文 · ${contextModeLabels[contextMode.value]}`,
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

async function refreshTaskForAi(): Promise<void> {
  const requestContextKey = taskContextKey.value;
  const requestMobileScreen = mobileScreen.value;
  await refreshTask();
  if (requestContextKey && taskContextKey.value === requestContextKey) {
    contextMode.value = "ai";
    if (requestMobileScreen === "context") mobileScreen.value = "context";
  }
}

function submitCollaboration(): void {
  void collaboration.send();
}

function retryCollaboration(target: TaskCollaborationRetryTarget): void {
  if (target === "send") {
    void collaboration.retrySend();
    return;
  }
  void collaboration.refresh();
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

const responsibilityItems = computed<WorkbenchResponsibilityItem[]>(() => [
  visibleTask.value
    ? {
        label: "当前对象",
        value: `${visibleTask.value.containerNumber} · ${visibleTask.value.nodeName}`,
        state: "known",
      }
    : { label: "当前对象", value: "", state: "unknown" },
  visibleTask.value?.status === "completed"
    ? { label: "当前责任", value: "", state: "unknown" }
    : visibleTask.value
      ? {
          label: "当前责任",
          value: visibleTask.value.assignment.label,
          state: "known",
        }
      : { label: "当前责任", value: "", state: "unknown" },
  visibleTask.value?.dueAt
    ? {
        label: "期限",
        value: formatDueAt(visibleTask.value.dueAt),
        state: "known",
      }
    : { label: "期限", value: "", state: "unknown" },
]);

const decisionConclusion = computed(() => {
  if (!visibleTask.value) return "先从队列选择任务";
  return visibleTask.value.status === "completed"
    ? "已完成：核对冻结结果与当前可见档案"
    : "办理中：继续处理当前任务";
});

const queueState = computed<WorkbenchPaneState>(() => {
  if (loading.value) return { kind: "loading", message: "正在读取任务…" };
  if (error.value) return { kind: "error", message: error.value };
  if (!tasks.value.length)
    return { kind: "empty", message: "这一范围还没有任务。" };
  return { kind: "ready" };
});

const detailState = computed<WorkbenchPaneState>(() => {
  if (loading.value) return { kind: "loading", message: "正在读取任务详情…" };
  if (error.value) return { kind: "error", message: error.value };
  return visibleTask.value && visibleContainer.value
    ? { kind: "ready" }
    : { kind: "empty", message: "选择任务后查看详情。" };
});

const contextState = computed<WorkbenchPaneState>(() => {
  if (loading.value) return { kind: "loading", message: "正在读取任务上下文…" };
  if (error.value) return { kind: "error", message: error.value };
  return visibleTask.value && visibleContainer.value
    ? { kind: "ready" }
    : { kind: "empty", message: "选择任务后查看办理、档案、协作与 AI 辅助。" };
});

watch(
  taskContextKey,
  () => {
    contextMode.value = "work";
  },
  { flush: "sync" },
);

watch(
  [() => route.query.task, tasks],
  ([taskId]) => {
    if (
      typeof taskId === "string" &&
      tasks.value.some((task) => task.taskId === taskId)
    ) {
      selectTask(taskId);
      mobileScreen.value = "detail";
    } else if (typeof taskId !== "string") {
      mobileScreen.value = "queue";
    }
  },
  { immediate: true },
);

function handleSelect(taskId: string): void {
  selectTask(taskId);
  mobileScreen.value = "detail";
  void router.replace({ query: { ...route.query, task: taskId } });
}
</script>

<template>
  <WorkbenchLayout
    v-model:left-collapsed="leftCollapsed"
    v-model:right-collapsed="rightCollapsed"
    v-model:mobile-screen="mobileScreen"
    class="task-workbench page-frame"
    left-rail-label="任务队列"
    right-rail-label="任务上下文"
    :left-rail-summary="`${humanTaskCount} 项待处理`"
    :right-rail-summary="
      visibleTask
        ? `${contextModeLabels[contextMode]} · ${visibleTask.containerNumber}`
        : '未选择任务'
    "
    mobile-context-label="上下文"
  >
    <template #header>
      <PageHeader
        title="我的任务"
        :summary="scopedContainer ? '只看这一柜。' : undefined"
      >
        <template #actions>
          <p class="workload">
            <b class="num">{{ humanTaskCount }}</b> 待处理
            <span v-if="monitorCount"> · {{ monitorCount }} 自动监控</span>
          </p>
        </template>
      </PageHeader>
    </template>

    <template #responsibility>
      <WorkbenchResponsibilityBand
        region-label="责任上下文"
        :items="responsibilityItems"
      />
    </template>

    <template #decision>
      <WorkbenchDecisionStrip
        region-label="当前任务结论"
        :conclusion="decisionConclusion"
        :tone="visibleTask?.status === 'completed' ? 'ok' : 'info'"
        :disabled-reason="
          visibleTask?.status === 'completed'
            ? '完成态只读，不再提供任务执行动作。'
            : undefined
        "
      />
    </template>

    <template #mobileBreadcrumb>
      <p class="mobile-breadcrumb">
        {{ visibleTask?.containerNumber ?? "未选择对象" }}
        <span v-if="visibleTask">· {{ visibleTask.nodeName }}</span>
      </p>
    </template>

    <template #queue>
      <WorkbenchPane
        id="task-queue-pane"
        title="任务队列"
        region-label="任务队列"
        :count="tasks.length"
        :state="queueState"
        scroll="content"
      >
        <div class="queue-content">
          <TaskQueue
            :tasks="tasks"
            :active-task-id="activeTaskId"
            :selection-locked="isSubmitting"
            @select="handleSelect"
          />
          <p v-if="moreError" class="workspace-hint workspace-hint--error">
            {{ moreError }}
          </p>
          <button
            v-if="hasMore"
            type="button"
            class="load-more"
            :disabled="loadingMore"
            @click="loadMore"
          >
            {{ loadingMore ? "加载中…" : "再看后面" }}
          </button>
        </div>
      </WorkbenchPane>
    </template>

    <template #detail>
      <WorkbenchPane
        id="task-detail-pane"
        :title="visibleTask?.status === 'completed' ? '冻结结果' : '当前任务'"
        region-label="当前任务详情"
        :state="detailState"
        scroll="content"
      >
        <TaskFrozenResultPanel
          v-if="visibleTask?.status === 'completed' && visibleContainer"
          :task="visibleTask"
          :container="visibleContainer"
          :outcome="visibleOutcome"
        />
        <TaskExecutionPanel
          v-else-if="visibleTask && visibleContainer"
          :task="visibleTask"
          :container="visibleContainer"
          :submission="activeSubmission"
          :can-submit="canSubmit"
          :is-submitting="isSubmitting"
          @claim-task="claimTask"
          @acknowledge-input="acknowledgeInput"
          @verify-evidence="verifyEvidence"
          @execute-action="executeAction"
          @report-exception="reportException"
          @retry-submission="retrySubmission"
        />
      </WorkbenchPane>
    </template>

    <template #context>
      <WorkbenchPane
        id="task-context-pane"
        :title="contextTitle"
        region-label="任务上下文"
        :state="contextState"
      >
        <TaskContextPanel
          v-if="visibleTask && visibleContainer"
          v-model="contextMode"
          :context-key="taskContextKey"
          :modes="taskContextModes"
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
          <template #work>
            <section class="task-context-facts" aria-label="当前任务办理上下文">
              <dl>
                <div>
                  <dt>当前对象</dt>
                  <dd>{{ visibleTask.containerNumber }}</dd>
                </div>
                <div>
                  <dt>当前任务</dt>
                  <dd>{{ visibleTask.nodeName }}</dd>
                </div>
                <div>
                  <dt>当前责任</dt>
                  <dd>
                    {{
                      visibleTask.status === "completed"
                        ? "未知"
                        : visibleTask.assignment.label
                    }}
                  </dd>
                </div>
                <div>
                  <dt>期限</dt>
                  <dd>
                    {{
                      visibleTask.dueAt
                        ? formatDueAt(visibleTask.dueAt)
                        : "未设截止"
                    }}
                  </dd>
                </div>
              </dl>
            </section>
          </template>
          <template #archive>
            <TaskArchivePanel
              :container-id="visibleContainer.containerRecordId"
              :task-id="visibleTask.taskId"
              :outcome="visibleOutcome"
            />
          </template>
        </TaskContextPanel>
      </WorkbenchPane>
    </template>
  </WorkbenchLayout>
</template>

<style scoped>
.task-workbench {
  min-height: 100%;
}

.workload,
.mobile-breadcrumb,
.workspace-hint {
  margin: 0;
}

.workload,
.mobile-breadcrumb {
  color: var(--muted);
  font-size: var(--text-label);
}

.workload b {
  color: var(--ink);
  font-size: var(--text-title);
}

.mobile-breadcrumb {
  padding: 0 var(--space-1);
  overflow-wrap: anywhere;
}

.queue-content {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.task-context-facts {
  min-width: 0;
  padding: var(--space-3);
}

.task-context-facts dl {
  display: grid;
  gap: var(--space-2);
  margin: 0;
}

.task-context-facts dl > div {
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr);
  gap: var(--space-2);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--line);
}

.task-context-facts dt,
.task-context-facts dd {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: var(--text-label);
}

.task-context-facts dt {
  color: var(--muted);
}

.workspace-hint {
  padding: var(--space-2) var(--space-3);
  color: var(--muted);
  font-size: var(--text-meta);
}

.workspace-hint--error {
  color: var(--risk);
}

.load-more {
  min-height: var(--touch-target, 40px);
  width: 100%;
  border: 0;
  border-top: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
}

.load-more:disabled {
  color: var(--muted);
  cursor: wait;
}

@media (max-width: 680px) {
  .task-workbench {
    min-height: calc(100dvh - var(--topbar-height));
  }
}
</style>
