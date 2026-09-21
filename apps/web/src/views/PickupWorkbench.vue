<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import PickupActionPanel from "../components/pickup/PickupActionPanel.vue";
import PickupFactsPanel from "../components/pickup/PickupFactsPanel.vue";
import PickupWorkQueue from "../components/pickup/PickupWorkQueue.vue";
import RoleWorkbenchFrame from "../components/workbench/RoleWorkbenchFrame.vue";
import {
  usePickupCommands,
  type PickupFactDraft,
} from "../composables/usePickupCommands";
import { usePickupWorkbench } from "../composables/usePickupWorkbench";
import { useStuffingTaskOperation } from "../composables/useStuffingTaskOperation";
import type { PickupQueueItem } from "../data/pickupWorkbench";

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
  pickupNode,
  dates,
  arrivalFact,
  customsFact,
  availableFact,
  gateOutFact,
  loading,
  queueLoading,
  error,
  warnings,
  loadQueue,
  reload,
} = usePickupWorkbench(containerId, taskId);
const commands = usePickupCommands(reload);
const taskEvidence = computed(() => gateOutFact.value ?? availableFact.value);
const taskOperation = useStuffingTaskOperation(
  selectedTask,
  taskEvidence,
  reload,
);

onMounted(() => void loadQueue());

function selectContainer(value: string) {
  void router.replace({
    path: "/workspaces/pickup",
    query: value ? { containerId: value } : {},
  });
}

function selectTask(item: PickupQueueItem) {
  if (!item.task.containerId) return;
  void router.replace({
    path: "/workspaces/pickup",
    query: { containerId: item.task.containerId, taskId: item.task.id },
  });
}

function submit(draft: PickupFactDraft) {
  if (!containerId.value) return;
  void commands.submit(
    containerId.value,
    dates.value?.projectionVersion ?? 0,
    draft,
  );
}
</script>

<template>
  <RoleWorkbenchFrame
    title="提柜工作台"
    summary="核对到港、清关与码头可提，登记重柜实际出场，并处理提柜岗位工单。"
    workspace-label="内陆运输"
    node-scope-label="拖卡提柜"
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
      <PickupWorkQueue
        :items="queueItems"
        :selected-task-id="selectedTask?.id ?? taskId"
        :loading="queueLoading"
        @select="selectTask"
      />
    </template>
    <template #primary>
      <PickupFactsPanel
        :arrival-fact="arrivalFact"
        :customs-fact="customsFact"
        :available-fact="availableFact"
        :gate-out-fact="gateOutFact"
        :node="pickupNode"
      />
    </template>
    <template #secondary>
      <PickupActionPanel
        :available-fact="availableFact"
        :gate-out-fact="gateOutFact"
        :task="selectedTask"
        :submitting="commands.submitting.value"
        :error="commands.error.value"
        :results="commands.results.value"
        :task-submitting="taskOperation.submitting.value"
        @submit="submit"
        @execute-task="taskOperation.execute()"
      />
    </template>
  </RoleWorkbenchFrame>
</template>
