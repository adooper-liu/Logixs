<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import CustomsActionPanel from "../components/customs/CustomsActionPanel.vue";
import CustomsCasePanel from "../components/customs/CustomsCasePanel.vue";
import CustomsWorkQueue from "../components/customs/CustomsWorkQueue.vue";
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
  containers,
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

onMounted(() => void loadQueue());

function selectContainer(value: string) {
  void router.replace({
    path: "/workspaces/customs",
    query: value ? { containerId: value } : {},
  });
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
    title="清关工作台"
    summary="处理申报、海关扣留与放行，提交实际清关时间，并清楚区分岗位完工和流程过站。"
    workspace-label="清关"
    node-scope-label="清关"
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
  </RoleWorkbenchFrame>
</template>
