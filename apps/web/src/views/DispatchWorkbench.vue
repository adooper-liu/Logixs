<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import DispatchActionPanel from "../components/dispatch/DispatchActionPanel.vue";
import DispatchSnapshotPanel from "../components/dispatch/DispatchSnapshotPanel.vue";
import DispatchWorkQueue from "../components/dispatch/DispatchWorkQueue.vue";
import RoleWorkbenchFrame from "../components/workbench/RoleWorkbenchFrame.vue";
import {
  useDispatchCommands,
  type DispatchSnapshotDraft,
} from "../composables/useDispatchCommands";
import { useDispatchWorkbench } from "../composables/useDispatchWorkbench";
import { useStuffingTaskOperation } from "../composables/useStuffingTaskOperation";
import type { DispatchQueueItem } from "../data/dispatchWorkbench";

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
    query: value ? { containerId: value } : {},
  });
}

function selectTask(item: DispatchQueueItem) {
  if (!item.task.containerId) return;
  void router.replace({
    path: "/workspaces/dispatch",
    query: { containerId: item.task.containerId, taskId: item.task.id },
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
    title="出运工作台"
    summary="确认订舱与承运交接，登记重柜进港和实际装船，并清楚处理未过站的业务缺口。"
    workspace-label="船务出运"
    node-scope-label="出运"
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
