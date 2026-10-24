<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import type {
  ContainerUnloadingReport,
  TaskActionClaimWorkOrderResultV1,
} from "@logix/contracts";
import { useRoute, useRouter } from "vue-router";
import { isEvidenceUuid } from "../api/evidence";
import TaskContextPanel, {
  type TaskContextPanelMode,
} from "../components/task/TaskContextPanel.vue";
import TaskArchivePanel from "../components/task/TaskArchivePanel.vue";
import {
  useTaskCollaboration,
  type TaskCollaborationContext,
  type TaskCollaborationRetryTarget,
} from "../composables/useTaskCollaboration";
import {
  useTaskAiAssistance,
  type TaskAiAssistanceContext,
  type TaskAiAssistancePanelModel,
  type TaskAiAssistanceRetryTarget,
} from "../composables/useTaskAiAssistance";
import UnloadingActionPanel from "../components/unloading/UnloadingActionPanel.vue";
import UnloadingFactsPanel from "../components/unloading/UnloadingFactsPanel.vue";
import UnloadingProgressPanel from "../components/unloading/UnloadingProgressPanel.vue";
import UnloadingWorkQueue from "../components/unloading/UnloadingWorkQueue.vue";
import RoleWorkbenchFrame from "../components/workbench/RoleWorkbenchFrame.vue";
import type { WorkbenchMobileScreen } from "../components/workbench/workbenchLayout.types";
import {
  useContainerUnloadingCommands,
  type UnloadingReportDraft,
} from "../composables/useContainerUnloadingCommands";
import { useContainerUnloadingWorkbench } from "../composables/useContainerUnloadingWorkbench";
import { useStuffingTaskOperation } from "../composables/useStuffingTaskOperation";
import type { UnloadingQueueItem } from "../data/unloadingWorkbench";
import { CLAIM_WORK_ORDER_ACTION } from "../data/claimReceiptContract";
import { COMPLETE_WORK_ORDER_ACTION } from "../data/completeReceiptContract";

