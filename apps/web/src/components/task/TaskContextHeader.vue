<script setup lang="ts">
import { computed } from "vue";
import { ChevronRight, Container, ShieldAlert } from "@lucide/vue";
import type {
  ContainerProjection,
  SubmissionView,
  TaskItem,
} from "../../data/sample";
import { projectTaskLanguage } from "./taskLanguageContract";

const props = defineProps<{
  task: TaskItem;
  container: ContainerProjection;
  submission?: SubmissionView;
}>();

const language = computed(() =>
  projectTaskLanguage(props.task, props.submission),
);

const showExecutionQualifier = computed(
  () =>
    props.task.executionMode !== "human" ||
    props.task.status === "under_review",
);

const dueLabel = computed(() =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(props.task.dueAt)),
);
</script>

<template>
  <header class="task-context">
    <div class="title-block">
      <div class="title-line">
        <div class="labels">
          <span class="node">{{ task.nodeName }}</span>
          <span v-if="showExecutionQualifier" class="mode">{{
            task.executionModeLabel
          }}</span>
        </div>
      </div>
      <div class="task-title-row">
        <h2>{{ language.title }}</h2>
        <span
          class="task-state"
          :class="language.tone"
          :aria-label="`任务状态：${language.statusLabel}`"
        >
          <span>任务</span><b>{{ language.statusLabel }}</b>
        </span>
      </div>
      <div class="task-language">
        <p v-if="language.showTriggerReason">
          <span>原因</span>{{ language.triggerReason }}
        </p>
        <p class="guidance">
          <span>{{ language.guidanceLabel }}</span
          >{{ language.guidance }}
        </p>
        <p v-if="task.status !== 'completed'">
          <span>完成标准</span>{{ language.completionCriteria }}
        </p>
        <p v-if="task.status !== 'completed'" class="guardrail">
          <ShieldAlert :size="13" aria-hidden="true" />
          <span>安全边界</span>{{ language.guardrail }}
        </p>
      </div>
    </div>

    <div class="identity">
      <router-link
        class="container-link mono"
        :to="`/container/${task.containerRecordId}`"
        aria-label="查看一柜一档"
      >
        <Container :size="14" aria-hidden="true" />
        {{ task.containerNumber }}
        <ChevronRight :size="14" aria-hidden="true" />
      </router-link>
      <small>{{ task.location }}</small>
      <time :datetime="task.dueAt">截止 {{ dueLabel }}</time>
      <span
        class="container-state"
        :aria-label="`货柜状态：${container.currentStatus.label}`"
      >
        <span>货柜</span>
        <b :class="container.currentStatus.tone">{{
          container.currentStatus.label
        }}</b>
        <time v-if="container.currentStatus.changedAt">
          · {{ container.currentStatus.changedAt }}
        </time>
      </span>
    </div>
  </header>
</template>

<style scoped>
.task-context {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, auto);
  gap: 8px 20px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--surface);
}

.title-block {
  min-width: 0;
}

.title-line,
.labels {
  display: flex;
  align-items: center;
  gap: 6px;
}

.title-line {
  justify-content: space-between;
}

.labels {
  flex-wrap: wrap;
}

.node,
.mode {
  padding: 2px 7px;
  border-radius: var(--radius-s);
  font-size: 10px;
  font-weight: 700;
}

.node {
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.mode {
  background: var(--surface-2);
  color: var(--ink-soft);
}

.task-title-row {
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
}

.task-title-row h2 {
  margin: 5px 0 2px;
  font-size: 17px;
}

.task-state {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border: 1px solid currentColor;
  border-radius: var(--radius-s);
  background: var(--surface);
  font-size: 10px;
}

.task-state > span {
  color: var(--muted);
}

.task-state.ok,
.container-state .ok {
  color: var(--ok);
}

.task-state.warn,
.container-state .warn {
  color: var(--warn);
}

.task-state.risk,
.container-state .risk {
  color: var(--risk);
}

.task-state.info,
.container-state .info {
  color: var(--info);
}

.task-state.muted,
.container-state .muted {
  color: var(--muted);
}

.task-language {
  max-width: 760px;
  display: grid;
  gap: 2px;
  margin-top: 2px;
}

.task-language p {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 7px;
  margin: 0;
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.5;
}

.task-language p > span {
  min-width: 48px;
  flex: none;
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
}

.task-language .guidance {
  color: var(--ink);
  font-weight: 600;
}

.task-language .guidance > span {
  color: var(--brand);
}

.task-language .guardrail {
  align-items: center;
  color: var(--warn);
}

.task-language .guardrail svg {
  flex: none;
}

.task-language .guardrail > span {
  min-width: 41px;
  color: var(--warn);
}

.identity {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.container-link,
.container-state {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.container-link {
  color: var(--ink);
  font-weight: 700;
  text-decoration: none;
}

.container-link:hover {
  color: var(--brand);
}

.identity small,
.identity > time,
.container-state {
  color: var(--muted);
  font-size: 10px;
}

.container-state {
  margin-top: 3px;
}

.container-state b {
  font-size: 11px;
}

.container-state time {
  color: var(--muted);
}

@media (max-width: 720px) {
  .task-context {
    grid-template-columns: 1fr;
  }

  .identity {
    align-items: flex-start;
  }

  .title-line {
    align-items: flex-start;
    flex-direction: column;
  }

  .task-language p {
    align-items: flex-start;
  }
}
</style>
