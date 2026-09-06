<script setup lang="ts">
import { computed } from "vue";
import { MonitorCog, TriangleAlert } from "@lucide/vue";
import type { TaskItem } from "../../data/sample";
import InfoTooltip from "../ui/InfoTooltip.vue";
import { projectTaskLanguage } from "./taskLanguageContract";

const props = defineProps<{
  tasks: TaskItem[];
  activeTaskId: string;
  selectionLocked: boolean;
}>();

const emit = defineEmits<{
  select: [taskId: string];
}>();

const actionableStatuses = new Set<TaskItem["status"]>([
  "available",
  "in_progress",
  "blocked",
  "under_review",
]);
const waitingStatuses = new Set<TaskItem["status"]>([
  "reported",
  "waiting_external",
]);
const sortByRiskAndDueAt = (left: TaskItem, right: TaskItem) =>
  right.riskPriority - left.riskPriority ||
  Date.parse(left.dueAt) - Date.parse(right.dueAt);

const withLanguage = (task: TaskItem) => ({
  task,
  language: projectTaskLanguage(task),
});

const humanTasks = computed(() =>
  props.tasks
    .filter(
      (task) =>
        task.queueKind === "human" && actionableStatuses.has(task.status),
    )
    .slice()
    .sort(sortByRiskAndDueAt)
    .map(withLanguage),
);
const waitingTasks = computed(() =>
  props.tasks
    .filter(
      (task) => task.queueKind === "human" && waitingStatuses.has(task.status),
    )
    .slice()
    .sort(sortByRiskAndDueAt)
    .map(withLanguage),
);
const monitorTasks = computed(() =>
  props.tasks.filter((task) => task.queueKind === "monitor").map(withLanguage),
);

const dueLabel = (dueAt: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(dueAt));
</script>

<template>
  <section class="queue" aria-label="待处理任务">
    <header class="queue-head">
      <div>
        <span>待我处理</span>
        <b data-testid="actionable-count">{{ humanTasks.length }}</b>
      </div>
      <InfoTooltip
        label="查看任务排序规则"
        text="人工任务先按风险等级排序，同等级再按截止时间升序。"
      />
    </header>

    <div class="queue-scroll" aria-label="任务列表" tabindex="0">
      <div class="task-list">
        <button
          v-for="item in humanTasks"
          :key="item.task.taskId"
          class="task-row"
          :class="{ active: item.task.taskId === activeTaskId }"
          type="button"
          :disabled="selectionLocked"
          data-testid="actionable-task"
          :data-task-id="item.task.taskId"
          @click="emit('select', item.task.taskId)"
        >
          <span class="tone" :class="item.language.tone"></span>
          <span class="task-copy">
            <span class="task-title">
              <b>{{ item.language.title }}</b>
              <strong :class="item.language.tone">{{
                item.language.statusLabel
              }}</strong>
            </span>
            <span class="meta mono"
              >{{ item.task.containerNumber }} · {{ item.task.nodeName }}</span
            >
            <span v-if="item.task.risk" class="risk-copy">
              <TriangleAlert :size="12" aria-hidden="true" />{{
                item.task.risk
              }}
            </span>
          </span>
          <span class="task-state">
            <small>截止</small>
            <time :datetime="item.task.dueAt">{{
              dueLabel(item.task.dueAt)
            }}</time>
          </span>
        </button>
      </div>

      <div v-if="waitingTasks.length" class="waiting-zone">
        <div class="monitor-head">
          <span>等待外部或落账</span><b>{{ waitingTasks.length }}</b>
        </div>
        <button
          v-for="item in waitingTasks"
          :key="item.task.taskId"
          class="waiting-row"
          type="button"
          :disabled="selectionLocked"
          @click="emit('select', item.task.taskId)"
        >
          <span
            ><b>{{ item.language.title }}</b
            ><small class="mono">{{ item.task.containerNumber }}</small></span
          >
          <strong :class="item.language.tone">{{
            item.language.statusLabel
          }}</strong>
        </button>
      </div>

      <details v-if="monitorTasks.length" class="monitor-zone">
        <summary class="monitor-head">
          <span><MonitorCog :size="15" aria-hidden="true" />自动监控</span>
          <small>异常 0 · {{ monitorTasks.length }} 项正常</small>
        </summary>
        <div
          v-for="item in monitorTasks"
          :key="item.task.taskId"
          class="monitor-row"
        >
          <span class="tone" :class="item.language.tone"></span>
          <span
            ><b>{{ item.task.nodeName }} · {{ item.language.title }}</b
            ><small
              >{{ item.language.statusLabel }} ·
              {{ dueLabel(item.task.dueAt) }}</small
            ></span
          >
        </div>
      </details>
    </div>
  </section>
