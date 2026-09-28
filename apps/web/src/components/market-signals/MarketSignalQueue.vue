<script setup lang="ts">
import { AlertCircle, ArrowRight, Clock3, Plus } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import type {
  MarketSignalQueueItem,
  MarketSignalWorkflowState,
} from "../../data/marketSignalScenarios";

const props = defineProps<{
  items: readonly MarketSignalQueueItem[];
  selectedId: string;
}>();

const emit = defineEmits<{
  select: [id: string];
  create: [];
}>();

type QueueFilter = MarketSignalWorkflowState;

const filters: readonly { code: QueueFilter; label: string }[] = [
  { code: "needs_decision", label: "待判断" },
  { code: "returned_from_selection", label: "选品退回" },
  { code: "watching", label: "继续观察" },
  { code: "handed_off", label: "已交接" },
  { code: "dismissed", label: "不采纳" },
];

const filter = ref<QueueFilter>("needs_decision");
const visibleItems = computed(() =>
  props.items.filter((item) => item.workflowState === filter.value),
);

watch(
  () => props.items.find((item) => item.id === props.selectedId)?.workflowState,
  (state) => {
    if (state) filter.value = state;
  },
);

function countFor(state: QueueFilter): number {
  return props.items.filter((item) => item.workflowState === state).length;
}
</script>

<template>
  <div class="signal-queue">
    <header class="pane-heading">
      <div>
        <small>先处理什么</small>
        <h2>经营信号</h2>
      </div>
      <button type="button" class="create-button" @click="emit('create')">
        <Plus :size="15" aria-hidden="true" />登记信号
      </button>
    </header>

    <div class="queue-filters" role="tablist" aria-label="信号处理进度">
      <button
        v-for="item in filters"
        :key="item.code"
        type="button"
        role="tab"
        :aria-selected="filter === item.code"
        :class="{ active: filter === item.code }"
        @click="filter = item.code"
      >
        {{ item.label }} <b>{{ countFor(item.code) }}</b>
      </button>
    </div>

    <div class="queue-list" aria-label="经营信号列表">
      <button
        v-for="item in visibleItems"
        :key="item.id"
        type="button"
        class="queue-item"
        :class="{ selected: item.id === selectedId }"
        :aria-current="item.id === selectedId ? 'true' : undefined"
        @click="emit('select', item.id)"
      >
        <span class="queue-item__topline">
          <span :class="`urgency urgency--${item.urgency}`">
            <Clock3 :size="13" aria-hidden="true" />{{ item.urgencyLabel }}
          </span>
          <ArrowRight :size="15" aria-hidden="true" />
        </span>
        <strong>{{ item.title }}</strong>
        <span class="queue-item__scope">
          {{ item.market || "市场待补" }} · {{ item.channel || "渠道待补" }}
        </span>
        <span class="queue-item__reason-label">为什么现在处理</span>
        <span class="queue-item__reason">
          <AlertCircle :size="14" aria-hidden="true" />
          {{ item.workReason }}
        </span>
        <span v-if="item.gaps.length" class="queue-item__gaps">
          仍待补 {{ item.gaps.length }} 项，不影响先处理
        </span>
      </button>

      <p v-if="visibleItems.length === 0" class="empty-state">
        这一组暂时没有信号。
      </p>
    </div>
  </div>
</template>

<style scoped>
.signal-queue {
  min-width: 0;
}

.pane-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
}

.pane-heading div {
  min-width: 0;
}

.pane-heading small {
  color: var(--brand-strong);
  font-size: var(--text-micro);
  font-weight: 700;
}

.pane-heading h2 {
  margin: var(--space-1) 0 0;
  font-size: var(--text-title);
}

.create-button {
  flex: none;
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0 var(--space-2);
  border: 1px solid var(--brand-line);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--brand-strong);
  cursor: pointer;
  font: inherit;
  font-size: var(--text-label);
  font-weight: 700;
}

.queue-filters {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-1);
  padding: var(--space-2);
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
}

.queue-filters button {
  min-width: 0;
  min-height: 34px;
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--ink-soft);
  cursor: pointer;
  font: inherit;
  font-size: var(--text-label);
}

.queue-filters button.active {
  border-color: var(--brand-line);
  background: var(--surface);
  color: var(--brand-strong);
  font-weight: 700;
}

.queue-filters b {
  margin-left: var(--space-1);
}

.queue-list {
  display: grid;
}

.queue-item {
  min-width: 0;
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border: 0;
  border-bottom: 1px solid var(--line);
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.queue-item:hover {
  background: var(--surface-2);
}

.queue-item:focus-visible,
.queue-filters button:focus-visible,
.create-button:focus-visible {
  outline: 0;
  box-shadow: inset var(--focus-ring);
}

.queue-item.selected {
  box-shadow: inset 3px 0 var(--brand);
  background: var(--brand-soft);
}

.queue-item__topline,
.urgency,
.queue-item__reason {
  display: flex;
  align-items: center;
}

.queue-item__topline {
  justify-content: space-between;
  gap: var(--space-2);
  color: var(--muted);
}

.urgency {
  gap: var(--space-1);
  color: var(--muted);
  font-size: var(--text-micro);
  font-weight: 700;
}

.urgency--today {
  color: var(--risk);
}

.urgency--this_week {
  color: var(--warn);
}

.queue-item strong {
  overflow-wrap: anywhere;
  color: var(--ink);
  font-size: var(--text-meta);
  line-height: var(--leading-title);
}

.queue-item__scope,
.queue-item__reason,
.queue-item__gaps {
  color: var(--ink-soft);
  font-size: var(--text-label);
  line-height: var(--leading-body);
}

.queue-item__reason-label {
  color: var(--brand-strong);
  font-size: var(--text-micro);
  font-weight: 700;
}

.queue-item__reason {
  align-items: flex-start;
  gap: var(--space-1);
}

.queue-item__reason svg {
  flex: none;
  margin-top: var(--space-1);
  color: var(--brand-strong);
}

.queue-item__gaps {
  color: var(--warn);
}

.empty-state {
  margin: 0;
  padding: var(--space-5) var(--space-4);
  color: var(--muted);
  font-size: var(--text-label);
  text-align: center;
}

@media (max-width: 680px) {
  .queue-list {
    max-height: 220px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
}
</style>
