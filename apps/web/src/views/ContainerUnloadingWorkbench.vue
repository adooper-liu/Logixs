<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import UnloadingActionPanel from "../components/unloading/UnloadingActionPanel.vue";
import UnloadingFactsPanel from "../components/unloading/UnloadingFactsPanel.vue";
import UnloadingProgressPanel from "../components/unloading/UnloadingProgressPanel.vue";
import UnloadingWorkQueue from "../components/unloading/UnloadingWorkQueue.vue";
import RoleWorkbenchFrame from "../components/workbench/RoleWorkbenchFrame.vue";
import {
  useContainerUnloadingCommands,
  type UnloadingReportDraft,
} from "../composables/useContainerUnloadingCommands";
import { useContainerUnloadingWorkbench } from "../composables/useContainerUnloadingWorkbench";
import { useStuffingTaskOperation } from "../composables/useStuffingTaskOperation";
import type { UnloadingQueueItem } from "../data/unloadingWorkbench";

const route = useRoute();
const router = useRouter();
const containerId = computed(() =>
  String(route.query.containerId ?? "").trim(),
);
const taskId = computed(() => String(route.query.taskId ?? "").trim());
const workbench = useContainerUnloadingWorkbench(containerId, taskId);
const commands = useContainerUnloadingCommands(workbench.reload);
const taskOperation = useStuffingTaskOperation(
  workbench.selectedTask,
  workbench.actualFact,
  workbench.reload,
);

onMounted(() => void workbench.loadQueue());
function selectContainer(value: string) {
  void router.replace({
    path: "/workspaces/unloading",
    query: value ? { containerId: value } : {},
  });
}
function selectTask(item: UnloadingQueueItem) {
  if (!item.task.containerId) return;
  void router.replace({
    path: "/workspaces/unloading",
    query: { containerId: item.task.containerId, taskId: item.task.id },
  });
}
function submit(draft: UnloadingReportDraft) {
  if (!containerId.value || !workbench.instruction.value) return;
  void commands.submitReport(
    containerId.value,
    workbench.report.value?.version ?? 0,
    workbench.dates.value?.projectionVersion ?? 0,
    workbench.instruction.value,
    draft,
  );
}
</script>

<template>
  <RoleWorkbenchFrame
    title="卸柜工作台"
    summary="按柜记录开始、部分卸货和实际卸完，核对实收差异并提交仓方完成事实复核。"
    workspace-label="仓库收货"
    node-scope-label="卸柜"
    :containers="workbench.containers.value"
    :selected-container-id="containerId"
    :selected-container="workbench.selectedContainer.value"
    :nodes="workbench.nodes.value"
    :container-list-loading="workbench.queueLoading.value"
    :selection-loading="workbench.loading.value"
    :container-list-error="workbench.error.value"
    :selection-error="workbench.error.value"
    :warnings="workbench.warnings.value"
    @select-container="selectContainer"
  >
    <template #queue
      ><UnloadingWorkQueue
        :items="workbench.queueItems.value"
        :selected-task-id="workbench.selectedTask.value?.id ?? taskId"
        :loading="workbench.queueLoading.value"
        @select="selectTask"
    /></template>
    <template #primary>
      <div class="unloading-primary">
        <UnloadingFactsPanel
          :instruction="workbench.instruction.value"
          :report="workbench.report.value"
          :delivery-fact="workbench.deliveryFact.value"
          :planned-fact="workbench.plannedFact.value"
          :estimated-fact="workbench.estimatedFact.value"
          :actual-fact="workbench.actualFact.value"
          :node="workbench.unloadingNode.value"
        />
        <UnloadingProgressPanel :report="workbench.report.value" />
      </div>
    </template>
    <template #secondary
      ><UnloadingActionPanel
        :instruction="workbench.instruction.value"
        :report="workbench.report.value"
        :task="workbench.selectedTask.value"
        :submitting="commands.submitting.value"
        :task-submitting="taskOperation.submitting.value"
        :fact-result="commands.factResult.value"
        :error="commands.error.value"
        @submit="submit"
        @execute-task="taskOperation.execute()"
    /></template>
  </RoleWorkbenchFrame>
</template>

<style scoped>
.unloading-primary {
  display: grid;
  gap: var(--space-3);
}
.unloading-primary > * {
  border-bottom: 1px solid var(--line);
}
.unloading-primary > *:last-child {
  border-bottom: 0;
}
</style>
