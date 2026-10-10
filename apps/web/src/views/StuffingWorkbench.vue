<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import StuffingActionPanel from "../components/stuffing/StuffingActionPanel.vue";
import StuffingSnapshotPanel from "../components/stuffing/StuffingSnapshotPanel.vue";
import StuffingWorkQueue from "../components/stuffing/StuffingWorkQueue.vue";
import RoleWorkbenchFrame from "../components/workbench/RoleWorkbenchFrame.vue";
import {
  useStuffingCommands,
  type StuffingSnapshotDraft,
} from "../composables/useStuffingCommands";
import { useStuffingTaskOperation } from "../composables/useStuffingTaskOperation";
import { useStuffingWorkbench } from "../composables/useStuffingWorkbench";
import type {
  StuffingQueueFilter,
  StuffingQueueItem,
} from "../data/stuffingWorkbench";

const route = useRoute();
const router = useRouter();
const containerId = computed(() =>
  String(route.query.containerId ?? "").trim(),
);
const taskId = computed(() => String(route.query.taskId ?? "").trim());
const queueFilter = ref<StuffingQueueFilter>("executable");
const {
  selectedContainer,
  cargo,
  nodes,
  stuffingNode,
  queueItems,
  selectedTask,
  snapshot,
  dateFacts,
  stuffingActualFact,
  warnings,
  queueLoading,
  selectionLoading,
  containerListError,
  queueError,
  selectionError,
  loadContainerList,
  reloadSelection,
} = useStuffingWorkbench(containerId, taskId);
const commands = useStuffingCommands(reloadWorkbench);
const taskOperation = useStuffingTaskOperation(
  selectedTask,
  snapshot,
  reloadWorkbench,
);

onMounted(() => {
  void loadContainerList();
});

function selectTask(item: StuffingQueueItem): void {
  if (!item.task.containerId) return;
  void router.replace({
    path: "/workspaces/stuffing",
    query: { containerId: item.task.containerId, taskId: item.task.id },
  });
}

function saveSnapshot(draft: StuffingSnapshotDraft): void {
  if (!containerId.value) return;
  void commands.saveSnapshot(containerId.value, draft);
}

function submitActual(localDateTime: string): void {
  if (!containerId.value || !snapshot.value) return;
  void commands.submitActualTime({
    containerId: containerId.value,
    localDateTime,
    expectedVersion: dateFacts.value?.projectionVersion ?? 0,
    snapshot: snapshot.value,
  });
}

async function reloadWorkbench(): Promise<void> {
  await Promise.all([reloadSelection(), loadContainerList()]);
}
</script>

<template>
  <RoleWorkbenchFrame
    stage-code="stuffing"
    workspace-label="出运装箱"
    node-scope-label="装箱"
    :selected-container="selectedContainer"
    :nodes="nodes"
    :selection-loading="selectionLoading"
    :container-list-error="containerListError"
    :selection-error="selectionError"
    :warnings="warnings"
  >
    <template #queue>
      <StuffingWorkQueue
        :items="queueItems"
        :selected-task-id="selectedTask?.id ?? taskId"
        :filter="queueFilter"
        :loading="queueLoading"
        :error="queueError"
        @select="selectTask"
        @change-filter="queueFilter = $event"
      />
    </template>
    <template #primary>
      <StuffingSnapshotPanel
        v-if="selectedContainer"
        :cargo="cargo"
        :snapshot="snapshot"
        :node="stuffingNode"
      />
    </template>
    <template #secondary>
      <StuffingActionPanel
        v-if="selectedContainer"
        :container-number="selectedContainer.containerNumber"
        :cargo="cargo"
        :snapshot="snapshot"
        :actual-fact="stuffingActualFact"
        :task="selectedTask"
        :submission="taskOperation.submission.value"
        :task-submitting="taskOperation.submitting.value"
        :snapshot-saving="commands.snapshotSaving.value"
        :snapshot-error="commands.snapshotError.value"
        :snapshot-message="commands.snapshotMessage.value"
        :date-submitting="commands.dateSubmitting.value"
        :date-error="commands.dateError.value"
        :date-result="commands.dateResult.value"
        @save-snapshot="saveSnapshot"
        @submit-actual="submitActual"
        @execute-task="taskOperation.execute()"
        @retry-task="taskOperation.retry()"
      />
    </template>
  </RoleWorkbenchFrame>
</template>
