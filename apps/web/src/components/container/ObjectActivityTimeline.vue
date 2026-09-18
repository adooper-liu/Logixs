<script setup lang="ts">
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  ClipboardList,
  Clock3,
  UserRound,
} from "@lucide/vue";
import type {
  ObjectActivityItem,
  ObjectNextAction,
} from "../../api/objectActivities";

defineProps<{
  items: ObjectActivityItem[];
  nextActions: ObjectNextAction[];
}>();

const emit = defineEmits<{
  openTarget: [path: string];
}>();

const activityLabels: Record<string, string> = {
  lifecycle_event_recorded: "生命周期事实",
  problem_notification_posted: "问题通知",
  task_created: "任务已生成",
  work_order_claimed: "工单已领取",
  work_order_completed: "工单已完成",
};

const actionLabels: Record<string, string> = {
  "work_execution.claim_work_order": "领取工单",
  "work_execution.complete_work_order": "完成工单",
};

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
  return activityLabels[item.activityCode] ?? item.activityCode;
}

function actionLabel(action: ObjectNextAction): string {
  return actionLabels[action.actionCode] ?? action.actionCode;
}

function actionOwner(action: ObjectNextAction): string {
  if (action.assigneeId) return action.assigneeId;
  if (action.assignmentState === "automatic") return "系统";
  return "任务池";
}
</script>

<template>
  <div class="activity-content">
    <section
      v-if="nextActions.length"
      class="next-actions"
      aria-label="下一动作"
    >
      <header>
        <ClipboardList :size="16" aria-hidden="true" />
        <b>下一动作</b>
        <span>{{ nextActions.length }}</span>
      </header>
      <ul>
        <li v-for="action in nextActions" :key="action.workOrderId">
          <div class="action-copy">
            <b>{{ actionLabel(action) }}</b>
            <span>{{ action.workOrderDefinitionKey }}</span>
          </div>
          <span class="action-meta">
            <UserRound :size="13" aria-hidden="true" />
            {{ actionOwner(action) }}
          </span>
          <span class="action-meta">
            <Clock3 :size="13" aria-hidden="true" />
            {{ action.dueAt ? formatTime(action.dueAt) : "未设截止" }}
          </span>
          <button
            type="button"
            class="icon-action"
            title="打开任务"
            aria-label="打开任务"
            @click="emit('openTarget', action.targetPath)"
          >
            <ArrowRight :size="16" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </section>

    <ol v-if="items.length" class="activity-list" aria-label="对象活动">
      <li v-for="item in items" :key="item.id">
        <span class="activity-marker" :class="item.sourceType">
          <Bell
            v-if="item.sourceType === 'ops_notification'"
            :size="13"
            aria-hidden="true"
          />
          <CheckCircle2 v-else :size="13" aria-hidden="true" />
        </span>
        <div class="activity-copy">
          <div class="activity-title">
            <b>{{ activityLabel(item) }}</b>
            <span v-if="item.severity" class="severity">{{
              item.severity
            }}</span>
          </div>
          <p>{{ item.title || item.sourceId }}</p>
          <small v-if="item.detail">{{ item.detail }}</small>
        </div>
        <time :datetime="item.occurredAt || item.recordedAt">
          {{ formatTime(item.occurredAt || item.recordedAt) }}
        </time>
        <button
          v-if="item.targetPath"
          type="button"
          class="icon-action"
          title="打开关联对象"
          aria-label="打开关联对象"
          @click="emit('openTarget', item.targetPath)"
        >
          <ArrowRight :size="16" aria-hidden="true" />
        </button>
      </li>
    </ol>
    <p v-else class="empty">暂无对象活动</p>
  </div>
</template>

<style scoped>
.activity-content {
  min-width: 0;
}

.next-actions {
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
}

.next-actions header,
.next-actions li,
.activity-list li,
.action-meta,
.activity-title {
  display: flex;
  align-items: center;
}

.next-actions header {
  min-height: 38px;
  gap: 7px;
  padding: 6px 12px;
  color: var(--ink-soft);
}

.next-actions header svg {
  color: var(--brand);
}

.next-actions header span {
  color: var(--muted);
  font-size: 10px;
}

.next-actions ul,
.activity-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.next-actions li {
  min-width: 0;
  display: grid;
  grid-template-columns:
    minmax(150px, 1fr) minmax(90px, auto) minmax(110px, auto)
    30px;
  gap: 12px;
  min-height: 48px;
  padding: 7px 10px 7px 12px;
  border-top: 1px solid var(--line);
}

.action-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.action-copy span,
.action-meta,
.activity-copy small,
.activity-list time {
  color: var(--muted);
  font-size: 10px;
}

.action-copy span,
.activity-copy p,
.activity-copy small {
  overflow-wrap: anywhere;
}

.action-meta {
  gap: 4px;
}

.activity-list li {
  min-width: 0;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 112px 30px;
  gap: 10px;
  padding: 10px;
  border-bottom: 1px solid var(--line);
}

.activity-list li:last-child {
  border-bottom: 0;
}

.activity-marker {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  color: var(--brand);
}

.activity-marker.ops_notification {
  color: var(--warn);
}

.activity-copy {
  min-width: 0;
}

.activity-title {
  gap: 7px;
}

.activity-copy p {
  margin: 2px 0 0;
  color: var(--ink-soft);
  font-size: 11px;
}

.activity-copy small {
  display: block;
  margin-top: 3px;
}

.severity {
  color: var(--risk);
  font-size: 9px;
  font-weight: 700;
}

.icon-action {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--brand);
  cursor: pointer;
}

.icon-action:hover {
  background: var(--surface-2);
}

.empty {
  margin: 0;
  padding: 16px 12px;
  color: var(--muted);
  font-size: 11px;
}

@media (max-width: 720px) {
  .next-actions li {
    grid-template-columns: minmax(0, 1fr) 30px;
    gap: 4px 8px;
  }

  .action-meta {
    grid-column: 1;
  }

  .next-actions .icon-action {
    grid-column: 2;
    grid-row: 1 / 4;
  }

  .activity-list li {
    grid-template-columns: 28px minmax(0, 1fr) 30px;
  }

  .activity-list time {
    grid-column: 2;
  }

  .activity-list .icon-action {
    grid-column: 3;
    grid-row: 1 / 3;
  }
}
</style>
