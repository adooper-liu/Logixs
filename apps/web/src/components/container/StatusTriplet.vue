<script setup lang="ts">
import type { StatusView } from "../../data/sample";

defineProps<{
  containerStatus: StatusView;
  taskStatus: StatusView;
  syncStatus: StatusView;
  compact?: boolean;
}>();
</script>

<template>
  <div
    class="status-triplet"
    :class="{ 'status-triplet--compact': compact }"
    aria-label="货柜、任务和同步状态"
  >
    <div class="status-cell">
      <span>货柜状态</span>
      <b :class="containerStatus.tone">{{ containerStatus.label }}</b>
      <small>{{ containerStatus.changedAt || "时间待记录" }}</small>
    </div>
    <div class="status-cell">
      <span>任务状态</span>
      <b :class="taskStatus.tone">{{ taskStatus.label }}</b>
      <small>{{ taskStatus.changedAt || "时间待记录" }}</small>
    </div>
    <div class="status-cell">
      <span>同步状态</span>
      <b :class="syncStatus.tone">{{ syncStatus.label }}</b>
      <small>{{ syncStatus.changedAt || "无待确认操作" }}</small>
    </div>
  </div>
</template>

<style scoped>
.status-triplet {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border: 1px solid var(--line);
  background: var(--surface);
  border-radius: var(--radius-m);
  overflow: hidden;
}

.status-cell {
  min-width: 0;
  padding: 10px 12px;
  border-right: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.status-cell:last-child {
  border-right: 0;
}

.status-cell span,
.status-cell small {
  color: var(--muted);
  font-size: 11px;
}

.status-cell b {
  overflow-wrap: anywhere;
}

.status-triplet--compact .status-cell {
  padding: 7px 10px;
}

.status-triplet--compact .status-cell span,
.status-triplet--compact .status-cell small {
  font-size: 10px;
}

.status-triplet--compact .status-cell b {
  font-size: 12px;
}

.ok {
  color: var(--ok);
}
.warn {
  color: var(--warn);
}
.risk {
  color: var(--risk);
}
.info {
  color: var(--info);
}
.muted {
  color: var(--muted);
}

@media (max-width: 720px) {
  .status-triplet:not(.status-triplet--compact) {
    grid-template-columns: 1fr;
  }

  .status-triplet:not(.status-triplet--compact) .status-cell {
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }

  .status-triplet:not(.status-triplet--compact) .status-cell:last-child {
    border-bottom: 0;
  }

  .status-triplet--compact .status-cell {
    padding: 7px 8px;
  }

  .status-triplet--compact .status-cell small {
    display: none;
  }
}
</style>
