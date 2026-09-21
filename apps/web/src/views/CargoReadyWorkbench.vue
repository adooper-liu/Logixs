<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import CargoReadyActionPanel from "../components/cargo-ready/CargoReadyActionPanel.vue";
import CargoReadySummary from "../components/cargo-ready/CargoReadySummary.vue";
import CargoReadyWorkQueue from "../components/cargo-ready/CargoReadyWorkQueue.vue";
import RoleWorkbenchFrame from "../components/workbench/RoleWorkbenchFrame.vue";
import { useCargoReadyWorkbench } from "../composables/useCargoReadyWorkbench";
import { useCargoReadyTaskOperation } from "../composables/useCargoReadyTaskOperation";
import type { ExternalWorkItem } from "../api/workItems";
import type {
  CargoReadyQueueFilter,
  CargoReadyQueueItem,
} from "../data/cargoReadyWorkbench";

const route = useRoute();
const router = useRouter();
const containerId = computed(() =>
  String(route.query.containerId ?? "").trim(),
);
const taskId = computed(() => String(route.query.taskId ?? "").trim());
const queueFilter = ref<CargoReadyQueueFilter>("executable");
const {
  containers,
  selectedContainer,
  cargo,
  nodes,
  cargoReadyNode,
  queueItems,
  selectedTask,
  skuReadiness,
  remediationItems,
  remediationPool,
  assessment,
  warnings,
  containerListLoading,
  queueLoading,
  selectionLoading,
  containerListError,
  queueError,
  selectionError,
  loadContainerList,
  reloadSelection,
} = useCargoReadyWorkbench(containerId, taskId);

const { submission, submitting, execute, retry } = useCargoReadyTaskOperation(
  selectedTask,
  reloadWorkbench,
);

onMounted(() => {
  void loadContainerList();
});

function selectContainer(value: string): void {
  void router.replace({
    path: "/workspaces/cargo-ready",
    query: value ? { containerId: value } : {},
  });
}

function selectTask(item: CargoReadyQueueItem): void {
  if (!item.task.containerId) return;
  void router.replace({
    path: "/workspaces/cargo-ready",
    query: { containerId: item.task.containerId, taskId: item.task.id },
  });
}

function selectRemediation(item: ExternalWorkItem): void {
  void router.replace({
    path: "/workspaces/cargo-ready",
    query: { containerId: item.containerId },
  });
}

async function reloadWorkbench(): Promise<void> {
  await Promise.all([reloadSelection(), loadContainerList()]);
}
</script>

<template>
  <RoleWorkbenchFrame
    title="备货工作台"
    summary="从岗位任务池定位工作，核对每个 SKU 的齐备情况，并完成当前允许的备货动作。"
    workspace-label="备货"
    node-scope-label="备货"
    :containers="containers"
    :selected-container-id="containerId"
    :selected-container="selectedContainer"
    :nodes="nodes"
    :container-list-loading="containerListLoading"
    :selection-loading="selectionLoading"
    :container-list-error="containerListError"
    :selection-error="selectionError"
    :warnings="warnings"
    @select-container="selectContainer"
  >
    <template #queue>
      <CargoReadyWorkQueue
        :items="queueItems"
        :selected-task-id="selectedTask?.id ?? taskId"
        :filter="queueFilter"
        :loading="queueLoading"
        :error="queueError"
        :remediation-items="remediationPool"
        :containers="containers"
        @select="selectTask"
        @select-remediation="selectRemediation"
        @change-filter="queueFilter = $event"
      />
    </template>
    <template #primary>
      <CargoReadySummary
        v-if="selectedContainer"
        :container-id="selectedContainer.id"
        :cargo="cargo"
        :node="cargoReadyNode"
        :assessment="assessment"
        :readiness="skuReadiness"
      />
    </template>
    <template #secondary>
      <CargoReadyActionPanel
        v-if="selectedContainer"
        :container-id="selectedContainer.id"
        :task="selectedTask"
        :remediation-items="remediationItems"
        :submission="submission"
        :submitting="submitting"
        @execute="execute()"
        @retry="retry()"
      />
    </template>
  </RoleWorkbenchFrame>
</template>
