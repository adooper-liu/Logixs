<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import CargoReadySummary from "../components/cargo-ready/CargoReadySummary.vue";
import CargoReadyWorkQueue from "../components/cargo-ready/CargoReadyWorkQueue.vue";
import RoleWorkbenchFrame from "../components/workbench/RoleWorkbenchFrame.vue";
import { useCargoReadyWorkbench } from "../composables/useCargoReadyWorkbench";

const route = useRoute();
const router = useRouter();
const containerId = computed(() =>
  String(route.query.containerId ?? "").trim(),
);
const {
  containers,
  selectedContainer,
  cargo,
  nodes,
  cargoReadyNode,
  cargoReadyTasks,
  remediationItems,
  assessment,
  warnings,
  containerListLoading,
  selectionLoading,
  containerListError,
  selectionError,
  loadContainerList,
} = useCargoReadyWorkbench(containerId);

onMounted(() => {
  void loadContainerList();
});

function selectContainer(value: string): void {
  void router.replace({
    path: "/workspaces/cargo-ready",
    query: value ? { containerId: value } : {},
  });
}
</script>

<template>
  <RoleWorkbenchFrame
    title="备货工作台"
    summary="查看本柜装载、备货节点、岗位任务与合规整改。"
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
    <template #primary>
      <CargoReadySummary
        v-if="selectedContainer"
        :container-id="selectedContainer.id"
        :cargo="cargo"
        :node="cargoReadyNode"
        :assessment="assessment"
      />
    </template>
    <template #secondary>
      <CargoReadyWorkQueue
        v-if="selectedContainer"
        :container-id="selectedContainer.id"
        :node-tasks="cargoReadyTasks"
        :remediation-items="remediationItems"
      />
    </template>
  </RoleWorkbenchFrame>
</template>
