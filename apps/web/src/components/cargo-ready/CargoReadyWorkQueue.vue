<script setup lang="ts">
import {
  AlertTriangle,
  Clock3,
  ListFilter,
  ShieldAlert,
  UserRound,
} from "@lucide/vue";
import { computed } from "vue";
import type { ContainerSummary } from "../../api/containers";
import type { ExternalWorkItem } from "../../api/workItems";
import {
  cargoReadyRoleLabel,
  filterCargoReadyQueue,
  type CargoReadyQueueFilter,
  type CargoReadyQueueItem,
} from "../../data/cargoReadyWorkbench";

const props = defineProps<{
  items: readonly CargoReadyQueueItem[];
  selectedTaskId: string;
  filter: CargoReadyQueueFilter;
  loading: boolean;
  error: string;
  remediationItems: readonly ExternalWorkItem[];
  containers: readonly ContainerSummary[];
}>();

const emit = defineEmits<{
  select: [item: CargoReadyQueueItem];
  changeFilter: [filter: CargoReadyQueueFilter];
  selectRemediation: [item: ExternalWorkItem];
}>();

const filters: Array<{ value: CargoReadyQueueFilter; label: string }> = [
  { value: "mine", label: "我的任务" },
  { value: "executable", label: "可执行" },
  { value: "blocked", label: "阻塞" },
  { value: "due_soon", label: "临期" },
  { value: "all", label: "全部" },
];

const visibleItems = computed(() =>
  filterCargoReadyQueue(props.items, props.filter),
);
const containerById = computed(
  () => new Map(props.containers.map((item) => [item.id, item])),
);
const openRemediationItems = computed(() =>
  props.remediationItems.filter((item) => item.state === "open"),
);

function countFor(filter: CargoReadyQueueFilter): number {
  return filterCargoReadyQueue(props.items, filter).length;
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
      <span>
        <small>备货岗位</small>
        <h2>工作队列</h2>
      </span>
      <b>{{ visibleItems.length }} 项</b>
    </header>

    <div class="queue-filters" role="group" aria-label="筛选备货任务">
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
    <p v-if="loading" class="queue-notice">正在整理备货任务…</p>
    <p v-else-if="!visibleItems.length" class="queue-notice">
      当前筛选下没有任务。
    </p>

    <div v-else class="queue-list" aria-label="备货任务列表">
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
            {{ item.container?.containerNumber ?? "未绑箱号" }}
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
            <ListFilter :size="13" />下一步：{{ item.actionLabel }}
          </span>
        </span>
      </button>
    </div>

    <section class="remediation-queue" aria-label="专业整改任务">
      <header>
        <span><ShieldAlert :size="15" aria-hidden="true" />专业整改</span>
        <b>{{ openRemediationItems.length }}</b>
      </header>
      <p v-if="!openRemediationItems.length">当前没有开放的合规整改。</p>
      <button
        v-for="item in openRemediationItems"
        :key="item.id"
        type="button"
        @click="emit('selectRemediation', item)"
      >
        <span>
          <b>{{ item.title }}</b>
          <small>
            {{
              containerById.get(item.containerId)?.containerNumber ?? "未绑箱号"
            }}
            · {{ cargoReadyRoleLabel(item.assignedRoleCode) }}
          </small>
        </span>
        <em>{{
          item.priority === "critical"
            ? "紧急"
            : item.priority === "high"
              ? "高"
              : "待办"
        }}</em>
      </button>
    </section>
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
.queue-header > span {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.queue-header small,
.queue-copy small,
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
.queue-filters button:last-child {
  border-right: 0;
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
  max-height: 620px;
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
.queue-copy,
.queue-copy strong {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
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
  gap: var(--space-1);
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
  color: var(--brand-strong);
  font-size: var(--text-micro);
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

.remediation-queue {
  border-top: 2px solid var(--line-strong);
}

.remediation-queue > header,
.remediation-queue > button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
}

.remediation-queue > header {
  background: var(--surface-2);
  font-size: var(--text-micro);
}

.remediation-queue > header span {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.remediation-queue > p {
  margin: 0;
  padding: var(--space-3);
  color: var(--muted);
  font-size: var(--text-micro);
}

.remediation-queue > button {
  border: 0;
  border-top: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  text-align: left;
  cursor: pointer;
}

.remediation-queue > button:hover {
  background: var(--warn-bg);
}

.remediation-queue > button > span {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.remediation-queue > button b,
.remediation-queue > button small {
  overflow-wrap: anywhere;
}

.remediation-queue > button b {
  font-size: var(--text-micro);
}

.remediation-queue > button small {
  color: var(--muted);
  font-size: var(--text-micro);
}

.remediation-queue > button em {
  flex: none;
  color: var(--risk);
  font-size: var(--text-micro);
  font-style: normal;
  font-weight: 700;
}
@media (max-width: 720px) {
  .queue-list {
    max-height: none;
  }
}
</style>
