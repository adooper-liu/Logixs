<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import PreDepartureDispatchWorkbench from "../components/dispatch/PreDepartureDispatchWorkbench.vue";
import PostDepartureHandoffWorkbench from "../components/shipment-handoff/PostDepartureHandoffWorkbench.vue";
import WorkbenchFlowContext from "../components/workbench/WorkbenchFlowContext.vue";
import WorkbenchPageHeader from "../components/workbench/WorkbenchPageHeader.vue";
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
  <main class="dispatch-workbench page-frame">
    <WorkbenchPageHeader stage-code="dispatch" eyebrow="出运运营岗位工作台" />
    <nav class="dispatch-view-switch" aria-label="出运工作台内部视图">
      <button
        type="button"
        :aria-current="!showLoadingHistory && !showRisk ? 'page' : undefined"
        @click="openHandoffIntake"
      >
        接管已出运数据
      </button>
      <button
        type="button"
        :aria-current="showLoadingHistory ? 'page' : undefined"
        @click="openLoadingHistory"
      >
        装船交接历史
      </button>
      <button
        type="button"
        :aria-current="showRisk ? 'page' : undefined"
        @click="
          router.replace({
            path: '/workspaces/dispatch',
            query: { view: 'risk' },
          })
        "
      >
        在途风险
      </button>
    </nav>
    <WorkbenchFlowContext
      v-if="stage"
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

.dispatch-view-switch {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  width: fit-content;
  max-width: 100%;
  padding: var(--space-1);
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface-2);
}

.dispatch-view-switch button {
  min-height: 44px;
  max-width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--ink-soft);
  font: inherit;
  font-size: var(--text-label);
  line-height: var(--leading-body);
  white-space: normal;
  cursor: pointer;
}

.dispatch-view-switch button:hover {
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.dispatch-view-switch button:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}

.dispatch-view-switch button[aria-current="page"] {
  border-color: var(--line-strong);
  background: var(--surface);
  color: var(--brand-strong);
  font-weight: 600;
}

@media (max-width: 680px) {
  .dispatch-view-switch {
    width: 100%;
  }

  .dispatch-view-switch button {
    flex: 1 1 9rem;
  }
}
</style>