const route = useRoute();
const router = useRouter();
const containerId = computed(() =>
  String(route.query.containerId ?? "").trim(),
);
const taskId = computed(() => String(route.query.taskId ?? "").trim());
const {
  selectedContainer,
  nodes,
  queueItems,
  selectedTask,
  unloadingNode,
  instruction,
  report,
  dates,
  plannedFact,
  estimatedFact,
  actualFact,
  deliveryFact,
  loading,
  queueLoading,
  queueError,
  error,
  warnings,
  reportReadState,
  reload,
} = useContainerUnloadingWorkbench(containerId, taskId);
let selectionGeneration = 0;
const routeSelectionKey = computed(
  () => `${containerId.value}|${taskId.value}|${selectionGeneration}`,
);
const commands = useContainerUnloadingCommands(reload, () => ({
  containerId: containerId.value,
  taskId: taskId.value,
  selectionKey: routeSelectionKey.value,
  generation: selectionGeneration,
  instruction: instruction.value,
  reportVersion:
    report.value?.version ??
    (reportReadState.value === "ready-empty" ? 0 : null),
  projectionVersion: dates.value?.projectionVersion ?? null,
}));
type ProfessionalProjection = {
  container: NonNullable<typeof selectedContainer.value>;
  nodes: typeof nodes.value;
  instruction: typeof instruction.value;
  report: typeof report.value;
  planned: typeof plannedFact.value;
  estimated: typeof estimatedFact.value;
  actual: typeof actualFact.value;
  delivery: typeof deliveryFact.value;
  node: typeof unloadingNode.value;
};
const professional = shallowRef<ProfessionalProjection | null>(null);
const frame = ref<InstanceType<typeof RoleWorkbenchFrame> | null>(null);
const professionalDirty = ref(false);
const commandBusy = computed(() =>
  commands.isSubmittingFor(routeSelectionKey.value),
);
const mobileScreen = ref<WorkbenchMobileScreen>("queue");
const mobileViewport = ref(false);
let mobileQuery: MediaQueryList | null = null;
function syncMobileViewport() {
  mobileViewport.value = mobileQuery?.matches ?? false;
}
let paneIntentVersion = 0;
let professionalReload: { paneIntent: number } | null = null;
watch(mobileScreen, () => paneIntentVersion++, { flush: "sync" });
watch(professional, (current, previous) => {
  if (!current || current.container.id !== previous?.container.id) return;
  if (professionalReload && professionalReload.paneIntent !== paneIntentVersion)
    return;
  const paneIntent = paneIntentVersion;
  const root = frame.value?.$el as HTMLElement | undefined;
  const scroll: { element: HTMLElement; top: number; left: number }[] = [];
  for (
    let element = root?.parentElement;
    element;
    element = element.parentElement
  )
    scroll.push({ element, top: element.scrollTop, left: element.scrollLeft });
  void nextTick(() => {
    if (
      professional.value !== current ||
      frame.value?.$el !== root ||
      paneIntent !== paneIntentVersion
    )
      return;
    for (const item of scroll) {
      item.element.scrollTop = item.top;
      item.element.scrollLeft = item.left;
    }
  });
});
watch(
  [
    containerId,
    selectedContainer,
    loading,
    error,
    dates,
    instruction,
    report,
    nodes,
  ],
  () => {
    if (professional.value?.container.id !== containerId.value)
      professional.value = null;
    if (
      selectedContainer.value?.id === containerId.value &&
      !loading.value &&
      !error.value
    ) {
      if (
        professional.value &&
        (!dates.value || reportReadState.value === "failed")
      )
        return;
      professional.value = {
        container: selectedContainer.value,
        nodes: nodes.value,
        instruction: instruction.value,
        report: report.value,
        planned: plannedFact.value,
        estimated: estimatedFact.value,
        actual: actualFact.value,
        delivery: deliveryFact.value,
        node: unloadingNode.value,
      };
    }
  },
  { immediate: true, flush: "sync" },
);
const liveReady = computed(
  () =>
    selectedContainer.value?.id === containerId.value &&
    !loading.value &&
    !error.value &&
    dates.value !== null &&
    reportReadState.value !== "failed" &&
    Boolean(instruction.value) &&
    instruction.value?.containerRecordId === containerId.value,
);
const professionalStatus = computed(() => {
  if (loading.value)
    return professional.value
      ? "正在重读当前柜事实；草稿保留，暂停提交"
      : "正在读取当前柜事实，暂停提交";
  if (error.value) return error.value;
  if (!professional.value) return "等待货柜事实";
  if (warnings.value.length) return "事实读取不完整，暂停提交；本地输入保留";
  if (!dates.value || reportReadState.value === "failed")
    return "事实未完整读取，暂停提交；本地输入保留";
  if (commandBusy.value) return "正在保存当前柜事实…";
  return professionalDirty.value ? "事实已同步；本地输入保留" : "事实已同步";
});
const taskEvidence = computed(() => actualFact.value ?? deliveryFact.value);
const exactTask = computed(() => {
  const task = selectedTask.value;
  if (!task || !liveReady.value || queueError.value) return null;
  const action = task.nextAction;
  if (!action) return task.workOrders.length === 1 ? task : null;
  if (
    action.actionCode !== CLAIM_WORK_ORDER_ACTION &&
    action.actionCode !== COMPLETE_WORK_ORDER_ACTION
  )
    return null;
  return task.workOrders.some((order) => order.id === action.workOrderId)
    ? task
    : null;
});
const exactWorkOrder = computed(() => {
  const task = exactTask.value;
  if (
    !task ||
    task.containerId !== containerId.value ||
    task.nodeCode !== "container_unloading" ||
    (taskId.value && task.id !== taskId.value)
  )
    return null;
  return task.nextAction
    ? (task.workOrders.find(
        (order) => order.id === task.nextAction?.workOrderId,
      ) ?? null)
    : task.workOrders.length === 1
      ? task.workOrders[0]!
      : null;
});
function createTaskOperation() {
  const generation = selectionGeneration;
  return useStuffingTaskOperation(exactTask, taskEvidence, async () => {
    if (generation === selectionGeneration) await reloadProfessional();
  });
}
const taskOperation = shallowRef(createTaskOperation());
const writesDisabled = computed(
  () =>
    !liveReady.value ||
    commandBusy.value ||
    taskOperation.value.submitting.value ||
    ai.confirming.value ||
    ai.rejecting.value,
);
const visibleAttemptStage = computed(() =>
  commands.attemptStageFor(containerId.value, {
    taskId: taskId.value,
    selectionKey: routeSelectionKey.value,
    generation: selectionGeneration,
  }),
);
const resultRouteKey = shallowRef<string | null>(null);
const visibleReport = computed<ContainerUnloadingReport | null>(() =>
  commands.attemptSelectionKey.value === routeSelectionKey.value &&
  commands.reportResult.value
    ? (commands.reportResult.value as ContainerUnloadingReport)
    : (professional.value?.report ?? null),
);
const visibleFactResult = computed(() =>
  resultRouteKey.value === routeSelectionKey.value &&
  commands.resultContainerId.value === containerId.value
    ? commands.factResult.value
    : null,
);
const contextMode = shallowRef<TaskContextPanelMode>("work");
const directSubmissionKey = shallowRef<string | null>(null);
const visibleTaskSubmission = computed(() =>
  directSubmissionKey.value === taskContextKey.value
    ? taskOperation.value.submission.value
    : null,
);
const modeLabels = {
  work: "办理",
  archive: "档案",
  collaboration: "协作",
  ai: "AI 辅助",
};
let modeIntentVersion = 0;
let lastUserMode: TaskContextPanelMode = "work";
const taskContextKey = computed(() =>
  exactTask.value && exactWorkOrder.value
    ? `container:${containerId.value}|node_task:${exactTask.value.id}|work_order:${exactWorkOrder.value.id}`
    : null,
);
const collaborationContext = computed<TaskCollaborationContext | null>(() =>
  taskContextKey.value && exactTask.value
    ? {
        contextKey: taskContextKey.value,
        taskId: exactTask.value.id,
        subjectRef: { kind: "container", id: containerId.value },
        workRef: { kind: "node_task", id: exactTask.value.id },
      }
    : null,
);
const collaboration = useTaskCollaboration(collaborationContext);
const availableAiContext = computed<TaskAiAssistanceContext | null>(() =>
  collaborationContext.value &&
  exactTask.value?.nextAction?.actionCode === CLAIM_WORK_ORDER_ACTION &&
  isEvidenceUuid(containerId.value) &&
  isEvidenceUuid(exactTask.value.id) &&
  isEvidenceUuid(exactWorkOrder.value?.id ?? "")
    ? collaborationContext.value
    : null,
);
const activatedAiKey = shallowRef<string | null>(null);
let aiRefreshIdentity: object | null = null;
let aiCommand: {
  contextKey: string;
  routeKey: string;
  generation: number;
  intent: number;
} | null = null;
const aiContext = computed(() =>
  availableAiContext.value?.contextKey === activatedAiKey.value
    ? availableAiContext.value
    : null,
);
const ai = useTaskAiAssistance(aiContext, { refreshTask: refreshTaskForAi });
const aiPanelModel = computed<TaskAiAssistancePanelModel | null>(() => {
  const order = exactWorkOrder.value;
  if (!availableAiContext.value || !order) return null;
  return {
    ...ai,
    facts: {
      objectLabel:
        selectedContainer.value?.containerNumber ??
        selectedContainer.value?.orderNumber ??
        "当前货柜",
      taskLabel: "卸柜任务",
      actionLabel: "领取",
      responsibilityLabel:
        order.assignmentState === "automatic"
          ? "系统"
          : order.assigneeId
            ? "已分配人员"
            : "待领取",
      dueLabel: order.dueAt
        ? new Date(order.dueAt).toLocaleString("zh-CN")
        : "未设截止",
    },
  };
});
const contextModes = computed<readonly TaskContextPanelMode[]>(() =>
  !collaborationContext.value
    ? ["work"]
    : availableAiContext.value
      ? ["work", "archive", "collaboration", "ai"]
      : ["work", "archive", "collaboration"],
);
const contextLabel = computed(() =>
  contextMode.value === "work"
    ? "卸柜办理"
    : `任务上下文 · ${modeLabels[contextMode.value]}`,
);
const currentContainerLabel = computed(
  () =>
    professional.value?.container.containerNumber ??
    professional.value?.container.orderNumber ??
    "未选择货柜",
);
const queueRailLabel = computed(
  () =>
    `当前货柜 ${currentContainerLabel.value}，${queueItems.value.length} 项待办`,
);
const formalClaimReceipt = shallowRef<{
  contextKey: string;
  result: TaskActionClaimWorkOrderResultV1;
} | null>(null);
const visibleClaimReceipt = computed(() =>
  formalClaimReceipt.value?.contextKey === taskContextKey.value
    ? formalClaimReceipt.value.result
    : null,
);
watch(
  ai.receipt,
  (result) => {
    if (
      result &&
      taskContextKey.value &&
      result.taskId === exactTask.value?.id &&
      result.workOrderId === exactWorkOrder.value?.id
    )
      formalClaimReceipt.value = { contextKey: taskContextKey.value, result };
  },
  { flush: "sync" },
);
watch(
  routeSelectionKey,
  () => {
    selectionGeneration++;
    taskOperation.value = createTaskOperation();
    directSubmissionKey.value = null;
    aiRefreshIdentity = null;
    aiCommand = null;
    lastUserMode = "work";
    activatedAiKey.value = null;
    formalClaimReceipt.value = null;
    contextMode.value = "work";
    resultRouteKey.value = null;
  },
  { flush: "sync" },
);
watch(
  commands.resultContainerId,
  (id) => {
    if (id === containerId.value)
      resultRouteKey.value = routeSelectionKey.value;
  },
  { flush: "sync" },
);
watch(
  taskContextKey,
  (key) => {
    contextMode.value = "work";
    if (!aiRefreshIdentity) {
      activatedAiKey.value = null;
    }
    // Null is a temporary refresh gap; the receipt stays hidden until its exact
    // task/order returns. A different resolved context always discards it.
    if (key && formalClaimReceipt.value?.contextKey !== key)
      formalClaimReceipt.value = null;
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
  contextMode,
  (mode) => {
    if (mode === "ai" && availableAiContext.value)
      activatedAiKey.value = availableAiContext.value.contextKey;
  },
  { flush: "sync" },
);

async function refreshTaskForAi() {
  // The POST may have been pending while the operator chose another mode.
  // Its callback must use the command's original scope and intent.
  const command = aiCommand;
  if (
    !command ||
    command.generation !== selectionGeneration ||
    command.routeKey !== routeSelectionKey.value ||
    command.contextKey !== taskContextKey.value
  )
    return;
  const identity = {};
  aiRefreshIdentity = identity;
  try {
    await reloadProfessional();
    await nextTick();
    if (
      aiCommand === command &&
      command.generation === selectionGeneration &&
      command.routeKey === routeSelectionKey.value &&
      taskContextKey.value === command.contextKey
    ) {
      const preferred =
        command.intent === modeIntentVersion ? "ai" : lastUserMode;
      contextMode.value = contextModes.value.includes(preferred)
        ? preferred
        : "work";
    }
  } finally {
    if (aiRefreshIdentity === identity) aiRefreshIdentity = null;
  }
}
function recordModeIntent(event: MouseEvent) {
  const control =
    event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>("button[data-mode-control]")
      : null;
  const mode = contextModes.value.find(
    (mode) => mode === control?.dataset.modeControl,
  );
  if (
    control &&
    !control.disabled &&
    event.currentTarget instanceof HTMLElement &&
    event.currentTarget.contains(control) &&
    mode
  ) {
    lastUserMode = mode;
    modeIntentVersion++;
  }
  // Native button click covers mouse, touch, Enter and Space exactly once.
}
async function reloadProfessional() {
  const generation = selectionGeneration;
  const intent = modeIntentVersion;
  const identity = { paneIntent: paneIntentVersion };
  professionalReload = identity;
  const focused = document.activeElement;
  try {
    await reload();
    await nextTick();
    if (
      generation === selectionGeneration &&
      intent === modeIntentVersion &&
      identity.paneIntent === paneIntentVersion &&
      contextMode.value === "work" &&
      focused instanceof HTMLElement &&
      focused.isConnected &&
      focused.closest('[data-context-mode="work"]')
    )
      focused.focus({ preventScroll: true });
  } finally {
    if (professionalReload === identity) professionalReload = null;
  }
}
function retryCollaboration(target: TaskCollaborationRetryTarget) {
  if (!collaborationContext.value) return;
  if (target === "thread") void collaboration.refresh();
  else void collaboration.retrySend();
}
async function runAiCommand(execute: () => Promise<void>) {
  if (writesDisabled.value || !availableAiContext.value) return;
  const command = {
    contextKey: availableAiContext.value.contextKey,
    routeKey: routeSelectionKey.value,
    generation: selectionGeneration,
    intent: modeIntentVersion,
  };
  aiCommand = command;
  try {
    await execute();
  } finally {
    if (aiCommand === command) aiCommand = null;
  }
}
function confirmAi() {
  void runAiCommand(() => ai.confirm());
}
function rejectAi(reason?: string) {
  void runAiCommand(() => ai.reject(reason));
}
function retryAi(target: TaskAiAssistanceRetryTarget) {
  void runAiCommand(() => ai.retry(target));
}

onMounted(() => {
  mobileQuery = window.matchMedia("(max-width: 680px)");
  syncMobileViewport();
  mobileQuery.addEventListener("change", syncMobileViewport);
});
onBeforeUnmount(() =>
  mobileQuery?.removeEventListener("change", syncMobileViewport),
);

function selectTask(item: UnloadingQueueItem) {
  if (!item.task.containerId) return;
  mobileScreen.value = "detail";
  void router.replace({
    path: "/workspaces/unloading",
    query: { containerId: item.task.containerId, taskId: item.task.id },
  });
}

function submit(draft: UnloadingReportDraft) {
  if (writesDisabled.value || !instruction.value) return;
  void commands.submitReport(
    containerId.value,
    report.value?.version ??
      (reportReadState.value === "ready-empty" ? 0 : undefined),
    dates.value?.projectionVersion,
    instruction.value,
    draft,
    {
      taskId: taskId.value,
      selectionKey: routeSelectionKey.value,
      generation: selectionGeneration,
    },
  );
}
function resumeAttempt() {
  if (!writesDisabled.value)
    void commands.resumeAttempt(containerId.value, {
      taskId: taskId.value,
      selectionKey: routeSelectionKey.value,
      generation: selectionGeneration,
    });
}

function executeTask() {
  if (
    !writesDisabled.value &&
    exactWorkOrder.value &&
    exactTask.value?.nextAction
  ) {
    directSubmissionKey.value = taskContextKey.value;
    void taskOperation.value.execute();
  }
}
function retryTask() {
  if (
    !writesDisabled.value &&
    exactWorkOrder.value &&
    exactTask.value?.nextAction &&
    directSubmissionKey.value === taskContextKey.value &&
    visibleTaskSubmission.value?.canRetry &&
    visibleTaskSubmission.value.actionCode ===
      exactTask.value.nextAction.actionCode
  )
    void taskOperation.value.retry();
}
</script>

<template>
  <RoleWorkbenchFrame
    ref="frame"
    stage-code="unloading"
    workspace-label="仓库收货"
    node-scope-label="卸柜"
    :selected-container="professional?.container ?? selectedContainer"
    :nodes="professional?.nodes ?? nodes"
    :context-ready="Boolean(professional)"
    :selection-loading="!professional && loading"
    :container-list-error="error"
    :selection-error="professional ? '' : error"
    :warnings="warnings"
    :context-label="contextLabel"
    responsive-mode="standard"
    :mobile-screen="mobileScreen"
    mobile-context-label="办理"
    @update:mobile-screen="mobileScreen = $event"
  >
    <template #context>
      <span role="status">{{ professionalStatus }}</span>
      <button
        v-if="professional && !loading && (error || !dates || warnings.length)"
        type="button"
        data-unloading-reload
        @click="reloadProfessional"
      >
        重新读取事实
      </button>
    </template>
    <template #mobileBreadcrumb>
      <span data-testid="unloading-mobile-breadcrumb"
        >{{ currentContainerLabel }} ·
        {{ exactTask ? "卸柜任务" : "专业事实" }} ·
        {{ modeLabels[contextMode] }}</span
      >
    </template>
    <template #queueRail>
      <span
        class="unloading-queue-rail"
        data-testid="unloading-queue-rail"
        :aria-label="queueRailLabel"
        :title="queueRailLabel"
        ><span>卸柜</span><span>{{ queueItems.length }} 项</span></span
      >
    </template>
    <template #contextRail>
      <span data-testid="unloading-context-rail">{{
        contextMode === "work" ? "继续办理" : modeLabels[contextMode]
      }}</span>
    </template>
    <template #queue>
      <div>
        <p v-if="queueError" class="queue-error" role="alert">
          {{ queueError }}
        </p>
        <UnloadingWorkQueue
          :items="queueItems"
          :selected-task-id="selectedTask?.id ?? taskId"
          :loading="queueLoading"
          @select="selectTask"
        />
      </div>
    </template>
    <template #primary>
      <div class="unloading-primary">
        <UnloadingFactsPanel
          :instruction="professional?.instruction ?? null"
          :report="visibleReport"
          :delivery-fact="professional?.delivery ?? null"
          :planned-fact="professional?.planned ?? null"
          :estimated-fact="professional?.estimated ?? null"
          :actual-fact="professional?.actual ?? null"
          :node="professional?.node ?? null"
        />
        <UnloadingProgressPanel :report="visibleReport" />
      </div>
    </template>
    <template #secondary>
      <div
        class="unloading-context"
        :inert="(mobileViewport && mobileScreen !== 'context') || undefined"
        @click.capture="recordModeIntent"
      >
        <TaskContextPanel
          v-model="contextMode"
          :context-key="taskContextKey"
          :modes="contextModes"
          :collaboration="collaborationContext ? collaboration : null"
          :ai="aiPanelModel"
          @submit="collaborationContext && collaboration.send()"
          @retry="retryCollaboration"
          @load-more="collaborationContext && collaboration.loadMore()"
          @confirm-ai="confirmAi"
          @reject-ai="rejectAi"
          @retry-ai="retryAi"
          @refresh-ai="runAiCommand(() => ai.refresh())"
        >
          <template #anchor>
            <section
              class="unloading-context__anchor"
              aria-label="当前卸柜任务上下文"
            >
              <strong>{{
                professional?.container.containerNumber ?? "当前货柜"
              }}</strong>
              <span
                >{{ exactTask ? "卸柜任务" : "专业事实办理" }} ·
                {{ modeLabels[contextMode] }}</span
              >
              <span v-if="exactWorkOrder"
                >{{
                  aiPanelModel?.facts.responsibilityLabel ??
                  (exactWorkOrder.assignmentState === "automatic"
                    ? "系统"
                    : exactWorkOrder.assigneeId
                      ? "已分配人员"
                      : "待领取")
                }}
                ·
                {{
                  exactWorkOrder.dueAt
                    ? new Date(exactWorkOrder.dueAt).toLocaleString("zh-CN")
                    : "未设截止"
                }}</span
              >
            </section>
          </template>
          <template #work>
            <UnloadingActionPanel
              :draft-identity="containerId"
              :instruction="professional?.instruction ?? null"
              :report="visibleReport"
              :task="exactTask"
              :disabled="writesDisabled"
              :submitting="commandBusy"
              :task-submitting="taskOperation.submitting.value"
              :submission="visibleTaskSubmission"
              :fact-result="visibleFactResult"
              :attempt-stage="visibleAttemptStage"
              :error="commands.error.value"
              @submit="submit"
              @dirty-change="professionalDirty = $event"
              @execute-task="executeTask"
              @retry-task="retryTask"
              @retry-attempt="resumeAttempt"
            />
            <section
              v-if="visibleClaimReceipt"
              class="unloading-context__anchor"
              aria-label="卸柜工单领取回执"
            >
              <strong
                >工单领取回执 ·
                {{ visibleClaimReceipt.applied ? "已应用" : "未应用" }}</strong
              >
              <span>{{ visibleClaimReceipt.workOrderId }}</span>
              <span>{{
                visibleClaimReceipt.commitState === "committed"
                  ? "已入账"
                  : "未入账"
              }}</span>
              <p>仅证明工单领取，不证明卸柜报告、日期采信或卸空。</p>
            </section>
            <section
              v-if="visibleTaskSubmission"
              class="unloading-context__anchor"
              aria-label="卸柜工单提交回执"
            >
              <strong
                >工单{{
                  visibleTaskSubmission.stage === "committed"
                    ? "已入账"
                    : "未入账"
                }}</strong
              >
              <span>{{
                visibleTaskSubmission.message ?? "当前工单操作已返回回执"
              }}</span>
            </section>
          </template>
          <template #archive>
            <TaskArchivePanel
              v-if="exactTask && exactWorkOrder"
              :key="taskContextKey!"
              :container-id="containerId"
              :task-id="exactTask.id"
              :outcome="exactTask.outcome"
            />
          </template>
        </TaskContextPanel>
      </div>
    </template>
  </RoleWorkbenchFrame>
</template>

<style scoped>
.unloading-context {
  min-width: 0;
}
.unloading-queue-rail {
  display: grid;
  gap: var(--space-1);
  text-align: center;
}
.unloading-context__anchor {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-3);
  border-bottom: 1px solid var(--line);
  overflow-wrap: anywhere;
}
.unloading-context__anchor span,
.unloading-context__anchor p {
  margin: 0;
  color: var(--ink-soft);
  font-size: var(--text-label);
}
.queue-error {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  background: var(--warn-bg);
  color: var(--warn);
  font-size: var(--text-micro);
}
.unloading-primary {
  display: grid;
  gap: var(--space-3);
}
.unloading-primary > * {
  border-bottom: 1px solid var(--line);
}
.unloading-primary > *:last-child {
  border-bottom: 0;
}
</style>
