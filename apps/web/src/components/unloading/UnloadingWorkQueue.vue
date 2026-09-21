<script setup lang="ts">
import { PackageOpen, TriangleAlert } from "@lucide/vue";
import type { UnloadingQueueItem } from "../../data/unloadingWorkbench";

defineProps<{
  items: readonly UnloadingQueueItem[];
  selectedTaskId: string;
  loading: boolean;
}>();
const emit = defineEmits<{ select: [item: UnloadingQueueItem] }>();
</script>

<template>
  <section class="queue" aria-label="卸柜任务列表">
    <header>
      <span>卸柜任务池</span><b>{{ items.length }}</b>
    </header>
    <p v-if="loading" class="empty">正在加载卸柜任务…</p>
    <p v-else-if="!items.length" class="empty">当前没有待处理的卸柜任务。</p>
    <button
      v-for="item in items"
      v-else
      :key="item.task.id"
      type="button"
      class="queue-item"
      :class="{ 'queue-item--active': item.task.id === selectedTaskId }"
      @click="emit('select', item)"
    >
      <PackageOpen :size="16" />
      <span
        ><b>{{ item.container?.containerNumber ?? "待绑定货柜" }}</b
        ><small>{{
          item.container?.orderNumber ?? "备货单待关联"
        }}</small></span
      >
      <span class="queue-meta">
        <small :class="`urgency urgency--${item.urgency}`"
          ><TriangleAlert v-if="item.urgency !== 'normal'" :size="12" />{{
            item.urgency === "overdue"
              ? "已逾期"
              : item.urgency === "due_soon"
                ? "临期"
                : item.urgency === "blocked"
                  ? "待条件"
                  : "常规"
          }}</small
        >
        <small>{{ item.actionLabel }}</small>
      </span>
    </button>
  </section>
</template>

<style scoped>
.queue {
  display: grid;
}
header {
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
  font-size: 12px;
}
.queue-item {
  min-width: 0;
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  padding: 11px 12px;
  border: 0;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  text-align: left;
  cursor: pointer;
}
.queue-item:hover,
.queue-item--active {
  background: var(--brand-soft);
}
.queue-item--active {
  box-shadow: inset 3px 0 var(--brand);
}
.queue-item span {
  min-width: 0;
  display: grid;
  gap: 2px;
}
.queue-item b,
.queue-item small {
  overflow-wrap: anywhere;
}
.queue-item small,
.empty {
  color: var(--muted);
  font-size: 10px;
}
.queue-meta {
  justify-items: end;
}
.urgency {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.urgency--overdue,
.urgency--blocked {
  color: var(--risk);
}
.urgency--due_soon {
  color: var(--warn);
}
.empty {
  margin: 0;
  padding: 18px 12px;
}
</style>
