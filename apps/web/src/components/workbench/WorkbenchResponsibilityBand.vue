<script setup lang="ts">
import type { WorkbenchResponsibilityItem } from "./workbenchLayout.types";

defineProps<{
  regionLabel: string;
  items: readonly WorkbenchResponsibilityItem[];
}>();

defineSlots<{
  tail?(): unknown;
}>();

const displayValue = (item: WorkbenchResponsibilityItem) =>
  item.state === "known"
    ? item.value
    : item.state === "unknown"
      ? "未知"
      : "不适用";
</script>

<template>
  <section class="responsibility-band" :aria-label="regionLabel">
    <dl>
      <div v-for="item in items" :key="item.label">
        <dt>{{ item.label }}</dt>
        <dd>{{ displayValue(item) }}</dd>
      </div>
    </dl>
    <slot name="tail" />
  </section>
</template>

<style scoped>
.responsibility-band {
  min-width: 0;
  border: 1px solid var(--line);
  border-left: 3px solid var(--brand);
  border-radius: var(--radius-card);
  background: var(--surface);
  overflow: hidden;
}

.responsibility-band dl {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  margin: 0;
}

.responsibility-band dl > div {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
  padding: var(--space-3);
  border-right: 1px solid var(--line);
}

.responsibility-band dl > div:last-child {
  border-right: 0;
}

.responsibility-band dt,
.responsibility-band dd {
  margin: 0;
}

.responsibility-band dt {
  color: var(--muted);
  font-size: var(--text-micro);
}

.responsibility-band dd {
  color: var(--ink);
  font-size: var(--text-meta);
  font-weight: 600;
  overflow-wrap: anywhere;
}

@media (max-width: 680px) {
  .responsibility-band dl {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .responsibility-band dl > div {
    padding: var(--space-2);
    border-bottom: 1px solid var(--line);
  }
}
</style>
