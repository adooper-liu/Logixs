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
  counts?: Partial<Record<MarketSignalWorkflowState, number>>;
  hasMore?: Partial<Record<MarketSignalWorkflowState, boolean>>;
  loadingMore?: Partial<Record<MarketSignalWorkflowState, boolean>>;
  groupErrors?: Partial<Record<MarketSignalWorkflowState, string>>;
}>();

const emit = defineEmits<{
  select: [id: string];
  clear: [];
  create: [];
  loadMore: [destination: MarketSignalWorkflowState];
  retryGroup: [destination: MarketSignalWorkflowState];
}>();

type QueueFilter = MarketSignalWorkflowState;

const filters: readonly { code: QueueFilter; label: string }[] = [
  { code: "needs_decision", label: "待判断" },
  { code: "selection_return_requested", label: "选品请求退回" },
  { code: "returned_from_selection", label: "选品退回" },
  { code: "watching", label: "继续观察" },
  { code: "handed_off", label: "已交接" },
  { code: "dismissed", label: "不采纳" },
  { code: "voided", label: "已作废" },
  { code: "archived", label: "已归档" },
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
  return (
    props.counts?.[state] ??
    props.items.filter((item) => item.workflowState === state).length
  );
}

function chooseFilter(code: QueueFilter): void {
  if (filter.value === code) return;
  filter.value = code;
  // 分组切换后旧选中不在当前列表里，右侧若继续展示会造成事实/动作错位。
  emit("clear");
}

const tabRefs = ref<HTMLButtonElement[]>([]);

// WAI-ARIA tabs：Tab 只停在当前分组，方向键/Home/End 切换并移动焦点。
function onTabKeydown(event: KeyboardEvent, index: number): void {
  const last = filters.length - 1;
  const nextIndex =
    event.key === "ArrowRight" || event.key === "ArrowDown"
      ? index === last
        ? 0
        : index + 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? index === 0
          ? last
          : index - 1
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? last
            : null;
  if (nextIndex === null) return;
  event.preventDefault();
  chooseFilter(filters[nextIndex]!.code);
  tabRefs.value[nextIndex]?.focus();
}

