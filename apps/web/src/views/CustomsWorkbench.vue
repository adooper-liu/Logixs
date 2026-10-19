<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import CustomsActionPanel from "../components/customs/CustomsActionPanel.vue";
import CustomsCasePanel from "../components/customs/CustomsCasePanel.vue";
import CustomsWorkQueue from "../components/customs/CustomsWorkQueue.vue";
import TaskArchivePanel from "../components/task/TaskArchivePanel.vue";
import TaskContextPanel from "../components/task/TaskContextPanel.vue";
import type { TaskContextMode } from "../components/task/TaskContextPanel.vue";
import RoleWorkbenchFrame from "../components/workbench/RoleWorkbenchFrame.vue";
import {
  useCustomsCommands,
  type CustomsCaseDraft,
} from "../composables/useCustomsCommands";
import { useCustomsWorkbench } from "../composables/useCustomsWorkbench";
import { useStuffingTaskOperation } from "../composables/useStuffingTaskOperation";
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
const contextMode = ref<TaskContextMode>("work");
const contextModeLabels: Record<TaskContextMode, string> = {
  work: "办理",
  archive: "档案",
  collaboration: "协作",
};
const collaborationContextKey = computed(() =>
  selectedContainer.value && selectedTask.value
    ? `container:${selectedContainer.value.id}|node_task:${selectedTask.value.id}`
    : null,
);
const collaborationContext = computed<TaskCollaborationContext | null>(() =>
  collaborationContextKey.value && selectedContainer.value && selectedTask.value
    ? {
        contextKey: collaborationContextKey.value,
        taskId: selectedTask.value.id,
        subjectRef: { kind: "container", id: selectedContainer.value.id },
        workRef: { kind: "node_task", id: selectedTask.value.id },
      }
    : null,
);
const collaboration = useTaskCollaboration(collaborationContext);
const contextModes = computed<readonly TaskContextMode[]>(() =>
  collaborationContext.value ? ["work", "archive", "collaboration"] : ["work"],
);
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
  collaborationContextKey,
  () => {
    contextMode.value = "work";
  },
  { flush: "sync" },
);

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
</script>

<template>
  <RoleWorkbenchFrame
    stage-code="customs"
    workspace-label="进口清关"
    node-scope-label="进口清关"
    :selected-container="selectedContainer"
    :nodes="nodes"
    :selection-loading="loading"
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
          v-if="selectedContainer"
          v-model="contextMode"
          :context-key="collaborationContextKey"
          :modes="contextModes"
          :collaboration="collaboration"
          @submit="submitCollaboration"
          @retry="retryCollaboration"
          @load-more="loadMoreCollaboration"
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
              :clearance-case="clearanceCase"
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
              :container-id="selectedContainer.id"
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
