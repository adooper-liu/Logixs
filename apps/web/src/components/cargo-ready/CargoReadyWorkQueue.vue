<script setup lang="ts">
import { ArrowRight, ClipboardCheck, ShieldAlert } from "@lucide/vue";
import type { NodeTaskDetail } from "../../api/nodeTasks";
import type { ExternalWorkItem } from "../../api/workItems";

defineProps<{
  containerId: string;
  nodeTasks: readonly NodeTaskDetail[];
  remediationItems: readonly ExternalWorkItem[];
}>();

const priorityLabels: Record<ExternalWorkItem["priority"], string> = {
  low: "低",
  medium: "中",
  high: "高",
  critical: "紧急",
};
</script>

<template>
  <div class="work-queue">
    <header class="queue-header">
      <span>
        <small>备货岗位</small>
        <h2>待处理工作</h2>
      </span>
      <b>{{ nodeTasks.length + remediationItems.length }} 项</b>
    </header>

    <section class="queue-section" aria-label="生命周期任务">
      <h3><ClipboardCheck :size="16" aria-hidden="true" />节点任务</h3>
      <p v-if="!nodeTasks.length" class="empty-state">当前没有备货节点任务。</p>
      <article v-for="task in nodeTasks" :key="task.id" class="queue-item">
        <span>
          <b>{{ task.taskDefinitionKey }}</b>
          <small>
            {{ task.readinessState === "ready" ? "条件已具备" : "等待条件" }}
            · {{ task.state }}
          </small>
        </span>
        <router-link
          :to="{
            path: '/tasks',
            query: { containerId, task: task.id },
          }"
        >
          {{ task.nextAction ? "处理" : "查看" }}
          <ArrowRight :size="14" aria-hidden="true" />
        </router-link>
      </article>
    </section>

    <section class="queue-section" aria-label="合规整改项">
      <h3><ShieldAlert :size="16" aria-hidden="true" />合规整改</h3>
      <p v-if="!remediationItems.length" class="empty-state">
        当前没有开放的合规整改项。
      </p>
      <article
        v-for="item in remediationItems"
        :key="item.id"
        class="queue-item queue-item--remediation"
      >
        <span>
          <b>{{ item.title }}</b>
          <small>{{ item.detail }}</small>
        </span>
        <em :class="`priority priority--${item.priority}`">
          {{ priorityLabels[item.priority] }}
        </em>
      </article>
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
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
}

.queue-header > span {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.queue-header small,
.queue-item small {
  color: var(--muted);
  font-size: 10px;
}

.queue-header h2 {
  margin: 0;
  font-size: 16px;
}

.queue-header > b {
  color: var(--brand-strong);
  font-size: 12px;
}

.queue-section + .queue-section {
  border-top: 1px solid var(--line-strong);
}

.queue-section h3 {
  min-height: 36px;
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  color: var(--ink-soft);
  font-size: 12px;
}

.queue-item {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
}

.queue-item:last-child {
  border-bottom: 0;
}

.queue-item > span {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.queue-item b,
.queue-item small {
  overflow-wrap: anywhere;
}

.queue-item b {
  font-size: 12px;
}

.queue-item a {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--brand-strong);
  font-size: 11px;
  font-weight: 700;
  text-decoration: none;
}

.queue-item--remediation {
  border-left: 3px solid var(--warn);
}

.priority {
  padding: 3px 6px;
  border-radius: var(--radius-s);
  background: var(--surface-2);
  color: var(--muted);
  font-size: 10px;
  font-style: normal;
  font-weight: 700;
}

.priority--high,
.priority--critical {
  background: var(--risk-bg);
  color: var(--risk);
}

.priority--medium {
  background: var(--warn-bg);
  color: var(--warn);
}

.empty-state {
  margin: 0;
  padding: 14px 12px;
  color: var(--muted);
  font-size: 12px;
}
</style>
