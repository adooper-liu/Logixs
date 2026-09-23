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
    showIdleTask?: boolean;
    variant?: "default" | "context";
  }>(),
  {
    compact: false,
    showIdleSync: true,
    showIdleTask: true,
    variant: "default",
  },
);

const statusItems = computed(() =>
  [
    { key: "container", label: "货柜状态", value: props.containerStatus },
    { key: "task", label: "任务状态", value: props.taskStatus },
    { key: "sync", label: "同步状态", value: props.syncStatus },
  ].filter((item) => {
    if (
      item.key === "sync" &&
      !props.showIdleSync &&
      item.value.code === "idle"
    ) {
      return false;
    }
    if (
      item.key === "task" &&
      !props.showIdleTask &&
      item.value.code === "idle"
    ) {
      return false;
    }
    return true;
  }),
);
</script>

<template>
  <div
    class="status-triplet"
    :class="[
      `status-triplet--${variant}`,
      { 'status-triplet--compact': compact },
    ]"
    :style="{ '--status-count': String(statusItems.length) }"
    aria-label="货柜状态"
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
  grid-template-columns: repeat(var(--status-count, 3), minmax(0, 1fr));
  border: 1px solid var(--line);
  background: var(--surface);
  border-radius: var(--radius-m);
  overflow: hidden;
}

.status-cell {
  min-width: 0;
  padding: var(--space-3) var(--space-3);
  border-right: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.status-cell:last-child {
  border-right: 0;
}

.status-cell .status-label,
.status-cell small {
  color: var(--muted);
  font-size: var(--text-micro);
}

.status-cell b {
  overflow-wrap: anywhere;
}

.status-triplet--compact .status-cell {
  padding: var(--space-2) var(--space-3);
}

.status-triplet--compact .status-cell .status-label,
.status-triplet--compact .status-cell small {
  font-size: var(--text-micro);
}

.status-triplet--compact .status-cell b {
  font-size: var(--text-label);
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
  column-gap: var(--space-2);
  align-content: center;
  padding: var(--space-2) var(--space-4);
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
  font-size: var(--text-body);
  line-height: 1.25;
}

.status-triplet--context .status-cell small {
  margin-top: var(--space-1);
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
    padding: var(--space-2) var(--space-2);
  }

  .status-triplet--compact .status-cell small {
    display: none;
  }

  .status-triplet--context .status-cell {
    padding: var(--space-2) var(--space-3);
  }
}
</style>
