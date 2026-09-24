<script setup lang="ts">
import { Boxes, CircleUserRound, PackageSearch } from "@lucide/vue";
import { computed } from "vue";
import {
  filterCargoReadyQueue,
  type CargoReadyQueueFilter,
  type CargoReadyQueueItem,
} from "../../data/cargoReadyWorkbench";

const props = defineProps<{
  items: readonly CargoReadyQueueItem[];
  selectedOrderId: string;
  filter: CargoReadyQueueFilter;
  loading: boolean;
  error: string;
}>();

const emit = defineEmits<{
  select: [item: CargoReadyQueueItem];
  changeFilter: [filter: CargoReadyQueueFilter];
}>();

const filters: Array<{ value: CargoReadyQueueFilter; label: string }> = [
  { value: "mine", label: "待我处理" },
  { value: "waiting_other", label: "等待他人" },
  { value: "all", label: "全部" },
];

const visibleItems = computed(() =>
  filterCargoReadyQueue(props.items, props.filter),
);

function countFor(filter: CargoReadyQueueFilter): number {
  return filterCargoReadyQueue(props.items, filter).length;
}
</script>

<template>
  <div class="work-queue">
    <header class="queue-header">
      <span>
        <small>为什么要处理</small>
        <h2>今天要处理</h2>
      </span>
      <b>{{ visibleItems.length }} 单</b>
    </header>

    <div class="queue-filters" role="group" aria-label="筛选备货单">
      <button
        v-for="item in filters"
        :key="item.value"
        type="button"
        :class="{ active: filter === item.value }"
        :aria-pressed="filter === item.value"
        @click="emit('changeFilter', item.value)"
      >
        {{ item.label }}<span>{{ countFor(item.value) }}</span>
      </button>
    </div>

    <p v-if="error" class="queue-notice queue-notice--error" role="alert">
      {{ error }}
    </p>
    <p v-else-if="loading" class="queue-notice">正在整理备货单…</p>
    <p v-else-if="!visibleItems.length" class="queue-notice">
      当前筛选下没有需要处理的备货单。
    </p>

    <div v-else class="queue-list" aria-label="备货单工作列表">
      <button
        v-for="item in visibleItems"
        :key="item.order.id"
        type="button"
        class="queue-item"
        :class="{ selected: selectedOrderId === item.order.id }"
        :aria-current="selectedOrderId === item.order.id ? 'true' : undefined"
        @click="emit('select', item)"
      >
        <span class="reason-mark" aria-hidden="true">
          <PackageSearch :size="17" />
        </span>
        <span class="queue-copy">
          <span class="reason-row">
            <b>{{ item.title }}</b>
            <em v-if="item.gapCount">{{ item.gapCount }} 个 SKU</em>
          </span>
          <strong>{{ item.order.orderNumber }}</strong>
          <span>{{ item.detail }}</span>
          <span class="queue-meta">
            <span><Boxes :size="13" />{{ item.relatedContainerLabel }}</span>
            <span>
              <CircleUserRound :size="13" />
              {{ item.responsibility === "mine" ? "由我处理" : "等待责任岗" }}
            </span>
          </span>
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.work-queue {
  min-width: 0;
}

.queue-header {
  min-height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3);
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
}

.queue-header > span,
.queue-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.queue-header small,
.queue-copy > span,
.queue-meta {
  color: var(--muted);
  font-size: var(--text-micro);
}

.queue-header h2 {
  margin: 0;
  font-size: var(--text-title);
}

.queue-header > b {
  color: var(--brand-strong);
  font-size: var(--text-label);
}

.queue-filters {
  display: grid;
  grid-template-columns: repeat(3, minmax(88px, 1fr));
  border-bottom: 1px solid var(--line);
}

.queue-filters button {
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  padding: var(--space-2);
  border: 0;
  border-right: 1px solid var(--line);
  background: var(--surface);
  color: var(--muted);
  font-size: var(--text-micro);
  cursor: pointer;
}

.queue-filters button:last-child {
  border-right: 0;
}

.queue-filters button.active {
  box-shadow: inset 0 -2px var(--brand);
  color: var(--brand-strong);
  font-weight: 700;
}

.queue-filters span {
  min-width: 20px;
  padding: var(--space-1);
  border-radius: var(--radius-s);
  background: var(--surface-2);
}

.queue-list {
  max-height: 680px;
  overflow-y: auto;
}

.queue-item {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  align-items: start;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 0;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  text-align: left;
  cursor: pointer;
}

.queue-item:hover,
.queue-item.selected {
  background: var(--brand-soft);
}

.queue-item.selected {
  box-shadow: inset 3px 0 var(--brand);
}

.reason-mark {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-s);
  background: var(--warn-bg);
  color: var(--warn);
}

.reason-row,
.queue-meta,
.queue-meta > span {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.reason-row {
  justify-content: space-between;
}

.reason-row b,
.queue-copy strong,
.queue-copy > span {
  overflow-wrap: anywhere;
}

.reason-row b {
  font-size: var(--text-label);
}

.reason-row em {
  flex: none;
  color: var(--risk);
  font-size: var(--text-micro);
  font-style: normal;
  font-weight: 700;
}

.queue-copy strong {
  font-size: var(--text-meta);
}

.queue-meta {
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
  margin-top: var(--space-1);
}

.queue-notice {
  margin: 0;
  padding: var(--space-5) var(--space-3);
  color: var(--muted);
  font-size: var(--text-label);
}

.queue-notice--error {
  background: var(--risk-bg);
  color: var(--risk);
}

@media (max-width: 720px) {
  .queue-list {
    max-height: none;
  }
}
</style>
