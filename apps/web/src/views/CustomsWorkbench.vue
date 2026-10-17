<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import CustomsActionPanel from "../components/customs/CustomsActionPanel.vue";
import CustomsCasePanel from "../components/customs/CustomsCasePanel.vue";
import CustomsWorkQueue from "../components/customs/CustomsWorkQueue.vue";
import TaskArchivePanel from "../components/task/TaskArchivePanel.vue";
import RoleWorkbenchFrame from "../components/workbench/RoleWorkbenchFrame.vue";
import {
  useCustomsCommands,
  type CustomsCaseDraft,
} from "../composables/useCustomsCommands";
import { useCustomsWorkbench } from "../composables/useCustomsWorkbench";
import { useStuffingTaskOperation } from "../composables/useStuffingTaskOperation";
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
type CustomsContextMode = "action" | "archive";

const contextMode = ref<CustomsContextMode>("action");
const actionPanel = useTemplateRef<HTMLElement>("actionPanel");
const hasArchiveContext = computed(() =>
  Boolean(selectedContainer.value && selectedTask.value),
);
const contextLabel = computed(() =>
  contextMode.value === "archive" ? "当前可见任务档案" : "清关办理",
);
const contextSummary = computed(() =>
  contextMode.value === "archive"
    ? "核对记录"
    : hasArchiveContext.value
      ? "继续办理"
      : "待选择",
);
const mobileContextLabel = computed(() =>
  contextMode.value === "archive" ? "档案" : "办理",
);
let actionScrollTop = 0;
let lastActionFocus: HTMLElement | null = null;

onMounted(() => void loadQueue());

watch(
  hasArchiveContext,
  (ready) => {
    if (!ready) contextMode.value = "action";
  },
  { flush: "sync" },
);

function contextScrollOwner(): HTMLElement | null {
  return (
    actionPanel.value
      ?.closest<HTMLElement>('[data-workbench-pane="context"]')
      ?.querySelector<HTMLElement>(".workbench-pane__scroll--independent") ??
    null
  );
}

function rememberActionFocus(event: FocusEvent): void {
  if (event.target instanceof HTMLElement) lastActionFocus = event.target;
}

function selectContextMode(mode: CustomsContextMode): void {
  if (mode === contextMode.value) return;
  if (mode === "archive") {
    if (!hasArchiveContext.value) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && actionPanel.value?.contains(active)) {
      lastActionFocus = active;
    }
    actionScrollTop = contextScrollOwner()?.scrollTop ?? 0;
    contextMode.value = "archive";
    return;
  }
  contextMode.value = "action";
  void restoreActionContext();
}

async function restoreActionContext(): Promise<void> {
  await nextTick();
  const scrollOwner = contextScrollOwner();
  if (scrollOwner) scrollOwner.scrollTop = actionScrollTop;
  if (
    lastActionFocus?.isConnected &&
    actionPanel.value?.contains(lastActionFocus)
  ) {
    lastActionFocus.focus({ preventScroll: true });
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
        <nav
          v-if="hasArchiveContext"
          class="customs-context__modes"
          aria-label="右栏模式"
        >
          <button
            type="button"
            data-testid="context-mode-action"
            :aria-pressed="contextMode === 'action'"
            @click="selectContextMode('action')"
          >
            办理
          </button>
          <button
            type="button"
            data-testid="context-mode-archive"
            :aria-pressed="contextMode === 'archive'"
            @click="selectContextMode('archive')"
          >
            档案
          </button>
        </nav>
        <div
          ref="actionPanel"
          data-testid="customs-action-mode"
          :hidden="contextMode !== 'action'"
          :inert="contextMode !== 'action' || undefined"
          :aria-hidden="contextMode !== 'action' ? 'true' : undefined"
          @focusin="rememberActionFocus"
        >
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
        </div>
        <TaskArchivePanel
          v-if="contextMode === 'archive' && selectedContainer && selectedTask"
          :container-id="selectedContainer.id"
          :task-id="selectedTask.id"
          :outcome="selectedTask.outcome"
        />
      </div>
    </template>
  </RoleWorkbenchFrame>
</template>

<style scoped>
.customs-context {
  min-width: 0;
}

.customs-context__modes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--line-strong);
  background: var(--surface-2);
}

.customs-context__modes button {
  min-width: 0;
  min-height: 36px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink-soft);
  cursor: pointer;
  font: inherit;
  font-weight: 600;
}

.customs-context__modes button[aria-pressed="true"] {
  border-color: var(--brand);
  background: var(--brand-soft);
  color: var(--brand-strong);
}
</style>
