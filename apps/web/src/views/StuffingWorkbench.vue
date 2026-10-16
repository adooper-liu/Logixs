<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import StuffingActionPanel from "../components/stuffing/StuffingActionPanel.vue";
import StuffingSnapshotPanel from "../components/stuffing/StuffingSnapshotPanel.vue";
import StuffingWorkQueue from "../components/stuffing/StuffingWorkQueue.vue";
import RoleWorkbenchFrame from "../components/workbench/RoleWorkbenchFrame.vue";
import WorkbenchSessionSwitcher from "../components/workbench/WorkbenchSessionSwitcher.vue";
import {
  useStuffingCommands,
  type StuffingSnapshotDraft,
} from "../composables/useStuffingCommands";
import { useStuffingTaskOperation } from "../composables/useStuffingTaskOperation";
import { useStuffingWorkbench } from "../composables/useStuffingWorkbench";
import type {
  StuffingQueueFilter,
  StuffingQueueItem,
} from "../data/stuffingWorkbench";
import { getProductInitiative } from "../api/marketSignals";
import { getContainerStuffingSnapshot } from "../api/containerStuffing";
import { useWorkbenchSessionSwitcher } from "../work-session/useWorkbenchSessionSwitcher";
import type { WorkSessionSwitchAdapter } from "../work-session/workSessionAdapter";

const route = useRoute();
const router = useRouter();
const containerId = computed(() =>
  String(route.query.containerId ?? "").trim(),
);
const taskId = computed(() => String(route.query.taskId ?? "").trim());
const queueFilter = ref<StuffingQueueFilter>("executable");
const {
  selectedContainer,
  cargo,
  nodes,
  stuffingNode,
  queueItems,
  selectedTask,
  snapshot,
  dateFacts,
  stuffingActualFact,
  warnings,
  queueLoading,
  selectionLoading,
  containerListError,
  queueError,
  selectionError,
  loadContainerList,
  reloadSelection,
} = useStuffingWorkbench(containerId, taskId);
const historicalMode = computed(
  () =>
    Boolean(selectedContainer.value && snapshot.value) && !selectedTask.value,
);
watch(queueItems, (items) => {
  if (
    queueFilter.value === "executable" &&
    !items.some((item) => item.kind === "task" && item.isExecutable) &&
    items.some((item) => item.kind === "historical_snapshot")
  )
    queueFilter.value = "history";
});
const commands = useStuffingCommands(reloadWorkbench);
const snapshotDirty = shallowRef(false);
const actionPanel = shallowRef<InstanceType<typeof StuffingActionPanel> | null>(
  null,
);
const taskOperation = useStuffingTaskOperation(
  selectedTask,
  snapshot,
  reloadWorkbench,
);
const sessionAdapter: WorkSessionSwitchAdapter & { discardLocal(): void } = {
  async settleBeforeLeave(intent) {
    if (!snapshotDirty.value)
      return { kind: "ready", sourceStatus: "resumable" };
    return {
      kind: "needs-choice",
      choices:
        intent === "new-tab"
          ? ["new-tab", "stay"]
          : ["discard", "new-tab", "stay"],
    };
  },
  async validateTarget(session) {
    try {
      const latestVersion =
        session.routeContext.kind === "product_selection.v1"
          ? ((await getProductInitiative(session.routeContext.handoffId))
              .initiative?.version ?? 0)
          : ((
              await getContainerStuffingSnapshot(
                session.routeContext.containerId,
              )
            )?.version ?? 0);
      if (session.domainVersionSeen !== latestVersion) {
        return {
          kind: "conflict",
          seenVersion: session.domainVersionSeen ?? null,
          latestVersion,
          message: `目标装箱版本已从 ${session.domainVersionSeen ?? "未知"} 更新为 ${latestVersion}；请先比较最新装箱事实。`,
        };
      }
      return { kind: "ready", domainVersionSeen: latestVersion };
    } catch (caught) {
      return {
        kind: "failed",
        message: caught instanceof Error ? caught.message : "目标现场无法读取",
      };
    }
  },
  async restorePointer() {},
  discardLocal() {
    actionPanel.value?.discardSnapshotLocal();
    snapshotDirty.value = false;
  },
};
const workSessions = useWorkbenchSessionSwitcher({
  router,
  currentContext: computed(() =>
    containerId.value && taskId.value
      ? ({
          kind: "stuffing.v1" as const,
          containerId: containerId.value,
          taskId: taskId.value,
        } as const)
      : null,
  ),
  currentSubjectRef: computed(() =>
    containerId.value
      ? ({ kind: "container" as const, id: containerId.value } as const)
      : null,
  ),
  currentTaskRef: computed(() =>
    taskId.value
      ? ({ kind: "node_task" as const, id: taskId.value } as const)
      : null,
  ),
  displaySummary: computed(
    () => `装箱 · ${selectedContainer.value?.containerNumber ?? "未选择货柜"}`,
  ),
  domainVersionSeen: computed(() => snapshot.value?.version ?? 0),
  activeItemKey: computed(() => "stuffing-snapshot"),
  contextMode: computed(() => "edit_snapshot"),
  adapter: sessionAdapter,
});

