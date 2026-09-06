<script setup lang="ts">
import { computed } from "vue";
import { ClipboardCheck, CloudCheck, Container } from "@lucide/vue";
import type { StatusView } from "../../data/sample";

const props = withDefaults(
  defineProps<{
    containerStatus: StatusView;
    taskStatus: StatusView;
    syncStatus: StatusView;
    compact?: boolean;
    showIdleSync?: boolean;
    variant?: "default" | "context";
  }>(),
  {
    compact: false,
    showIdleSync: true,
    variant: "default",
  },
);

const statusItems = computed(() => {
  const items = [
    { key: "container", label: "货柜状态", value: props.containerStatus },
    { key: "task", label: "任务状态", value: props.taskStatus },
    { key: "sync", label: "同步状态", value: props.syncStatus },
  ];
  return props.showIdleSync || props.syncStatus.code !== "idle"
    ? items
    : items.filter((item) => item.key !== "sync");
});
</script>

<template>
  <div
    class="status-triplet"
    :class="[
      `status-triplet--${variant}`,
      { 'status-triplet--compact': compact },
    ]"
    aria-label="货柜、任务和同步状态"
  >
    <div
      v-for="item in statusItems"
      :key="item.key"
      class="status-cell"
      :class="`status-cell--${item.key}`"
      data-testid="status-cell"
    >
      <span v-if="variant === 'context'" class="status-icon" aria-hidden="true">
        <Container v-if="item.key === 'container'" :size="16" />
        <ClipboardCheck v-else-if="item.key === 'task'" :size="16" />
        <CloudCheck v-else :size="16" />
      </span>
      <span class="status-label">{{ item.label }}</span>
      <b :class="item.value.tone">{{ item.value.label }}</b>
      <small>{{
        item.value.changedAt ||
        (item.key === "sync" ? "无待确认操作" : "时间待记录")
      }}</small>
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

.status-cell .status-label,
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

.status-triplet--compact .status-cell .status-label,
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

.status-triplet--context {
  border: 0;
  border-radius: 0;
}

.status-triplet--context .status-cell {
  grid-template-columns: 26px minmax(0, 1fr);
  grid-template-rows: auto auto;
  column-gap: 8px;
  align-content: center;
  padding: 9px 14px;
}

.status-triplet--context .status-icon {
  grid-row: 1 / 3;
  align-self: center;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-s);
  background: var(--surface-2);
  color: var(--muted);
}

.status-triplet--context .status-label,
.status-triplet--context .status-cell b,
.status-triplet--context .status-cell small {
  grid-column: 2;
}

.status-triplet--context .status-cell b {
  font-size: 14px;
  line-height: 1.25;
}

.status-triplet--context .status-cell small {
  margin-top: 1px;
}

.status-triplet--context .status-cell--container .status-icon {
  background: var(--ok-bg);
  color: var(--ok);
}

.status-triplet--context .status-cell--task .status-icon {
  background: var(--info-bg);
  color: var(--info);
}

.status-triplet--context .status-cell--sync .status-icon {
  background: var(--brand-soft);
  color: var(--brand);
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

  .status-triplet--context .status-cell {
    padding: 9px 10px;
  }
}
</style>
