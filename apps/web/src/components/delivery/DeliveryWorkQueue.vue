<script setup lang="ts">
import { TriangleAlert, Warehouse } from "@lucide/vue";
import type { DeliveryQueueItem } from "../../data/deliveryWorkbench";

defineProps<{
  items: readonly DeliveryQueueItem[];
  selectedTaskId: string;
  loading: boolean;
}>();
const emit = defineEmits<{ select: [item: DeliveryQueueItem] }>();
</script>

<template>
  <section class="queue" aria-label="送仓任务列表">
    <header>
      <span>送仓任务池</span><b>{{ items.length }}</b>
    </header>
    <p v-if="loading" class="empty">正在加载送仓任务…</p>
    <p v-else-if="!items.length" class="empty">当前没有待处理的送仓任务。</p>
    <button
      v-for="item in items"
      v-else
      :key="item.task.id"
      type="button"
      class="queue-item"
      :class="{ 'queue-item--active': item.task.id === selectedTaskId }"
      @click="emit('select', item)"
    >
      <Warehouse :size="16" />
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
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
  font-size: var(--text-label);
}
.queue-item {
  min-width: 0;
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  gap: var(--space-2);
  align-items: center;
  padding: var(--space-3) var(--space-3);
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
  gap: var(--space-1);
}
.queue-item b,
.queue-item small {
  overflow-wrap: anywhere;
}
.queue-item small,
.empty {
  color: var(--muted);
  font-size: var(--text-micro);
}
.queue-meta {
  justify-items: end;
}
.urgency {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
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
  padding: var(--space-5) var(--space-3);
}
</style>
