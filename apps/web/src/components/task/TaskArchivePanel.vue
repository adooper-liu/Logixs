<script setup lang="ts">
import { computed, watch } from "vue";
import { ListPlus, RefreshCw } from "@lucide/vue";
import type { NodeTaskOutcome } from "../../api/nodeTasks";
import type {
  ObjectActivityItem,
  ObjectNextAction,
} from "../../api/objectActivities";
import { useTaskArchive } from "../../composables/useTaskArchive";
import { EVENT_CODE_LABELS } from "../../data/liveEventProjection";

const props = defineProps<{
  containerId: string;
  taskId: string;
  outcome: NodeTaskOutcome | null;
}>();

const archive = useTaskArchive();

watch(
  () => props.containerId,
  (containerId) => {
    void archive.load(containerId);
  },
  { immediate: true },
);

const originalTaskItems = computed(() =>
  archive.items.value.filter((item) => item.taskId === props.taskId),
);
const relatedObjectItems = computed(() =>
  archive.items.value.filter((item) => item.taskId !== props.taskId),
);

const activityLabels: Record<string, string> = {
  lifecycle_event_recorded: "生命周期事实",
  problem_notification_posted: "问题通知",
  task_created: "任务已生成",
  work_order_claimed: "工单已领取",
  work_order_completed: "工单已完成",
};

const sourceLabels: Record<string, string> = {
  canonical_event: "生命周期事实",
  node_task: "任务记录",
  client_operation: "操作回执",
  ops_notification: "可见通知",
};

const actionLabels: Record<string, string> = {
  "work_execution.claim_work_order": "领取工单",
  "work_execution.complete_work_order": "完成工单",
};

const visibleSources = computed(() => [
  ...new Set(
    archive.items.value.map(
      (item) => sourceLabels[item.sourceType] ?? "其他可见来源",
    ),
  ),
]);

