<script setup lang="ts">
import { AlertTriangle, Clock3, PackageOpen, UserRound } from "@lucide/vue";
import { computed } from "vue";
import {
  filterStuffingQueue,
  type StuffingQueueFilter,
  type StuffingQueueItem,
} from "../../data/stuffingWorkbench";

const props = defineProps<{
  items: readonly StuffingQueueItem[];
  selectedTaskId: string;
  filter: StuffingQueueFilter;
  loading: boolean;
  error: string;
}>();

const emit = defineEmits<{
  select: [item: StuffingQueueItem];
  changeFilter: [filter: StuffingQueueFilter];
}>();

const filters: Array<{ value: StuffingQueueFilter; label: string }> = [
  { value: "mine", label: "我的任务" },
  { value: "executable", label: "可执行" },
  { value: "blocked", label: "阻塞" },
  { value: "due_soon", label: "临期" },
  { value: "all", label: "全部" },
];

const visibleItems = computed(() =>
  filterStuffingQueue(props.items, props.filter),
);

function countFor(filter: StuffingQueueFilter): number {
  return filterStuffingQueue(props.items, filter).length;
}

function dueLabel(value: string | null): string {
  if (!value) return "未设时限";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
</script>

<template>
  <div class="work-queue">
    <header class="queue-header">
      <span
        ><small>装箱岗位</small>
        <h2>工作队列</h2></span
      >
      <b>{{ visibleItems.length }} 项</b>
    </header>
    <div class="queue-filters" role="group" aria-label="筛选装箱任务">
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
    <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>
    <p v-if="loading" class="notice">正在整理装箱任务…</p>
    <p v-else-if="!visibleItems.length" class="notice">当前筛选下没有任务。</p>
    <div v-else class="queue-list" aria-label="装箱任务列表">
      <button
        v-for="item in visibleItems"
        :key="item.task.id"
        type="button"
        class="queue-item"
        :class="{ selected: selectedTaskId === item.task.id }"
        @click="emit('select', item)"
      >
        <span class="urgency" :class="`urgency--${item.urgencyRank}`">
          {{ item.urgencyLabel }}
        </span>
        <span class="queue-copy">
          <b>{{ item.title }}</b>
          <strong>
            {{ item.container?.containerNumber ?? "待绑定箱号" }}
            <small>{{ item.container?.orderNumber ?? "备货单待关联" }}</small>
          </strong>
          <span class="queue-meta">
            <span><UserRound :size="13" />{{ item.responsibility }}</span>
            <span><Clock3 :size="13" />{{ dueLabel(item.dueAt) }}</span>
          </span>
          <em v-if="item.blockerReason">
            <AlertTriangle :size="13" />{{ item.blockerReason }}
          </em>
          <span v-else-if="item.actionLabel" class="next-action">
            <PackageOpen :size="13" />下一步：{{ item.actionLabel }}
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
  padding: var(--space-3) var(--space-3);
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
}
.queue-header > span,
.queue-copy,
.queue-copy strong {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.queue-header h2 {
  margin: 0;
  font-size: var(--text-title);
}
.queue-header small,
.queue-copy small,
.queue-meta {
  color: var(--muted);
  font-size: var(--text-micro);
}
.queue-header > b,
.next-action {
  color: var(--brand-strong);
}
.queue-header > b {
  font-size: var(--text-label);
}
.queue-filters {
  display: grid;
  grid-template-columns: repeat(5, minmax(54px, 1fr));
  border-bottom: 1px solid var(--line);
  overflow-x: auto;
}
.queue-filters button {
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-1);
  border: 0;
  border-right: 1px solid var(--line);
  background: var(--surface);
  color: var(--muted);
  font-size: var(--text-micro);
  cursor: pointer;
}
.queue-filters button.active {
  box-shadow: inset 0 -2px var(--brand);
  color: var(--brand-strong);
  font-weight: 700;
}
.queue-filters span {
  min-width: 18px;
  padding: var(--space-1) var(--space-1);
  border-radius: 999px;
  background: var(--surface-2);
  font-size: var(--text-micro);
}
.queue-list {
  max-height: 680px;
  overflow-y: auto;
}
.queue-item {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-3);
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
.urgency {
  min-width: 42px;
  padding: var(--space-1) var(--space-1);
  border-radius: var(--radius-s);
  background: var(--surface-2);
  color: var(--muted);
  font-size: var(--text-micro);
  font-weight: 700;
  text-align: center;
}
.urgency--0,
.urgency--2 {
  background: var(--risk-bg);
  color: var(--risk);
}
.urgency--1 {
  background: var(--warn-bg);
  color: var(--warn);
}
.queue-copy > b,
.queue-copy strong,
.queue-copy em,
.next-action {
  overflow-wrap: anywhere;
}
.queue-copy > b {
  font-size: var(--text-label);
}
.queue-copy strong {
  font-size: var(--text-micro);
}
.queue-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
}
.queue-meta > span,
.queue-copy em,
.next-action {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}
.queue-copy em {
  color: var(--risk);
  font-size: var(--text-micro);
  font-style: normal;
}
.next-action {
  font-size: var(--text-micro);
}
.notice {
  margin: 0;
  padding: var(--space-5) var(--space-3);
  color: var(--muted);
  font-size: var(--text-label);
}
.notice--error {
  background: var(--risk-bg);
  color: var(--risk);
}
</style>