onMounted(() => {
  void loadContainerList();
});

function selectTask(item: StuffingQueueItem): void {
  if (!item.container?.id) return;
  void router.replace({
    path: "/workspaces/stuffing",
    query:
      item.kind === "task" && item.task
        ? { containerId: item.container.id, taskId: item.task.id }
        : { containerId: item.container.id },
  });
}

function saveSnapshot(draft: StuffingSnapshotDraft): void {
  if (!containerId.value) return;
  void commands.saveSnapshot(containerId.value, draft);
}

function submitActual(localDateTime: string): void {
  if (!containerId.value || !snapshot.value) return;
  void commands.submitActualTime({
    containerId: containerId.value,
    localDateTime,
    expectedVersion: dateFacts.value?.projectionVersion ?? 0,
    snapshot: snapshot.value,
  });
}

async function reloadWorkbench(): Promise<void> {
  await Promise.all([reloadSelection(), loadContainerList()]);
}
</script>

<template>
  <RoleWorkbenchFrame
    stage-code="stuffing"
    workspace-label="出运装箱"
    node-scope-label="装箱"
    :selected-container="selectedContainer"
    :nodes="nodes"
    :selection-loading="selectionLoading"
    :container-list-error="containerListError"
    :selection-error="selectionError"
    :warnings="warnings"
  >
    <template #switcher>
      <WorkbenchSessionSwitcher
        :sessions="workSessions.sessions.value"
        :on-select="workSessions.select"
        :on-resolve-choice="workSessions.resolveChoice"
      />
    </template>
    <template #queue>
      <StuffingWorkQueue
        :items="queueItems"
        :selected-task-id="selectedTask?.id ?? taskId"
        :selected-container-id="selectedContainer?.id ?? containerId"
        :filter="queueFilter"
        :loading="queueLoading"
        :error="queueError"
        @select="selectTask"
        @change-filter="queueFilter = $event"
      />
    </template>
    <template #primary>
      <StuffingSnapshotPanel
        v-if="selectedContainer"
        :cargo="cargo"
        :snapshot="snapshot"
        :node="stuffingNode"
        :historical-mode="historicalMode"
      />
    </template>
    <template #secondary>
      <StuffingActionPanel
        v-if="selectedContainer && !historicalMode"
        ref="actionPanel"
        :container-number="selectedContainer.containerNumber"
        :cargo="cargo"
        :snapshot="snapshot"
        :actual-fact="stuffingActualFact"
        :task="selectedTask"
        :submission="taskOperation.submission.value"
        :task-submitting="taskOperation.submitting.value"
        :snapshot-saving="commands.snapshotSaving.value"
        :snapshot-error="commands.snapshotError.value"
        :snapshot-message="commands.snapshotMessage.value"
        :date-submitting="commands.dateSubmitting.value"
        :date-error="commands.dateError.value"
        :date-result="commands.dateResult.value"
        @save-snapshot="saveSnapshot"
        @submit-actual="submitActual"
        @execute-task="taskOperation.execute()"
        @retry-task="taskOperation.retry()"
        @snapshot-dirty-change="snapshotDirty = $event"
      />
      <section
        v-else-if="selectedContainer && historicalMode"
        class="historical-context"
        aria-label="历史装箱操作上下文"
      >
        <small>当前操作</small>
        <h2>历史事实只读</h2>
        <p>此快照只用于追溯柜货关系，不代表当前存在可执行装箱任务。</p>
        <dl>
          <div>
            <dt>任务</dt>
            <dd>未创建装箱工单</dd>
          </div>
          <div>
            <dt>生命周期</dt>
            <dd>未建立 stuffed 结论</dd>
          </div>
          <div>
            <dt>VGM</dt>
            <dd>未记录、未接受</dd>
          </div>
        </dl>
      </section>
    </template>
  </RoleWorkbenchFrame>
</template>

<style scoped>
.historical-context {
  min-width: 0;
  padding: var(--space-4);
}
.historical-context small,
.historical-context dt {
  color: var(--muted);
  font-size: var(--text-micro);
}
.historical-context h2,
.historical-context p,
.historical-context dl,
.historical-context dd {
  margin: 0;
}
.historical-context h2 {
  margin-top: var(--space-1);
  font-size: var(--text-title);
}
.historical-context p {
  margin-top: var(--space-3);
  color: var(--ink-soft);
  font-size: var(--text-label);
}
.historical-context dl {
  display: grid;
  gap: var(--space-3);
  margin-top: var(--space-4);
}
.historical-context dl div {
  display: grid;
  gap: var(--space-1);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--line);
}
.historical-context dd {
  font-size: var(--text-label);
  font-weight: 700;
}
</style>
