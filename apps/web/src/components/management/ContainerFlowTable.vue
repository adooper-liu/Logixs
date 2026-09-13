<script setup lang="ts">
import LiveMiniRail from "../container/LiveMiniRail.vue";
import StatusTriplet from "../container/StatusTriplet.vue";
import type { ContainerProjection } from "../../data/sample";

defineProps<{ rows: ContainerProjection[] }>();
</script>

<template>
  <section class="flow-panel" aria-label="看档">
    <div class="flow-list">
      <article
        v-for="row in rows"
        :key="row.containerRecordId"
        class="flow-row"
      >
        <div class="identity">
          <router-link
            :to="`/container/${row.containerRecordId}`"
            class="mono"
            >{{ row.containerNumber }}</router-link
          >
          <span v-if="row.orderNumber" class="mono">{{ row.orderNumber }}</span>
          <span v-if="row.currentNode">{{ row.currentNode }}</span>
          <LiveMiniRail :nodes="row.rail" />
        </div>
        <StatusTriplet
          class="row-status"
          :container-status="row.currentStatus"
          :task-status="row.taskStatus"
          :sync-status="row.syncStatus"
          compact
          :show-idle-sync="false"
          :show-idle-task="false"
        />
        <div v-if="row.risk" class="risk-cell">
          <span>风险</span><b :class="row.tone">{{ row.risk }}</b>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.flow-panel {
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--surface);
  overflow: hidden;
}
.flow-row {
  display: grid;
  grid-template-columns: minmax(210px, 0.7fr) minmax(0, 1.5fr);
  gap: 8px;
  align-items: center;
  padding: 7px 12px;
  border-bottom: 1px solid var(--line);
}
.flow-row:last-child {
  border-bottom: 0;
}
.identity,
.risk-cell {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.identity a {
  color: var(--ink);
  font-weight: 700;
  text-decoration: none;
}
.identity a:hover {
  color: var(--brand);
}
.identity span,
.risk-cell span {
  color: var(--muted);
  font-size: 10px;
  overflow-wrap: anywhere;
}
.identity b {
  color: var(--brand);
  font-size: 11px;
}
.risk-cell b {
  font-size: 12px;
  overflow-wrap: anywhere;
}
.row-status {
  border: 0;
  border-radius: 0;
}
.row-status :deep(.status-cell) {
  padding-block: 4px;
}
.risk-cell .ok {
  color: var(--ok);
}
.risk-cell .warn {
  color: var(--warn);
}
.risk-cell .risk {
  color: var(--risk);
}
@media (max-width: 1080px) {
  .flow-row {
    grid-template-columns: minmax(210px, 0.7fr) minmax(430px, 1.3fr);
  }
  .risk-cell {
    grid-column: 1 / -1;
  }
}
@media (max-width: 760px) {
  .flow-row {
    grid-template-columns: 1fr;
  }
  .risk-cell {
    grid-column: auto;
  }
}
</style>