</template>

<style scoped>
.queue {
  min-width: 0;
  max-height: calc(100dvh - var(--topbar-height) - 112px);
  display: flex;
  flex-direction: column;
  padding: 10px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-card);
  background: var(--surface-2);
}
.queue-head {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 36px;
  padding: 0 4px 8px;
}
.queue-scroll {
  min-height: 0;
  padding-right: 4px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}
.task-list {
  display: grid;
  gap: 8px;
}
.queue-head div,
.monitor-head,
.monitor-head > span {
  display: flex;
  align-items: center;
  gap: 7px;
}
.queue-head b,
.monitor-head b {
  color: var(--brand);
}
.task-row {
  width: 100%;
  min-height: 68px;
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: start;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--surface);
  color: var(--ink);
  text-align: left;
  cursor: pointer;
}

.task-row:hover,
.task-row.active {
  background: var(--surface-2);
}

.task-row:disabled {
  cursor: wait;
}

.task-row.active {
  border-color: var(--brand);
  box-shadow: inset 3px 0 var(--brand);
}

.tone {
  width: 7px;
  height: 7px;
  flex: none;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--muted);
}

.tone.ok {
  background: var(--ok);
}
.tone.warn {
  background: var(--warn);
}
.tone.risk {
  background: var(--risk);
}
.tone.info {
  background: var(--info);
}

.task-copy,
.task-state,
.monitor-row > span:last-child {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.task-title,
.task-title > b,
.monitor-row b {
  min-width: 0;
  overflow-wrap: anywhere;
}

.task-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.task-title strong {
  flex: none;
  font-size: 10px;
}

.meta,
.task-state small,
.task-state time,
.monitor-row small {
  color: var(--muted);
  font-size: 10px;
}

.risk-copy {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--risk);
  font-size: 10px;
}

.risk-copy svg {
  flex: none;
}

.task-state {
  gap: 0;
  text-align: right;
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
.waiting-zone,
.monitor-zone {
  margin-top: 12px;
  padding: 9px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--surface);
}

.waiting-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 0;
  border: 0;
  border-top: 1px dashed var(--line);
  background: transparent;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
}

.waiting-row > span {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.waiting-row small {
  color: var(--muted);
  font-size: 10px;
}

.waiting-row strong {
  flex: none;
  font-size: 11px;
}
.monitor-head {
  justify-content: space-between;
  font-size: 12px;
  cursor: pointer;
  list-style: none;
}

.monitor-head::-webkit-details-marker {
  display: none;
}
.monitor-head small {
  color: var(--muted);
}

.monitor-row {
  display: flex;
  gap: 8px;
  padding: 7px 0;
  border-top: 1px dashed var(--line);
  font-size: 11px;
}
.monitor-zone[open] .monitor-head {
  margin-bottom: 6px;
}

@media (max-width: 767px) {
  .queue {
    max-height: none;
  }

  .queue-scroll {
    padding-right: 0;
    overflow-y: visible;
  }
}

@media (max-width: 720px) {
  .task-row {
    grid-template-columns: 7px minmax(0, 1fr);
    min-height: 72px;
  }

  .task-state {
    grid-column: 2;
    display: none;
  }
}
</style>
