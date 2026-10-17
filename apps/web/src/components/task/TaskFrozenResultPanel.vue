<script setup lang="ts">
import { computed } from "vue";
import type { NodeTaskOutcome } from "../../api/nodeTasks";
import type { ContainerProjection, TaskItem } from "../../data/sample";
import TaskContextHeader from "./TaskContextHeader.vue";

const props = defineProps<{
  task: TaskItem;
  container: ContainerProjection;
  outcome: NodeTaskOutcome | null;
}>();

const stateLabels: Record<string, string> = {
  completed: "已完成",
  in_progress: "办理中",
  pending: "待办理",
  skipped: "不适用",
};

const outcomeState = computed(() => {
  const state = props.outcome?.nextState;
  return state ? (stateLabels[state] ?? state) : "尚无正式结果";
});

const evaluatedAtLabel = computed(() => {
  const value = props.outcome?.evaluatedAt;
  if (!value) return "结果形成时间未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
});
</script>

<template>
  <article class="frozen-result">
    <TaskContextHeader
      :task="task"
      :container="container"
      :show-completed-guidance="Boolean(outcome)"
    />

    <section class="frozen-result__body" aria-label="任务冻结结果">
      <p class="frozen-result__eyebrow">正式结果</p>
      <template v-if="outcome">
        <strong data-testid="frozen-outcome">{{ outcomeState }}</strong>
        <time :datetime="outcome.evaluatedAt">{{ evaluatedAtLabel }}</time>
        <p>
          这是该任务完成时形成的只读结果。当前对象的其他事实请在档案中核对。
        </p>
        <details class="frozen-result__details">
          <summary>技术引用</summary>
          <dl>
            <div>
              <dt>结果引用</dt>
              <dd class="mono">{{ outcome.id }}</dd>
            </div>
            <div>
              <dt>结果政策</dt>
              <dd class="mono">{{ outcome.resultPolicyMode }}</dd>
            </div>
            <div>
              <dt>事件引用</dt>
              <dd class="mono">{{ outcome.eventCode || "未形成事件" }}</dd>
            </div>
          </dl>
        </details>
      </template>
      <template v-else>
        <strong data-testid="frozen-outcome-missing">尚无正式结果</strong>
        <span>{{ evaluatedAtLabel }}</span>
        <p>
          任务状态为已完成，但当前读取未返回正式结果；不要据此推断事件或责任交接。
        </p>
      </template>
    </section>
  </article>
</template>

<style scoped>
.frozen-result {
  min-width: 0;
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3);
}

.frozen-result__body {
  min-width: 0;
  display: grid;
  gap: var(--space-2);
  padding: var(--space-4);
  border-left: 3px solid var(--ok);
  background: var(--surface-2);
}

.frozen-result__eyebrow,
.frozen-result__body p,
.frozen-result__body time,
.frozen-result__body span {
  margin: 0;
  color: var(--ink-soft);
  font-size: var(--text-label);
}

.frozen-result__eyebrow {
  color: var(--muted);
  font-size: var(--text-micro);
  font-weight: 700;
}

.frozen-result__body > strong {
  color: var(--ink);
  font-size: var(--text-title);
}

.frozen-result__details {
  margin-top: var(--space-2);
  color: var(--ink-soft);
  font-size: var(--text-micro);
}

.frozen-result__details summary {
  cursor: pointer;
}

.frozen-result__details dl {
  display: grid;
  gap: var(--space-2);
  margin: var(--space-2) 0 0;
}

.frozen-result__details dl > div {
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr);
  gap: var(--space-2);
}

.frozen-result__details dt,
.frozen-result__details dd {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
