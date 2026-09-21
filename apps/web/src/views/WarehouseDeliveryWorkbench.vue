<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import DeliveryActionPanel from "../components/delivery/DeliveryActionPanel.vue";
import DeliveryFactsPanel from "../components/delivery/DeliveryFactsPanel.vue";
import DeliveryInstructionPanel from "../components/delivery/DeliveryInstructionPanel.vue";
import DeliveryWorkQueue from "../components/delivery/DeliveryWorkQueue.vue";
import RoleWorkbenchFrame from "../components/workbench/RoleWorkbenchFrame.vue";
import { useStuffingTaskOperation } from "../composables/useStuffingTaskOperation";
import {
  useWarehouseDeliveryCommands,
  type DeliveryFactDraft,
  type DeliveryInstructionDraft,
} from "../composables/useWarehouseDeliveryCommands";
import { useWarehouseDeliveryWorkbench } from "../composables/useWarehouseDeliveryWorkbench";
import type { DeliveryQueueItem } from "../data/deliveryWorkbench";

const route = useRoute();
const router = useRouter();
const containerId = computed(() =>
  String(route.query.containerId ?? "").trim(),
);
const taskId = computed(() => String(route.query.taskId ?? "").trim());
const workbench = useWarehouseDeliveryWorkbench(containerId, taskId);
const commands = useWarehouseDeliveryCommands(workbench.reload);
const taskEvidence = computed(
  () => workbench.warehouseArrivalFact.value ?? workbench.deliveredFact.value,
);
const taskOperation = useStuffingTaskOperation(
  workbench.selectedTask,
  taskEvidence,
  workbench.reload,
);

onMounted(() => void workbench.loadQueue());
function selectContainer(value: string) {
  void router.replace({
    path: "/workspaces/delivery",
    query: value ? { containerId: value } : {},
  });
}
function selectTask(item: DeliveryQueueItem) {
  if (!item.task.containerId) return;
  void router.replace({
    path: "/workspaces/delivery",
    query: { containerId: item.task.containerId, taskId: item.task.id },
  });
}
function saveInstruction(draft: DeliveryInstructionDraft) {
  if (!containerId.value) return;
  void commands.saveInstruction(
    containerId.value,
    workbench.instruction.value?.version ?? 0,
    draft,
  );
}
function submitFact(draft: DeliveryFactDraft) {
  if (!containerId.value || !workbench.instruction.value) return;
  void commands.submitFact(
    containerId.value,
    workbench.dates.value?.projectionVersion ?? 0,
    workbench.instruction.value,
    draft,
  );
}
</script>

<template>
  <RoleWorkbenchFrame
    title="送仓工作台"
    summary="锁定目的仓与预约，登记 POD 或仓库权威到场，并跟进复核与送仓岗位工单。"
    workspace-label="内陆运输"
    node-scope-label="送仓"
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
      ><DeliveryWorkQueue
        :items="workbench.queueItems.value"
        :selected-task-id="workbench.selectedTask.value?.id ?? taskId"
        :loading="workbench.queueLoading.value"
        @select="selectTask"
    /></template>
    <template #primary
      ><DeliveryFactsPanel
        :instruction="workbench.instruction.value"
        :gate-out-fact="workbench.gateOutFact.value"
        :planned-fact="workbench.deliveryPlannedFact.value"
        :estimated-fact="workbench.deliveryEstimatedFact.value"
        :delivered-fact="workbench.deliveredFact.value"
        :warehouse-arrival-fact="workbench.warehouseArrivalFact.value"
        :node="workbench.deliveryNode.value"
    /></template>
    <template #secondary>
      <div class="delivery-actions">
        <DeliveryInstructionPanel
          :instruction="workbench.instruction.value"
          :saving="commands.instructionSubmitting.value"
          @save="saveInstruction"
        />
        <DeliveryActionPanel
          :instruction="workbench.instruction.value"
          :delivered-fact="workbench.deliveredFact.value"
          :warehouse-arrival-fact="workbench.warehouseArrivalFact.value"
          :task="workbench.selectedTask.value"
          :submitting="commands.factSubmitting.value"
          :results="commands.factResults.value"
          :task-submitting="taskOperation.submitting.value"
          :error="commands.error.value"
          @submit="submitFact"
          @execute-task="taskOperation.execute()"
        />
      </div>
    </template>
  </RoleWorkbenchFrame>
</template>

<style scoped>
.delivery-actions {
  display: grid;
  gap: 12px;
}
</style>