function formatTime(value: string | null): string {
  if (!value) return "未提供发生时间";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function activityLabel(item: ObjectActivityItem): string {
  if (item.sourceType === "canonical_event" && item.title) {
    const eventLabel = EVENT_CODE_LABELS[item.title];
    if (eventLabel) return eventLabel;
  }
  return (
    activityLabels[item.activityCode] ??
    sourceLabels[item.sourceType] ??
    "对象事实"
  );
}

function actionLabel(action: ObjectNextAction): string {
  return actionLabels[action.actionCode] ?? "查看办理事项";
}

function actionOwner(action: ObjectNextAction): string {
  if (action.assigneeId) return "已分配人员";
  if (action.assignmentState === "automatic") return "系统";
  return "任务池";
}

function outcomeLabel(): string {
  if (!props.outcome) return "尚无正式结果";
  return props.outcome.nextState === "completed"
    ? "已完成"
    : props.outcome.nextState;
}
</script>

<template>
  <article class="task-archive">
    <section class="archive-boundary" aria-label="档案覆盖边界">
      <div>
        <strong>当前身份可见来源</strong>
        <span>{{ visibleSources.join("、") || "当前无可见记录" }}</span>
      </div>
      <p>部分来源可能因权限不可见，这属于当前身份的有界视图。</p>
      <p>正式责任交接快照未接通 · 来源版本未接通 · 协作和 AI 轨道未接通</p>
      <details>
        <summary>查看覆盖限制</summary>
        <p>任务来源最多 200 条；当前组合不代表全局审计。</p>
        <p v-if="archive.projectionVersion.value !== null">
          组合投影版本 {{ archive.projectionVersion.value }}，不是单条来源版本。
        </p>
      </details>
    </section>

    <section class="archive-outcome" aria-label="原任务正式结果">
      <span>原任务正式结果</span>
      <strong data-testid="archive-outcome">{{ outcomeLabel() }}</strong>
      <time v-if="outcome" :datetime="outcome.evaluatedAt">
        {{ formatTime(outcome.evaluatedAt) }}
      </time>
      <small v-else>结果形成时间未知</small>
    </section>

    <section
      v-if="archive.nextActions.value.length"
      class="archive-next-actions"
      aria-label="当前可见后续办理"
    >
      <h3>当前可见后续办理</h3>
      <ul>
        <li
          v-for="action in archive.nextActions.value"
          :key="action.workOrderId"
        >
          <div>
            <b>{{ actionLabel(action) }}</b>
            <span>责任：{{ actionOwner(action) }}</span>
            <span>
              期限：{{ action.dueAt ? formatTime(action.dueAt) : "未设截止" }}
            </span>
            <details>
              <summary>技术引用</summary>
              <dl>
                <div>
                  <dt>动作引用</dt>
                  <dd class="mono">{{ action.actionCode }}</dd>
                </div>
                <div>
                  <dt>任务定义</dt>
                  <dd class="mono">{{ action.taskDefinitionKey }}</dd>
                </div>
                <div>
                  <dt>工单定义</dt>
                  <dd class="mono">{{ action.workOrderDefinitionKey }}</dd>
                </div>
                <div v-if="action.assigneeId">
                  <dt>人员引用</dt>
                  <dd class="mono">{{ action.assigneeId }}</dd>
                </div>
              </dl>
            </details>
          </div>
          <RouterLink :to="action.targetPath">打开办理</RouterLink>
        </li>
      </ul>
    </section>

    <p v-if="archive.loading.value" class="archive-state" role="status">
      正在读取档案…
    </p>
    <div
      v-else-if="archive.error.value"
      class="archive-state archive-state--error"
      role="alert"
    >
      <p>{{ archive.error.value }}</p>
      <button
        type="button"
        data-testid="archive-retry"
        @click="archive.refresh"
      >
        <RefreshCw :size="15" aria-hidden="true" />重试
      </button>
    </div>
    <template v-else>
      <section class="archive-section" aria-label="原任务记录">
        <h3>原任务记录</h3>
        <ol v-if="originalTaskItems.length">
          <li v-for="item in originalTaskItems" :key="item.id">
            <div class="archive-record__headline">
              <b>{{ activityLabel(item) }}</b>
              <time :datetime="item.occurredAt || item.recordedAt">
                {{ formatTime(item.occurredAt || item.recordedAt) }}
              </time>
            </div>
            <p v-if="item.detail">{{ item.detail }}</p>
            <details>
              <summary>来源详情</summary>
              <dl>
                <div>
                  <dt>来源</dt>
                  <dd>{{ sourceLabels[item.sourceType] || "其他可见来源" }}</dd>
                </div>
                <div>
                  <dt>来源版本</dt>
                  <dd>当前来源未提供版本</dd>
                </div>
                <div>
                  <dt>来源引用</dt>
                  <dd class="mono">
                    {{ item.sourceType }} / {{ item.sourceId }}
                  </dd>
                </div>
                <div v-if="item.title">
                  <dt>技术引用</dt>
                  <dd class="mono">{{ item.title }}</dd>
                </div>
                <div>
                  <dt>记录时间</dt>
                  <dd>{{ formatTime(item.recordedAt) }}</dd>
                </div>
                <div>
                  <dt>操作人</dt>
                  <dd class="mono">{{ item.actorId || "未提供" }}</dd>
                </div>
              </dl>
            </details>
          </li>
        </ol>
        <p v-else class="archive-empty">当前可见来源没有原任务记录。</p>
      </section>

      <section class="archive-section" aria-label="相关对象事实">
        <h3>相关对象事实</h3>
        <p class="archive-section__note">
          以下记录与当前对象相关，不代表原任务结果、责任交接或后续完成证据。
        </p>
        <ol v-if="relatedObjectItems.length">
          <li v-for="item in relatedObjectItems" :key="item.id">
            <div class="archive-record__headline">
              <b>{{ activityLabel(item) }}</b>
              <time :datetime="item.occurredAt || item.recordedAt">
                {{ formatTime(item.occurredAt || item.recordedAt) }}
              </time>
            </div>
            <p v-if="item.detail">{{ item.detail }}</p>
            <details>
              <summary>来源详情</summary>
              <dl>
                <div>
                  <dt>来源</dt>
                  <dd>{{ sourceLabels[item.sourceType] || "其他可见来源" }}</dd>
                </div>
                <div>
                  <dt>来源版本</dt>
                  <dd>当前来源未提供版本</dd>
                </div>
                <div>
                  <dt>来源引用</dt>
                  <dd class="mono">
                    {{ item.sourceType }} / {{ item.sourceId }}
                  </dd>
                </div>
                <div v-if="item.title">
                  <dt>技术引用</dt>
                  <dd class="mono">{{ item.title }}</dd>
                </div>
                <div>
                  <dt>任务引用</dt>
                  <dd class="mono">{{ item.taskId || "未提供" }}</dd>
                </div>
              </dl>
            </details>
          </li>
        </ol>
        <p v-else class="archive-empty">当前可见来源没有其他对象事实。</p>
      </section>

      <footer class="archive-footer">
        <span>
          截至
          {{ archive.asOf.value ? formatTime(archive.asOf.value) : "未知" }}
        </span>
        <div>
          <button
            type="button"
            title="刷新档案"
            aria-label="刷新档案"
            data-testid="archive-refresh"
            @click="archive.refresh"
          >
            <RefreshCw :size="15" aria-hidden="true" />
          </button>
          <button
            v-if="archive.hasMore.value"
            type="button"
            data-testid="archive-load-more"
            @click="archive.loadMore"
          >
            <ListPlus :size="15" aria-hidden="true" />更早记录
          </button>
        </div>
      </footer>
    </template>
  </article>
</template>

<style scoped>
.task-archive {
  min-width: 0;
  display: grid;
  align-content: start;
}

.archive-boundary,
.archive-outcome,
.archive-next-actions,
.archive-section,
.archive-state,
.archive-footer {
  min-width: 0;
  padding: var(--space-3);
  border-bottom: 1px solid var(--line);
}

.archive-boundary {
  display: grid;
  gap: var(--space-1);
  background: var(--surface-2);
}

.archive-boundary div,
.archive-outcome,
.archive-footer,
.archive-footer > div,
.archive-record__headline {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.archive-boundary div,
.archive-footer,
.archive-record__headline {
  justify-content: space-between;
}

.archive-boundary p,
.archive-boundary details,
.archive-outcome small,
.archive-outcome time,
.archive-section__note,
.archive-empty,
.archive-record__headline time,
.archive-section li > p,
.archive-next-actions span,
.archive-footer {
  margin: 0;
  color: var(--muted);
  font-size: var(--text-micro);
}

.archive-boundary details summary,
.archive-next-actions details summary,
.archive-section details summary {
  cursor: pointer;
}

.archive-outcome {
  flex-wrap: wrap;
  border-left: 3px solid var(--ok);
}

.archive-outcome > span,
.archive-outcome > strong {
  color: var(--ink);
  font-size: var(--text-label);
}

.archive-next-actions h3,
.archive-section h3 {
  margin: 0 0 var(--space-2);
  font-size: var(--text-label);
}

.archive-next-actions ul,
.archive-section ol {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.archive-next-actions li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.archive-next-actions li > div {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
}

.archive-next-actions a {
  flex: none;
  color: var(--brand);
  font-size: var(--text-micro);
}

.archive-section li {
  min-width: 0;
  padding-top: var(--space-2);
  border-top: 1px dashed var(--line);
}

.archive-section__note {
  margin-bottom: var(--space-2);
}

.archive-next-actions dl,
.archive-section dl {
  display: grid;
  gap: var(--space-1);
  margin: var(--space-2) 0 0;
}

.archive-next-actions dl > div,
.archive-section dl > div {
  display: grid;
  grid-template-columns: 4.5rem minmax(0, 1fr);
  gap: var(--space-2);
  font-size: var(--text-micro);
}

.archive-next-actions dt,
.archive-next-actions dd,
.archive-section dt,
.archive-section dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.archive-next-actions dt,
.archive-section dt {
  color: var(--muted);
}

.archive-state {
  color: var(--ink-soft);
  font-size: var(--text-label);
}

.archive-state--error {
  display: grid;
  gap: var(--space-2);
  border-left: 3px solid var(--risk);
  background: var(--risk-bg);
  color: var(--risk);
}

.archive-state--error p {
  margin: 0;
}

.archive-state button,
.archive-footer button {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0 var(--space-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
  font: inherit;
}

.archive-footer {
  position: sticky;
  bottom: 0;
  background: var(--surface);
}

.archive-footer button[aria-label="刷新档案"] {
  width: 32px;
  justify-content: center;
  padding: 0;
}
</style>
