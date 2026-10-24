<script setup lang="ts">
import type { TaskActionClaimWorkOrderResultV1 } from "@logix/contracts";
import { computed, nextTick, onMounted, ref, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { isEvidenceUuid } from "../api/evidence";
import StuffingActionPanel from "../components/stuffing/StuffingActionPanel.vue";
import StuffingSnapshotPanel from "../components/stuffing/StuffingSnapshotPanel.vue";
import StuffingWorkQueue from "../components/stuffing/StuffingWorkQueue.vue";
import TaskArchivePanel from "../components/task/TaskArchivePanel.vue";
import TaskContextPanel from "../components/task/TaskContextPanel.vue";
import type { TaskContextPanelMode } from "../components/task/TaskContextPanel.vue";
import RoleWorkbenchFrame from "../components/workbench/RoleWorkbenchFrame.vue";
import WorkbenchSessionSwitcher from "../components/workbench/WorkbenchSessionSwitcher.vue";
import {
  useStuffingCommands,
  type StuffingSnapshotDraft,
} from "../composables/useStuffingCommands";
import { useStuffingTaskOperation } from "../composables/useStuffingTaskOperation";
import { useStuffingWorkbench } from "../composables/useStuffingWorkbench";
import {
  useTaskAiAssistance,
  type TaskAiAssistanceContext,
  type TaskAiAssistancePanelModel,
  type TaskAiAssistanceRetryTarget,
} from "../composables/useTaskAiAssistance";
import {
  useTaskCollaboration,
  type TaskCollaborationContext,
  type TaskCollaborationRetryTarget,
} from "../composables/useTaskCollaboration";
import { CLAIM_WORK_ORDER_ACTION } from "../data/claimReceiptContract";
import type {
  StuffingQueueFilter,
  StuffingQueueItem,
} from "../data/stuffingWorkbench";
import type { WorkbenchMobileScreen } from "../components/workbench/workbenchLayout.types";
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
    Boolean(selectedContainer.value && snapshot.value) &&
    !taskId.value &&
    !selectedTask.value,
);
const exactWorkOrder = computed(() => {
  const selected = selectedContainer.value;
  const task = selectedTask.value;
  if (
    !selected ||
    !task ||
    task.containerId !== selected.id ||
    task.nodeCode !== "container_stuffing"
  ) {
    return null;
  }
  if (task.nextAction) {
    return (
      task.workOrders.find(
        (workOrder) => workOrder.id === task.nextAction?.workOrderId,
      ) ?? null
    );
  }
  return task.workOrders.length === 1 ? (task.workOrders[0] ?? null) : null;
});
const exactTask = computed(() =>
  exactWorkOrder.value ? selectedTask.value : null,
);
const mobileScreen = shallowRef<WorkbenchMobileScreen>("queue");
const contextMode = shallowRef<TaskContextPanelMode>("work");
let contextModeIntentVersion = 0;
const contextModeLabels: Record<TaskContextPanelMode, string> = {
  work: "办理",
  archive: "档案",
  collaboration: "协作",
  ai: "AI 辅助",
};
const taskContextKey = computed(() =>
  selectedContainer.value && exactTask.value && exactWorkOrder.value
    ? `container:${selectedContainer.value.id}|node_task:${exactTask.value.id}|work_order:${exactWorkOrder.value.id}`
    : null,
);
const taskSubjectRef = computed(() =>
  selectedContainer.value
    ? { kind: "container" as const, id: selectedContainer.value.id }
    : null,
);
const taskWorkRef = computed(() =>
  exactTask.value
    ? { kind: "node_task" as const, id: exactTask.value.id }
    : null,
);
const collaborationContext = computed<TaskCollaborationContext | null>(() =>
  taskContextKey.value &&
  exactTask.value &&
  taskSubjectRef.value &&
  taskWorkRef.value
    ? {
        contextKey: taskContextKey.value,
        taskId: exactTask.value.id,
        subjectRef: taskSubjectRef.value,
        workRef: taskWorkRef.value,
      }
    : null,
);
const collaboration = useTaskCollaboration(collaborationContext);
const availableAiContext = computed<TaskAiAssistanceContext | null>(() =>
  collaborationContext.value &&
  exactTask.value?.nextAction?.actionCode === CLAIM_WORK_ORDER_ACTION &&
  isEvidenceUuid(collaborationContext.value.subjectRef.id) &&
  isEvidenceUuid(collaborationContext.value.workRef.id)
    ? collaborationContext.value
    : null,
);
const aiRefreshInFlight = shallowRef(false);
const routeSelectionKey = computed(
  () => `${containerId.value}|${taskId.value}`,
);
let aiRefreshIdentity: {
  contextKey: string;
  routeSelectionKey: string;
} | null = null;
const aiActivatedContextKey = shallowRef<string | null>(null);
const aiContext = computed<TaskAiAssistanceContext | null>(() =>
  availableAiContext.value?.contextKey === aiActivatedContextKey.value
    ? availableAiContext.value
    : null,
);
const aiAssistance = useTaskAiAssistance(aiContext, {
  refreshTask: refreshTaskForAi,
});
const aiPanelModel = computed<TaskAiAssistancePanelModel | null>(() => {
  const task = exactTask.value;
  const selected = selectedContainer.value;
  const workOrder = exactWorkOrder.value;
  if (!availableAiContext.value || !task || !selected || !workOrder)
    return null;
  return {
    ...aiAssistance,
    facts: {
      objectLabel:
        selected.containerNumber ?? selected.orderNumber ?? "货柜待选择",
      taskLabel: stuffingNode.value?.name ?? "装箱任务",
      actionLabel: "领取",
      responsibilityLabel:
        workOrder.assignmentState === "automatic"
          ? "系统"
          : workOrder.assigneeId
            ? "已分配人员"
            : "待领取",
      dueLabel: workOrder.dueAt ? formatDueAt(workOrder.dueAt) : "未设截止",
    },
  };
});
const contextModes = computed<readonly TaskContextPanelMode[]>(() => {
  if (!collaborationContext.value) return ["work"];
  return availableAiContext.value
    ? ["work", "archive", "collaboration", "ai"]
    : ["work", "archive", "collaboration"];
});
const contextLabel = computed(() =>
  contextMode.value === "work"
    ? "装箱办理"
    : `任务上下文 · ${contextModeLabels[contextMode.value]}`,
);
const contextSummary = computed(() =>
  contextMode.value === "archive"
    ? "核对记录"
    : contextMode.value === "collaboration"
      ? "共同处理"
      : contextMode.value === "ai"
        ? "核对建议"
        : collaborationContext.value
          ? "继续办理"
          : "专业事实办理",
);
const currentContainerLabel = computed(
  () =>
    selectedContainer.value?.containerNumber ??
    selectedContainer.value?.orderNumber ??
    "货柜待选择",
);
const currentTaskLabel = computed(() =>
  exactTask.value ? "装箱任务" : "装箱任务待选择",
);
const queueTaskCount = computed(
  () => queueItems.value.filter((item) => item.kind === "task").length,
);
const queueRailAccessibleLabel = computed(
  () =>
    `当前货柜 ${currentContainerLabel.value}，${queueTaskCount.value} 项待办`,
);
const currentWorkOrderLabel = computed(() => {
  const workOrder = exactWorkOrder.value;
  if (!workOrder) return "装箱工单待确认";
  if (exactTask.value?.nextAction?.actionCode === CLAIM_WORK_ORDER_ACTION)
    return "待领取";
  if (
    exactTask.value?.nextAction?.actionCode ===
    "work_execution.complete_work_order"
  ) {
    return "待完成";
  }
  if (exactTask.value?.nextAction) return "等待服务端动作";
  return workOrder.state === "completed" ? "已完成" : "当前无允许动作";
});
interface FormalClaimReceipt {
  contextKey: string;
  workOrderId: string;
  applied: boolean;
  taskState: TaskActionClaimWorkOrderResultV1["taskState"];
  commitState: TaskActionClaimWorkOrderResultV1["commitState"];
}
const formalClaimReceipt = shallowRef<Readonly<FormalClaimReceipt> | null>(
  null,
);
const visibleClaimReceipt = computed(() =>
  formalClaimReceipt.value?.contextKey === taskContextKey.value
    ? formalClaimReceipt.value
    : null,
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
const formContainer = shallowRef(selectedContainer.value);
const formCargo = shallowRef(cargo.value);
const formSnapshot = shallowRef(snapshot.value);
const formActualFact = shallowRef(stuffingActualFact.value);
let pendingPointerRestore: {
  routeSelectionKey: string;
  taskId: string;
  mode: Exclude<TaskContextPanelMode, "work">;
} | null = null;
const taskOperation = useStuffingTaskOperation(
  exactTask,
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
  async restorePointer(session) {
    const pointer = decodeStuffingPointer(session.contextMode);
    const routeContext = session.routeContext;
    pendingPointerRestore = null;
    const sessionRouteSelectionKey =
      routeContext.kind === "stuffing.v1"
        ? `${routeContext.containerId}|${routeContext.taskId}`
        : null;
    if (
      routeContext.kind !== "stuffing.v1" ||
      !sessionRouteSelectionKey ||
      routeSelectionKey.value !== sessionRouteSelectionKey
    ) {
      return;
    }
    mobileScreen.value = pointer.screen;
    await nextTick();
    contextMode.value = "work";
    if (pointer.restorable && pointer.mode !== "work") {
      pendingPointerRestore = {
        routeSelectionKey: routeSelectionKey.value,
        taskId: routeContext.taskId,
        mode: pointer.mode,
      };
      applyPendingPointerRestore();
    }
    await nextTick();
  },
  discardLocal() {
    actionPanel.value?.discardSnapshotLocal();
    snapshotDirty.value = false;
  },
};
const workSessions = useWorkbenchSessionSwitcher({
  router,
  currentContext: computed(() =>
    selectedContainer.value && exactTask.value
      ? ({
          kind: "stuffing.v1" as const,
          containerId: selectedContainer.value.id,
          taskId: exactTask.value.id,
        } as const)
      : null,
  ),
  currentSubjectRef: computed(() =>
    selectedContainer.value && exactTask.value
      ? ({
          kind: "container" as const,
          id: selectedContainer.value.id,
        } as const)
      : null,
  ),
  currentTaskRef: computed(() =>
    exactTask.value
      ? ({ kind: "node_task" as const, id: exactTask.value.id } as const)
      : null,
  ),
  displaySummary: computed(
    () => `装箱 · ${selectedContainer.value?.containerNumber ?? "未选择货柜"}`,
  ),
  domainVersionSeen: computed(() => snapshot.value?.version ?? 0),
  activeItemKey: computed(() => "stuffing-snapshot"),
  contextMode: computed(() =>
    encodeStuffingPointer(mobileScreen.value, contextMode.value),
  ),
  adapter: sessionAdapter,
});

onMounted(() => {
  void loadContainerList();
});

watch(
  taskContextKey,
  (nextContextKey, previousContextKey) => {
    contextMode.value = "work";
    if (!aiRefreshInFlight.value && nextContextKey !== previousContextKey) {
      aiActivatedContextKey.value = null;
    }
  },
  { flush: "sync" },
);

watch(
  routeSelectionKey,
  (nextSelectionKey, previousSelectionKey) => {
    if (nextSelectionKey === previousSelectionKey) return;
    if (
      pendingPointerRestore?.routeSelectionKey !== undefined &&
      pendingPointerRestore.routeSelectionKey !== nextSelectionKey
    ) {
      pendingPointerRestore = null;
    }
    mobileScreen.value = "detail";
    aiRefreshIdentity = null;
    aiRefreshInFlight.value = false;
    aiActivatedContextKey.value = null;
    formalClaimReceipt.value = null;
    snapshotDirty.value = false;
    formContainer.value = null;
    formCargo.value = null;
    formSnapshot.value = null;
    formActualFact.value = null;
  },
  { flush: "sync" },
);

watch(
  contextModes,
  (modes) => {
    if (!modes.includes(contextMode.value)) contextMode.value = "work";
  },
  { flush: "sync" },
);

watch(
  [routeSelectionKey, taskContextKey, contextModes, selectionLoading],
  applyPendingPointerRestore,
  { flush: "post" },
);

watch(
  aiAssistance.receipt,
  (receipt) => {
    const contextKey = taskContextKey.value;
    if (
      !receipt ||
      !contextKey ||
      receipt.taskId !== exactTask.value?.id ||
      receipt.workOrderId !== exactWorkOrder.value?.id
    ) {
      return;
    }
    formalClaimReceipt.value = Object.freeze({
      contextKey,
      workOrderId: receipt.workOrderId,
      applied: receipt.applied,
      taskState: receipt.taskState,
      commitState: receipt.commitState,
    });
  },
  { flush: "sync" },
);

watch(
  contextMode,
  (mode) => {
    if (mode === "ai" && availableAiContext.value) {
      aiActivatedContextKey.value = availableAiContext.value.contextKey;
    }
  },
  { flush: "sync" },
);

watch(
  selectedContainer,
  (value) => {
    if (!preservesFormProjection()) formContainer.value = value;
  },
  { flush: "sync", immediate: true },
);

watch(
  cargo,
  (value) => {
    if (!preservesFormProjection()) formCargo.value = value;
  },
  { flush: "sync", immediate: true },
);

watch(
  snapshot,
  (value) => {
    if (!preservesFormProjection()) formSnapshot.value = value;
  },
  { flush: "sync", immediate: true },
);

watch(
  stuffingActualFact,
  (value) => {
    if (!preservesFormProjection()) formActualFact.value = value;
  },
  { flush: "sync", immediate: true },
);

function selectTask(item: StuffingQueueItem): void {
  if (!item.container?.id) return;
  mobileScreen.value = "detail";
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

async function refreshTaskForAi(): Promise<void> {
  const requestContextKey = taskContextKey.value;
  if (!requestContextKey) return;
  const requestModeIntentVersion = contextModeIntentVersion;
  const refreshIdentity = {
    contextKey: requestContextKey,
    routeSelectionKey: routeSelectionKey.value,
  };
  aiRefreshIdentity = refreshIdentity;
  aiRefreshInFlight.value = true;
  try {
    await reloadWorkbench();
  } finally {
    if (aiRefreshIdentity === refreshIdentity) {
      aiRefreshIdentity = null;
      aiRefreshInFlight.value = false;
    }
  }
  if (
    routeSelectionKey.value !== refreshIdentity.routeSelectionKey ||
    taskContextKey.value !== requestContextKey
  ) {
    return;
  }
  if (!snapshotDirty.value) syncFormProjections();
  if (contextModeIntentVersion !== requestModeIntentVersion) return;
  contextMode.value =
    availableAiContext.value?.contextKey === requestContextKey ? "ai" : "work";
}

function recordContextModeIntent(event: MouseEvent): void {
  const control =
    event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>("button[data-mode-control]")
      : null;
  if (
    !control ||
    control.disabled ||
    !(event.currentTarget instanceof HTMLElement) ||
    !event.currentTarget.contains(control) ||
    !contextModes.value.some((mode) => mode === control.dataset.modeControl)
  ) {
    return;
  }
  // Native buttons produce one click for pointer, Enter and Space activation,
  // including an active mode that does not emit update:modelValue.
  contextModeIntentVersion += 1;
}

function preservesFormProjection(): boolean {
  return Boolean(
    aiRefreshIdentity &&
    aiRefreshIdentity.routeSelectionKey === routeSelectionKey.value,
  );
}

function syncFormProjections(): void {
  formContainer.value = selectedContainer.value;
  formCargo.value = cargo.value;
  formSnapshot.value = snapshot.value;
  formActualFact.value = stuffingActualFact.value;
}

function formatDueAt(value: string): string {
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

function claimTaskStateLabel(
  value: TaskActionClaimWorkOrderResultV1["taskState"],
): string {
  if (value === "in_progress") return "进行中";
  if (value === "pending") return "待领取";
  if (value === "completed") return "已完成";
  return "请重新读取任务";
}

function claimCommitStateLabel(
  value: TaskActionClaimWorkOrderResultV1["commitState"],
): string {
  if (value === "committed") return "已入账";
  if (value === "commit_failed") return "入账失败";
  return "待入账";
}

function submitCollaboration(): void {
  void collaboration.send();
}

function retryCollaboration(target: TaskCollaborationRetryTarget): void {
  if (target === "thread") void collaboration.refresh();
  else void collaboration.retrySend();
}

function loadMoreCollaboration(): void {
  void collaboration.loadMore();
}

function confirmAi(): void {
  void aiAssistance.confirm();
}

function rejectAi(reason?: string): void {
  void aiAssistance.reject(reason);
}

function retryAi(target: TaskAiAssistanceRetryTarget): void {
  void aiAssistance.retry(target);
}

function refreshAi(): void {
  void aiAssistance.refresh();
}

type StuffingPointer = {
  screen: WorkbenchMobileScreen;
  mode: TaskContextPanelMode;
  restorable: boolean;
};

function applyPendingPointerRestore(): void {
  const pending = pendingPointerRestore;
  if (!pending) return;
  if (pending.routeSelectionKey !== routeSelectionKey.value) {
    pendingPointerRestore = null;
    return;
  }
  if (
    exactTask.value?.id === pending.taskId &&
    taskContextKey.value &&
    contextModes.value.includes(pending.mode)
  ) {
    pendingPointerRestore = null;
    contextMode.value = pending.mode;
    return;
  }
  if (selectionLoading.value) return;
  pendingPointerRestore = null;
  contextMode.value = "work";
}

function encodeStuffingPointer(
  screen: WorkbenchMobileScreen,
  mode: TaskContextPanelMode,
): string {
  return `screen:${screen};mode:${mode}`;
}

function decodeStuffingPointer(
  value: string | null | undefined,
): StuffingPointer {
  if (value === "edit_snapshot")
    return { screen: "detail", mode: "work", restorable: false };
  const match = value?.match(
    /^screen:(queue|detail|context);mode:(work|archive|collaboration|ai)$/,
  );
  if (!match) return { screen: "detail", mode: "work", restorable: false };
  return {
    screen: match[1] as WorkbenchMobileScreen,
    mode: match[2] as TaskContextPanelMode,
    restorable: true,
  };
}
</script>

<template>
  <RoleWorkbenchFrame
    stage-code="stuffing"
    workspace-label="出运装箱"
    node-scope-label="装箱"
    :selected-container="formContainer"
    :nodes="nodes"
    :selection-loading="selectionLoading && !aiRefreshInFlight"
    :container-list-error="containerListError"
    :selection-error="selectionError"
    :warnings="warnings"
    :context-label="contextLabel"
    :context-summary="contextSummary"
    :mobile-context-label="contextModeLabels[contextMode]"
    responsive-mode="standard"
    :mobile-screen="mobileScreen"
    @update:mobile-screen="mobileScreen = $event"
  >
    <template #switcher>
      <WorkbenchSessionSwitcher
        :sessions="workSessions.sessions.value"
        :on-select="workSessions.select"
        :on-close="workSessions.close"
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
    <template #mobileBreadcrumb>
      <span data-testid="stuffing-mobile-breadcrumb">
        {{ currentContainerLabel }} · {{ currentTaskLabel }} ·
        {{ contextModeLabels[contextMode] }}
      </span>
    </template>
    <template #queueRail>
      <span
        class="stuffing-queue-rail"
        data-testid="stuffing-queue-rail"
        :aria-label="queueRailAccessibleLabel"
        :title="queueRailAccessibleLabel"
      >
        <span>装箱</span>
        <span>{{ queueTaskCount }} 项</span>
      </span>
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
      <div
        v-if="formContainer && !historicalMode"
        class="stuffing-context"
        @click.capture="recordContextModeIntent"
      >
        <TaskContextPanel
          v-model="contextMode"
          :context-key="taskContextKey"
          :modes="contextModes"
          :collaboration="collaborationContext ? collaboration : null"
          :ai="aiPanelModel"
          @submit="submitCollaboration"
          @retry="retryCollaboration"
          @load-more="loadMoreCollaboration"
          @confirm-ai="confirmAi"
          @reject-ai="rejectAi"
          @retry-ai="retryAi"
          @refresh-ai="refreshAi"
        >
          <template #anchor>
            <section
              class="stuffing-context__anchor"
              aria-label="当前装箱任务上下文"
            >
              <dl>
                <div>
                  <dt>当前货柜</dt>
                  <dd>{{ currentContainerLabel }}</dd>
                </div>
                <div>
                  <dt>当前任务</dt>
                  <dd>{{ currentTaskLabel }}</dd>
                </div>
                <div>
                  <dt>当前工单</dt>
                  <dd>{{ currentWorkOrderLabel }}</dd>
                </div>
              </dl>
            </section>
          </template>
          <template #work>
            <StuffingActionPanel
              ref="actionPanel"
              :container-number="formContainer.containerNumber"
              :cargo="formCargo"
              :snapshot="formSnapshot"
              :actual-fact="formActualFact"
              :task="exactTask"
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
              v-if="visibleClaimReceipt"
              class="claim-receipt"
              aria-label="装箱工单领取回执"
            >
              <header>
                <strong>WorkOrder 领取回执</strong>
                <span>{{
                  visibleClaimReceipt.applied ? "已应用" : "未应用"
                }}</span>
              </header>
              <dl>
                <div>
                  <dt>工单</dt>
                  <dd>{{ visibleClaimReceipt.workOrderId }}</dd>
                </div>
                <div>
                  <dt>任务状态</dt>
                  <dd>
                    {{ claimTaskStateLabel(visibleClaimReceipt.taskState) }}
                  </dd>
                </div>
                <div>
                  <dt>入账状态</dt>
                  <dd>
                    {{ claimCommitStateLabel(visibleClaimReceipt.commitState) }}
                  </dd>
                </div>
              </dl>
              <p>
                该回执只证明 WorkOrder
                领取操作的服务端结果，不代表装箱快照、VGM、实际装箱或生命周期进度。
              </p>
            </section>
          </template>
          <template #archive>
            <TaskArchivePanel
              v-if="exactTask && selectedContainer"
              :container-id="selectedContainer.id"
              :task-id="exactTask.id"
              :outcome="exactTask.outcome"
            />
          </template>
        </TaskContextPanel>
      </div>
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
    <template #contextRail>
      <span data-testid="stuffing-context-rail">{{ contextSummary }}</span>
    </template>
  </RoleWorkbenchFrame>
</template>

<style scoped>
.stuffing-context {
  min-width: 0;
}

.stuffing-queue-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: var(--leading-title);
  white-space: nowrap;
}

.stuffing-context__anchor {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}

.stuffing-context__anchor dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
  margin: 0;
}

.stuffing-context__anchor dt,
.stuffing-context__anchor dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.stuffing-context__anchor dt {
  color: var(--muted);
  font-size: var(--text-micro);
}

.stuffing-context__anchor dd {
  color: var(--ink);
  font-size: var(--text-label);
  font-weight: 600;
}

.claim-receipt {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border-top: 1px solid var(--line-strong);
  background: var(--ok-bg);
}

.claim-receipt header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.claim-receipt header span,
.claim-receipt p,
.claim-receipt dt,
.claim-receipt dd {
  margin: 0;
  font-size: var(--text-micro);
}

.claim-receipt dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
  margin: 0;
}

.claim-receipt dt {
  color: var(--muted);
}

.claim-receipt dd {
  overflow-wrap: anywhere;
  color: var(--ink);
}

.claim-receipt p {
  color: var(--ink-soft);
}

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

@media (max-width: 680px) {
  .stuffing-context__anchor dl,
  .claim-receipt dl {
    grid-template-columns: 1fr;
  }
}
</style>
