<script setup lang="ts">
import { History, Import } from "@lucide/vue";
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  useDispatchCommands,
  type DispatchSnapshotDraft,
} from "../../composables/useDispatchCommands";
import { useDispatchWorkbench } from "../../composables/useDispatchWorkbench";
import { useStuffingTaskOperation } from "../../composables/useStuffingTaskOperation";
import type { DispatchQueueItem } from "../../data/dispatchWorkbench";
import RoleWorkbenchFrame from "../workbench/RoleWorkbenchFrame.vue";
import DispatchActionPanel from "./DispatchActionPanel.vue";
import DispatchSnapshotPanel from "./DispatchSnapshotPanel.vue";
import DispatchWorkQueue from "./DispatchWorkQueue.vue";

const emit = defineEmits<{ showHandoffIntake: [] }>();
const route = useRoute();
const router = useRouter();
const containerId = computed(() =>
  String(route.query.containerId ?? "").trim(),
);
const taskId = computed(() => String(route.query.taskId ?? "").trim());
const {
  containers,
  selectedContainer,
  nodes,
  queueItems,
  selectedTask,
  dispatchNode,
  stuffing,
  dispatch,
  dates,
  gateInFact,
  loadedFact,
  loading,
  queueLoading,
  error,
  warnings,
  loadQueue,
  reload,
} = useDispatchWorkbench(containerId, taskId);
const commands = useDispatchCommands(reload);
const taskOperation = useStuffingTaskOperation(selectedTask, dispatch, reload);

onMounted(() => void loadQueue());

function selectContainer(value: string) {
  void router.replace({
    path: "/workspaces/dispatch",
    query: value
      ? { view: "loading", containerId: value }
      : { view: "loading" },
  });
}

function selectTask(item: DispatchQueueItem) {
  if (!item.task.containerId) return;
  void router.replace({
    path: "/workspaces/dispatch",
    query: {
      view: "loading",
      containerId: item.task.containerId,
      taskId: item.task.id,
    },
  });
}

function saveSnapshot(draft: DispatchSnapshotDraft) {
  if (containerId.value) void commands.saveSnapshot(containerId.value, draft);
}

function submitActual(eventCode: "gate_in" | "loaded", localDateTime: string) {
  if (!containerId.value || !dispatch.value) return;
  void commands.submitActual({
    containerId: containerId.value,
    eventCode,
    localDateTime,
    expectedVersion: dates.value?.projectionVersion ?? 0,
    snapshot: dispatch.value,
  });
}
</script>

<template>
  <RoleWorkbenchFrame
    title="装船交接历史"
    summary="查看已有订舱、进港与装船事实；新的已出运数据从接管视图进入。"
    workspace-label="船务出运"
    node-scope-label="出运前交接"
    :containers="containers"
    :selected-container-id="containerId"
    :selected-container="selectedContainer"
    :nodes="nodes"
    :container-list-loading="queueLoading"
    :selection-loading="loading"
    :container-list-error="error"
    :selection-error="error"
    :warnings="warnings"
    @select-container="selectContainer"
  >
    <template #actions>
      <div class="view-switch" aria-label="出运工作台视图">
        <button type="button" @click="emit('showHandoffIntake')">
          <Import :size="16" aria-hidden="true" />
          接管已出运数据
        </button>
        <button type="button" class="view-switch__active" aria-current="page">
          <History :size="16" aria-hidden="true" />
          装船交接历史
        </button>
      </div>
    </template>
    <template #queue>
      <DispatchWorkQueue
        :items="queueItems"
        :selected-task-id="selectedTask?.id ?? taskId"
        :loading="queueLoading"
        @select="selectTask"
      />
    </template>
    <template #primary>
      <DispatchSnapshotPanel
        :stuffing="stuffing"
        :dispatch="dispatch"
        :gate-in-fact="gateInFact"
        :loaded-fact="loadedFact"
        :node="dispatchNode"
      />
    </template>
    <template #secondary>
      <DispatchActionPanel
        :stuffing="stuffing"
        :dispatch="dispatch"
        :gate-in-fact="gateInFact"
        :loaded-fact="loadedFact"
        :task="selectedTask"
        :saving="commands.saving.value"
        :save-error="commands.saveError.value"
        :save-message="commands.saveMessage.value"
        :date-submitting="commands.dateSubmitting.value"
        :date-error="commands.dateError.value"
        :date-result="commands.dateResult.value"
        :task-submitting="taskOperation.submitting.value"
        @save="saveSnapshot"
        @submit-actual="submitActual"
        @execute-task="taskOperation.execute()"
      />
    </template>
  </RoleWorkbenchFrame>
</template>

<style scoped>
.view-switch {
  display: inline-flex;
  padding: var(--space-1);
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface-2);
}

.view-switch button {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 0;
  border-radius: calc(var(--radius-control) - 2px);
  background: transparent;
  color: var(--ink-soft);
  font-size: var(--text-meta);
  cursor: pointer;
}

.view-switch__active {
  background: var(--surface) !important;
  color: var(--brand-strong) !important;
  box-shadow: var(--shadow-card);
  font-weight: 600;
}

@media (max-width: 680px) {
  .view-switch,
  .view-switch button {
    width: 100%;
  }

  .view-switch {
    flex-direction: column;
  }
}
</style>