function isClosedState(state: QueueFilter): boolean {
  return state === "voided" || state === "archived";
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
        v-for="(item, index) in filters"
        :id="`signal-queue-tab-${item.code}`"
        :key="item.code"
        ref="tabRefs"
        type="button"
        role="tab"
        aria-controls="signal-queue-panel"
        :aria-selected="filter === item.code"
        :tabindex="filter === item.code ? 0 : -1"
        :class="{ active: filter === item.code }"
        @click="chooseFilter(item.code)"
        @keydown="onTabKeydown($event, index)"
      >
        {{ item.label }} <b>{{ countFor(item.code) }}</b>
      </button>
    </div>

    <div
      id="signal-queue-panel"
      class="queue-list"
      role="tabpanel"
      :aria-labelledby="`signal-queue-tab-${filter}`"
    >
      <p v-if="groupErrors?.[filter]" class="group-error" role="alert">
        <span>这一组暂时没加载成功：{{ groupErrors[filter] }}</span>
        <button type="button" @click="emit('retryGroup', filter)">
          重试这一组
        </button>
      </p>
      <button
        v-for="item in visibleItems"
        :key="item.id"
        type="button"
        class="queue-item"
        :class="{
          selected: item.id === selectedId,
          'queue-item--closed': isClosedState(item.workflowState),
        }"
        :aria-current="item.id === selectedId ? 'true' : undefined"
        @click="emit('select', item.id)"
      >
        <span class="queue-item__topline">
          <span
            :class="
              isClosedState(item.workflowState)
                ? 'urgency urgency--closed'
                : `urgency urgency--${item.urgency}`
            "
          >
            <Clock3 :size="13" aria-hidden="true" />{{ item.urgencyLabel }}
          </span>
          <ArrowRight :size="15" aria-hidden="true" />
        </span>
        <strong>{{ item.title }}</strong>
        <span class="queue-item__scope">
          <template v-if="isClosedState(item.workflowState)">
            {{ item.market || "市场未填" }} · {{ item.channel || "渠道未填" }}
          </template>
          <template v-else>
            {{ item.market || "市场待补" }} · {{ item.channel || "渠道待补" }}
          </template>
        </span>
        <span class="queue-item__reason-label">
          {{
            isClosedState(item.workflowState) ? "关闭说明" : "为什么现在处理"
          }}
        </span>
        <span class="queue-item__reason">
          <AlertCircle :size="14" aria-hidden="true" />
          {{ item.workReason }}
        </span>
        <template v-if="item.workflowState === 'watching'">
          <span v-if="item.activeValidation" class="queue-item__validation">
            <span class="queue-item__focus">
              验证：{{
                item.activeValidation.watchFocus ||
                "旧记录未填写验证重点，需重新安排"
              }}
            </span>
            检查日 {{ item.activeValidation.nextReviewDate }} · 负责人
            {{ item.activeValidation.responsibleActorId }}
            <template v-if="item.activeValidation.waitingReason">
              · 等待 {{ item.activeValidation.waitingReason }}
            </template>
          </span>
          <span v-else class="queue-item__validation">
            旧记录没有当前验证承诺，需重新安排
          </span>
        </template>
        <span
          v-if="item.gaps.length && !isClosedState(item.workflowState)"
          class="queue-item__gaps"
        >
          仍待补 {{ item.gaps.length }} 项，不影响先处理
        </span>
        <span
          v-else-if="item.gaps.length && isClosedState(item.workflowState)"
          class="queue-item__gaps queue-item__gaps--closed"
        >
          关闭时未补 {{ item.gaps.length }} 项
        </span>
      </button>

      <button
        v-if="hasMore?.[filter]"
        type="button"
        class="load-more"
        :disabled="loadingMore?.[filter]"
        @click="emit('loadMore', filter)"
      >
        {{ loadingMore?.[filter] ? "正在加载..." : "加载更多" }}
      </button>

      <p
        v-if="visibleItems.length === 0 && !groupErrors?.[filter]"
        class="empty-state"
      >
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
.create-button:focus-visible,
.group-error button:focus-visible,
.load-more:focus-visible {
  outline: 0;
  box-shadow: inset var(--focus-ring);
}

.queue-item.selected {
  box-shadow: inset 3px 0 var(--brand);
  background: var(--brand-soft);
}

.queue-item--closed {
  opacity: 0.72;
  filter: saturate(0.55);
}

.queue-item--closed.selected {
  box-shadow: inset 3px 0 var(--ink-soft);
  background: var(--surface-2);
}

.queue-item--closed strong {
  color: var(--ink-soft);
  text-decoration: line-through;
  text-decoration-thickness: 1px;
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

.urgency--closed {
  color: var(--ink-soft);
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

.queue-item__gaps--closed {
  color: var(--muted);
}

.queue-item__validation {
  display: block;
  color: var(--ink-soft);
  font-size: var(--text-label);
  overflow-wrap: anywhere;
}

.queue-item__focus {
  display: block;
  color: var(--ink);
  font-weight: 600;
}

.group-error {
  display: grid;
  gap: var(--space-2);
  margin: var(--space-2) var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-left: 3px solid var(--risk);
  background: var(--surface-2);
  color: var(--ink-soft);
  font-size: var(--text-label);
  overflow-wrap: anywhere;
}

.group-error button {
  justify-self: start;
  min-height: var(--touch-target);
  padding: 0 var(--space-3);
  border: 1px solid var(--brand-line);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--brand-strong);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.load-more:disabled {
  cursor: progress;
  opacity: 0.7;
}

.load-more {
  width: calc(100% - 2 * var(--space-3));
  min-height: var(--touch-target);
  margin: var(--space-2) var(--space-3);
  border: 1px solid var(--brand-line);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--brand-strong);
  cursor: pointer;
  font: inherit;
  font-size: var(--text-label);
  font-weight: 700;
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
