<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import PreDepartureDispatchWorkbench from "../components/dispatch/PreDepartureDispatchWorkbench.vue";
import PostDepartureHandoffWorkbench from "../components/shipment-handoff/PostDepartureHandoffWorkbench.vue";
import WorkbenchFlowContext from "../components/workbench/WorkbenchFlowContext.vue";
import {
  getInboundWorkbenchRelations,
  getOutboundWorkbenchRelations,
  workbenchStage,
} from "../data/workbenchNetwork";
import ShipmentRiskWorkbench from "./ShipmentRiskWorkbench.vue";

/**
 * 出运工作台的两个视图（基线 §6：同一工作台内的「Shipment 接管」与「在途」）。
 *
 * 默认是接管；`?view=risk` 是在途 Shipment 风险队列。用 query 区分而不是两个入口，
 * 是因为运营在这里做的是同一件事的两段：先把票接进来，再盯着它在途走完。
 */
const route = useRoute();
const router = useRouter();
const mode = computed(() => route.query.view);
const showLoadingHistory = computed(() => mode.value === "loading");
const showRisk = computed(() => mode.value === "risk");
const stage = workbenchStage("dispatch");
const inbound = stage ? getInboundWorkbenchRelations(stage.code) : [];
const outbound = stage ? getOutboundWorkbenchRelations(stage.code) : [];

function openHandoffIntake(): void {
  void router.replace({ path: "/workspaces/dispatch" });
}

function openLoadingHistory(): void {
  void router.replace({
    path: "/workspaces/dispatch",
    query: { view: "loading" },
  });
}
</script>

<template>
  <main v-if="stage" class="dispatch-workbench">
    <WorkbenchFlowContext
      :stage="stage"
      :inbound="inbound"
      :outbound="outbound"
    />
    <ShipmentRiskWorkbench v-if="showRisk" />
    <PreDepartureDispatchWorkbench
      v-else-if="showLoadingHistory"
      @show-handoff-intake="openHandoffIntake"
    />
    <PostDepartureHandoffWorkbench
      v-else
      @show-loading-history="openLoadingHistory"
    />
  </main>
</template>

<style scoped>
.dispatch-workbench {
  min-width: 0;
  display: grid;
  gap: var(--space-4);
}
</style>
