<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import TaskExecutionPanel from "../components/task/TaskExecutionPanel.vue";
import TaskQueue from "../components/task/TaskQueue.vue";
import PageHeader from "../components/ui/PageHeader.vue";
import { useTaskWorkspace } from "../composables/useTaskWorkspace";

const {
  loading,
  loadingMore,
  moreError,
  hasMore,
  error,
  tasks,
  activeTaskId,
  activeTask,
  activeContainer,
  activeSubmission,
  canSubmit,
  isSubmitting,
  selectTask,
  claimTask,
  acknowledgeInput,
  verifyEvidence,
  executeAction,
  reportException,
  retrySubmission,
  loadMore,
} = useTaskWorkspace();

const route = useRoute();
const router = useRouter();
const scopedContainer = computed(() =>
  String(route.query.containerId ?? "").trim(),
);
const mobilePane = shallowRef<"queue" | "detail">("queue");
const actionableStatuses = new Set([
  "available",
  "in_progress",
  "blocked",
  "under_review",
]);
const humanTaskCount = computed(
  () =>
    tasks.value.filter(
      (task) =>
        task.queueKind === "human" && actionableStatuses.has(task.status),
    ).length,
);
const monitorCount = computed(
  () => tasks.value.filter((task) => task.queueKind === "monitor").length,
);

watch(
  [() => route.query.task, tasks],
  ([taskId]) => {
    if (
      typeof taskId === "string" &&
      tasks.value.some((task) => task.taskId === taskId)
    ) {
      selectTask(taskId);
      mobilePane.value = "detail";
    } else if (tasks.value.length && !taskId) {
      mobilePane.value = "queue";
    } else if (typeof taskId !== "string") {
      mobilePane.value = "queue";
    }
  },
  { immediate: true },
);

const handleSelect = (taskId: string) => {
  selectTask(taskId);
  mobilePane.value = "detail";
  void router.replace({ query: { ...route.query, task: taskId } });
};
</script>

<template>
  <div class="task-workbench page-frame">
    <PageHeader
      title="我的任务"
      :summary="scopedContainer ? '只看这一柜。' : undefined"
    >
      <template #actions>
        <p class="workload">
          <b class="num">{{ humanTaskCount }}</b> 待处理
          <span v-if="monitorCount"> · {{ monitorCount }} 自动监控</span>
        </p>
      </template>
    </PageHeader>

    <div class="mobile-pane-switch" aria-label="任务台视图">
      <button
        type="button"
        :class="{ active: mobilePane === 'queue' }"
        @click="mobilePane = 'queue'"
      >
        任务列表 <span class="num">{{ humanTaskCount }}</span>
      </button>
      <button
        type="button"
        :class="{ active: mobilePane === 'detail' }"
        @click="mobilePane = 'detail'"
      >
        当前任务
      </button>
    </div>

    <p v-if="loading" class="workspace-hint">加载中…</p>
    <p v-else-if="error" class="workspace-hint workspace-hint--error">
      {{ error }}
    </p>
    <p v-else-if="!tasks.length" class="workspace-hint">这一范围还没有待办。</p>

    <div v-else class="layout">
      <div
        class="pane queue-pane"
        :class="{ 'pane--active': mobilePane === 'queue' }"
      >
        <TaskQueue
          :tasks="tasks"
          :active-task-id="activeTaskId"
          :selection-locked="isSubmitting"
          @select="handleSelect"
        />
        <p v-if="moreError" class="workspace-hint workspace-hint--error">
          {{ moreError }}
        </p>
        <button
          v-if="hasMore"
          type="button"
          class="load-more"
          :disabled="loadingMore"
          @click="loadMore"
        >
          {{ loadingMore ? "加载中…" : "再看后面" }}
        </button>
      </div>
      <div
        class="pane detail-pane"
        :class="{ 'pane--active': mobilePane === 'detail' }"
      >
        <TaskExecutionPanel
          v-if="activeTask && activeContainer"
          :task="activeTask"
          :container="activeContainer"
          :submission="activeSubmission"
          :can-submit="canSubmit"
          :is-submitting="isSubmitting"
          @claim-task="claimTask"
          @acknowledge-input="acknowledgeInput"
          @verify-evidence="verifyEvidence"
          @execute-action="executeAction"
          @report-exception="reportException"
          @retry-submission="retrySubmission"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-workbench {
  min-height: 100%;
}

.workspace-hint {
  margin: 12px 0;
  color: var(--muted);
  font-size: 13px;
}

.workspace-hint--error {
  color: var(--risk);
}

.load-more {
  margin-top: 8px;
  min-height: var(--touch-target, 40px);
  width: 100%;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
}

.load-more:disabled {
  color: var(--muted);
}

.workload {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}

.workload b {
  color: var(--ink);
  font-size: 16px;
}

.layout {
  display: grid;
  grid-template-columns: minmax(312px, 336px) minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.pane {
  min-width: 0;
}

.mobile-pane-switch {
  display: none;
}

@media (min-width: 768px) {
  .pane {
    display: contents;
  }
}

@media (max-width: 900px) {
  .layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767px) {
  .mobile-pane-switch {
    min-height: var(--touch-target);
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-control);
    overflow: hidden;
  }

  .mobile-pane-switch button {
    min-height: var(--touch-target);
    border: 0;
    border-right: 1px solid var(--line);
    background: var(--surface);
    color: var(--ink-soft);
  }

  .mobile-pane-switch button:last-child {
    border-right: 0;
  }

  .mobile-pane-switch button.active {
    background: var(--brand-soft);
    color: var(--brand-strong);
    font-weight: 700;
  }

  .pane {
    display: none;
  }

  .pane--active {
    display: block;
  }
}
</style>
