<script setup lang="ts">
import StatusTriplet from "../container/StatusTriplet.vue";
import type { ContainerProjection } from "../../data/sample";
import InfoTooltip from "../ui/InfoTooltip.vue";

defineProps<{ rows: ContainerProjection[] }>();
</script>

<template>
  <section class="flow-panel">
    <header class="panel-head">
      <h3>货柜全生命周期状态链</h3>
      <InfoTooltip
        label="查看生命周期状态口径"
        text="每个货柜流转记录独立成档，同时保留货柜状态、任务状态和同步状态。"
      />
    </header>
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
          <span class="mono"
            >{{ row.orderNumber }} · {{ row.containerRecordId }}</span
          >
          <b>{{ row.currentNode }}</b>
        </div>
        <StatusTriplet
          class="row-status"
          :container-status="row.currentStatus"
          :task-status="row.taskStatus"
          :sync-status="row.syncStatus"
          compact
        />
        <div class="risk-cell">
          <span>风险 / 待办</span><b :class="row.tone">{{ row.risk }}</b>
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
.panel-head {
  align-items: center;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  min-height: 40px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
}
.panel-head h3 {
  margin: 0;
  font-size: 14px;
}
.flow-row {
  display: grid;
  grid-template-columns: minmax(210px, 0.7fr) minmax(430px, 1.5fr) minmax(
      150px,
      0.5fr
    );
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
  .panel-head {
    align-items: center;
    flex-direction: row;
  }
  .flow-row {
    grid-template-columns: 1fr;
  }
  .risk-cell {
    grid-column: auto;
  }
}
</style>
