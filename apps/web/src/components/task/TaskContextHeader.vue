<script setup lang="ts">
import { computed } from "vue";
import { ChevronRight, Container, ShieldAlert } from "@lucide/vue";
import type {
  ContainerProjection,
  SubmissionView,
  TaskItem,
} from "../../data/sample";
import { projectTaskLanguage } from "./taskLanguageContract";
import { uiCopy } from "../../data/uiCopyCatalog";

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

const dueLabel = computed(() => {
  if (!props.task.dueAt) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(props.task.dueAt));
});
const containerHref = computed(
  () => `/container/${props.task.containerRecordId}`,
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
          <span>{{ uiCopy.chrome.guardrail }}</span
          >{{ language.guardrail }}
        </p>
      </div>
    </div>

    <div class="identity">
      <router-link
        class="container-link mono"
        :to="containerHref"
        aria-label="查看货柜档案"
      >
        <Container :size="14" aria-hidden="true" />
        {{ task.containerNumber }}
        <ChevronRight :size="14" aria-hidden="true" />
      </router-link>
      <small>{{ task.location }}</small>
      <time v-if="task.dueAt" :datetime="task.dueAt"
        >{{ uiCopy.chrome.dueLabel }} {{ dueLabel }}</time
      >
      <span v-else>{{ uiCopy.chrome.dueNone }}</span>
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
  gap: var(--space-2) var(--space-5);
  padding: var(--space-3);
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
  gap: var(--space-2);
}

.title-line {
  justify-content: space-between;
}

.labels {
  flex-wrap: wrap;
}

.node,
.mode {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-s);
  font-size: var(--text-micro);
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
  gap: var(--space-2);
}

.task-title-row h2 {
  margin: var(--space-1) 0 var(--space-1);
  font-size: var(--text-page);
}

.task-state {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border: 1px solid currentColor;
  border-radius: var(--radius-s);
  background: var(--surface);
  font-size: var(--text-micro);
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
  gap: var(--space-1);
  margin-top: var(--space-1);
}

.task-language p {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  margin: 0;
  color: var(--ink-soft);
  font-size: var(--text-label);
  line-height: 1.5;
}

.task-language p > span {
  min-width: 48px;
  flex: none;
  color: var(--muted);
  font-size: var(--text-micro);
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
  gap: var(--space-1);
}

.container-link,
.container-state {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
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
  font-size: var(--text-micro);
}

.container-state {
  margin-top: var(--space-1);
}

.container-state b {
  font-size: var(--text-micro);
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
