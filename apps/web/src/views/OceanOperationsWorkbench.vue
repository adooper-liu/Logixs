<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from "vue";
import { MapPin, Ship } from "@lucide/vue";
import AttachmentControl, {
  type AttachmentItem,
} from "../components/attachment/AttachmentControl.vue";
import { isEvidenceUuid } from "../api/evidence";
import { listNodeTasks } from "../api/nodeTasks";
import {
  checklistStatusLabel,
  customsDocumentChecklist,
} from "../data/customsClearanceDocumentRequirements";
import { lifecycleStatusLabel } from "../data/liveWorkspaceProjection";
import { useRoute, useRouter } from "vue-router";
import {
  getOceanOperationsProjection,
  listOceanOperationsQueue,
  saveOceanOperationsReview,
  type OceanOperationsProjection,
  type OceanOperationsQueueItem,
  type ArrivalPreparationResult,
  type SourceReviewDecision,
} from "../api/oceanOperations";
import TaskContextPanel from "../components/task/TaskContextPanel.vue";
import type { TaskContextPanelMode } from "../components/task/TaskContextPanel.vue";
import WorkbenchLayout from "../components/workbench/WorkbenchLayout.vue";
import WorkbenchPane from "../components/workbench/WorkbenchPane.vue";
import WorkbenchPageHeader from "../components/workbench/WorkbenchPageHeader.vue";
import WorkbenchResponsibilityBand from "../components/workbench/WorkbenchResponsibilityBand.vue";
import WorkbenchDecisionStrip from "../components/workbench/WorkbenchDecisionStrip.vue";
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

const leftCollapsed = ref(false);
const rightCollapsed = ref(false);
const mobileScreen = ref<"queue" | "detail" | "context">("queue");

type ReviewPayload = Parameters<typeof saveOceanOperationsReview>[1];
interface ReviewDraft {
  sourceObservationId: string;
  reason: string;
  decision: SourceReviewDecision;
  arrivalResult: ArrivalPreparationResult;
  nextStep: string;
  retry: { fingerprint: string; payload: ReviewPayload } | null;
}

const DESTINATION_ETA_EVENTS = new Set([
  "arrival_port",
  "arrived",
  "eta",
  "vessel_arrival",
]);

const route = useRoute();
const router = useRouter();
const queue = ref<OceanOperationsQueueItem[]>([]);
const selected = ref<OceanOperationsProjection | null>(null);
const selectedId = ref<string | null>(
  typeof route.query.containerId === "string" ? route.query.containerId : null,
);
const loading = ref(true);
const loadingObject = ref(false);
const generalError = ref("");
const objectErrors = ref<Record<string, string>>({});
const versionConflicts = ref<Set<string>>(new Set());
type ContextTab =
  "progress" | "route_risk" | "information" | "coordination" | "fees";
const contextTabs: { id: ContextTab; label: string }[] = [
  { id: "progress", label: "运输进展" },
  { id: "route_risk", label: "风险" },
  { id: "information", label: "信息缺失或冲突" },
  { id: "coordination", label: "下游信息与协同" },
  { id: "fees", label: "财务" },
];
const contextTab = ref<ContextTab>("progress");
const OCEAN_COLLABORATION_NODE = "ocean_transit";
const collaborationModes = ["collaboration", "ai"] as const;
const collaborationMode = ref<TaskContextPanelMode>("collaboration");
const coordinationTaskId = ref<string | null>(null);
const coordinationTaskLoading = ref(false);
const coordinationTaskError = ref("");
const collaborationContext = computed<TaskCollaborationContext | null>(() => {
  const containerId = selected.value?.container.id;
  const taskId = coordinationTaskId.value;
  if (!containerId || !taskId || containerId !== selectedId.value) return null;
  return {
    contextKey: `container:${containerId}|node_task:${taskId}`,
    taskId,
    subjectRef: { kind: "container", id: containerId },
    workRef: { kind: "node_task", id: taskId },
  };
});
const collaboration = useTaskCollaboration(collaborationContext);
const aiAvailableContext = computed<TaskAiAssistanceContext | null>(() => {
  const current = collaborationContext.value;
  if (!current) return null;
  if (
    !isEvidenceUuid(current.subjectRef.id) ||
    !isEvidenceUuid(current.workRef.id)
  ) {
    return null;
  }
  return current;
});
const aiActivatedContextKey = shallowRef<string | null>(null);
const aiContext = computed<TaskAiAssistanceContext | null>(() =>
  aiAvailableContext.value?.contextKey === aiActivatedContextKey.value
    ? aiAvailableContext.value
    : null,
);
const aiAssistance = useTaskAiAssistance(aiContext, {
  refreshTask: () => {
    if (selectedId.value) return select(selectedId.value, false);
  },
});
const aiPanel = computed<TaskAiAssistancePanelModel>(() => ({
  ...aiAssistance,
  facts: {
    objectLabel: selected.value?.container.number ?? "当前运输",
    taskLabel: "海运在途",
    actionLabel: "领取",
    responsibilityLabel:
      selected.value?.task.currentResponsibility ?? "海运运营",
    dueLabel: selected.value?.task.deadline ?? "未设截止",
  },
}));
watch(
  [collaborationMode, aiAvailableContext],
  () => {
    if (collaborationMode.value === "ai" && aiAvailableContext.value) {
      aiActivatedContextKey.value = aiAvailableContext.value.contextKey;
    }
  },
  { flush: "sync" },
);
watch(
  [collaborationContext, coordinationTaskLoading, coordinationTaskError],
  () => {
    if (collaborationContext.value) return;
    collaboration.loading.value = coordinationTaskLoading.value;
    collaboration.error.value = coordinationTaskError.value;
    collaboration.retryable.value = Boolean(coordinationTaskError.value);
    if (coordinationTaskLoading.value || coordinationTaskError.value) return;
    collaboration.canPost.value = true;
    collaboration.postDisabledReason.value = null;
    if (!collaboration.visibilityLabel.value)
      collaboration.visibilityLabel.value = "当前运输";
  },
  { flush: "sync", immediate: true },
);
function selectTab(tab: ContextTab): void {
  contextTab.value = tab;
  mobileScreen.value = "context";
}

const reason = ref("");
const decision = ref<SourceReviewDecision>("review_required");
const arrivalResult = ref<ArrivalPreparationResult>("pending_evidence");
const nextStep = ref("");
const selectedObservationId = ref("");
const dateRecords = ref<
  { containerId: string; kind: string; value: string; note: string }[]
>([]);
const visibleDateRecords = computed(() =>
  dateRecords.value.filter((item) => item.containerId === selectedId.value),
);
const dateKind = ref("最晚提柜");
const dateValue = ref("");
const dateNote = ref("");
function recordDate(): void {
  const containerId = selectedId.value;
  const value = dateValue.value.trim();
  if (!containerId || !value) return;
  dateRecords.value = [
    ...dateRecords.value,
    {
      containerId,
      kind: dateKind.value,
      value,
      note: dateNote.value.trim(),
    },
  ];
  dateValue.value = "";
  dateNote.value = "";
}
const heldAttachments = ref<Record<string, AttachmentItem[]>>({});
function attachmentKey(code: string): string {
  return `${selectedId.value ?? ""}:${code}`;
}
function filesFor(code: string): AttachmentItem[] {
  return heldAttachments.value[attachmentKey(code)] ?? [];
}
function setFiles(code: string, files: AttachmentItem[]): void {
  heldAttachments.value = {
    ...heldAttachments.value,
    [attachmentKey(code)]: files,
  };
}
const filedDocumentCodes = computed(() => {
  const prefix = `${selectedId.value ?? ""}:`;
  return Object.entries(heldAttachments.value)
    .filter(([key, files]) => key.startsWith(prefix) && files.length > 0)
    .map(([key]) => key.slice(prefix.length));
});
const voyageDates = computed(() => {
  const shipment = selected.value?.shipment;
  const eta = etaObservations.value[0]?.rawValue ?? null;
  return [
    {
      code: "etd",
      name: "ETD",
      value: shipment?.plannedDepartureAt
        ? overviewDate(shipment.plannedDepartureAt)
        : "待补",
      known: Boolean(shipment?.plannedDepartureAt),
    },
    {
      code: "atd",
      name: "ATD",
      value: shipment?.actualDepartureAt
        ? overviewDate(shipment.actualDepartureAt)
        : "待回流",
      known: Boolean(shipment?.actualDepartureAt),
    },
    {
      code: "eta",
      name: "ETA",
      value: eta ? overviewDate(eta) : "待补",
      known: Boolean(eta),
    },
    { code: "ata", name: "ATA", value: "待回流", known: false },
  ];
});
const customsChecklist = computed(() =>
  customsDocumentChecklist(
    selected.value?.shipment?.destination.code ?? null,
    filedDocumentCodes.value,
  ),
);
const drafts = new Map<string, ReviewDraft>();
let projectionRequest = 0;

const error = computed(
  () =>
    (selectedId.value ? objectErrors.value[selectedId.value] : "") ||
    generalError.value,
);
const hasVersionConflict = computed(() =>
  selectedId.value ? versionConflicts.value.has(selectedId.value) : false,
);
const etaObservations = computed(
  () =>
    selected.value?.observations.filter(
      (item) =>
        item.timeKind === "estimated" &&
        DESTINATION_ETA_EVENTS.has(item.semanticKey.toLowerCase()),
    ) ?? [],
);
const TRANSIT_NOTICES = new Set(["transit_arrived", "transit_departed"]);
const ROLL_NOTICES = new Set(["rolled", "dumped"]);
function currentNotice(keys: Set<string>): string | null {
  const hits =
    selected.value?.observations.filter(
      (item) => item.isCurrent && keys.has(item.semanticKey.toLowerCase()),
    ) ?? [];
  if (hits.length === 0) return null;
  const text = hits
    .map((item) => item.rawValue.trim())
    .filter(Boolean)
    .join("；");
  return text || "已有通知";
}
const riskSignals = computed(() => {
  const transit = currentNotice(TRANSIT_NOTICES);
  const roll = currentNotice(ROLL_NOTICES);
  return [
    {
      code: "transshipment",
      name: "中转",
      status: transit ? "已有通知" : "未接入",
      evidence: transit ?? "未接入",
      impact: "未知",
    },
    {
      code: "roll",
      name: "甩柜或改港",
      status: roll ? "已有通知" : "未接入",
      evidence: roll ?? "未接入",
      impact: "未知",
    },
    {
      code: "stale",
      name: "长时间无更新",
      status: "未知",
      evidence: "新鲜度未定",
      impact: "未知",
    },
    {
      code: "arrangement",
      name: "承运安排变化",
      status: "未接入",
      evidence: "未接入",
      impact: "未知",
    },
  ];
});
const costAmount = computed(() => {
  const cost = selected.value?.financialProjection.costFee;
  if (!cost?.amount || !cost.currency) return null;
  const parsed = Number(cost.amount);
  const amount = Number.isFinite(parsed)
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
        parsed,
      )
    : cost.amount;
  return `${cost.currency} ${amount}`;
});
const demurrageWatch = computed(() => {
  const status = selected.value?.container.status ?? "";
  const arrived = [
    "at_port",
    "picked_up",
    "unloaded",
    "returned_empty",
  ].includes(status);
  if (!arrived) {
    return {
      label: "待计算",
      detail: "实际到港未回流，免费期与费率未接入，起算情况未知",
    };
  }
  return {
    label: "待计算",
    detail: "已到港，免费期与费率未接入",
  };
});
const watchDates = computed(() => {
  const projection = selected.value;
  if (!projection) return [];
  const customs = projection.task.deadline;
  return [
    {
      code: "customs",
      name: "最晚清关",
      value: customs ? overviewDate(customs) : "未知",
      known: Boolean(customs),
    },
    { code: "pickup", name: "最晚提柜", value: "未取得", known: false },
    { code: "return", name: "最晚还箱", value: "未取得", known: false },
    {
      code: "demurrage",
      name: "滞港费",
      value: demurrageWatch.value.label,
      known: false,
    },
  ];
});
function overviewDate(value: string | null | undefined): string {
  if (!value) return "待回流";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly)
    return `${dateOnly[1]}/${Number(dateOnly[2])}/${Number(dateOnly[3])}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日期待核";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

const progressNodes = computed(() => {
  const projection = selected.value;
  if (!projection) return [];
  const shipment = projection.shipment;
  const atd = shipment?.actualDepartureAt ?? null;
  const etd = shipment?.plannedDepartureAt ?? null;
  const eta = etaObservations.value[0]?.rawValue ?? null;
  const status = projection.container.status;
  const pastTransit = [
    "at_port",
    "picked_up",
    "unloaded",
    "returned_empty",
  ].includes(status);
  const inTransit = status === "in_transit" || status === "shipped";
  const departureState = atd
    ? "done"
    : pastTransit || inTransit
      ? "unknown"
      : etd
        ? "current"
        : "unknown";
  const transitState = pastTransit
    ? "done"
    : inTransit || atd
      ? "current"
      : "ahead";
  const arrivalState = pastTransit ? "current" : "ahead";
  return [
    {
      code: "departure",
      name: "离港",
      state: departureState,
      stateLabel: atd ? "实际" : etd ? "预计" : "未取得",
      date: atd || etd ? overviewDate(atd ?? etd) : null,
      kind: atd ? "ATD" : etd ? "ETD" : null,
      place: [shipment?.origin.name, shipment?.origin.code]
        .filter(Boolean)
        .join(" "),
      pending: null as string | null,
    },
    {
      code: "transit",
      name: "在途",
      state: transitState,
      stateLabel: pastTransit ? "已过" : lifecycleStatusLabel(status),
      date: null,
      kind: null,
      place: "",
      pending: null,
    },
    {
      code: "arrival",
      name: "到港",
      state: arrivalState,
      stateLabel: eta ? "预计" : "未取得",
      date: eta ? overviewDate(eta) : null,
      kind: eta ? "ETA" : null,
      place: [shipment?.destination.name, shipment?.destination.code]
        .filter(Boolean)
        .join(" "),
      pending: "ATA 待回流",
    },
  ];
});

const responsibilityItems = computed(() => [
  {
    label: "当前运输",
    value: selected.value?.container.number ?? null,
    state: selected.value ? ("known" as const) : ("unknown" as const),
  },
  {
    label: "当前责任",
    value: selected.value?.task.currentResponsibility ?? null,
    state: selected.value ? ("known" as const) : ("unknown" as const),
  },
  {
    label: "清关期限",
    value: selected.value?.task.deadline ?? null,
    state: selected.value?.task.deadline
      ? ("known" as const)
      : ("unknown" as const),
  },
  {
    label: "下游交接",
    value: selected.value ? "接收记录未接通" : null,
    state: selected.value ? ("known" as const) : ("unknown" as const),
  },
]);
const decisionConclusion = computed(() => {
  if (loadingObject.value) return "正在读取运输事项";
  if (!selected.value) return "请选择运输待办";
  const attention =
    selected.value.focus?.filter((item) => item.status === "attention")
      .length ?? 0;
  return attention
    ? `${attention} 类信息需核对，其他工作继续`
    : "按已有运输信息持续跟踪";
});
function snapshotDraft(): void {
  const containerId = selected.value?.container.id;
  if (!containerId) return;
  const current = drafts.get(containerId);
  drafts.set(containerId, {
    sourceObservationId: selectedObservationId.value,
    reason: reason.value,
    decision: decision.value,
    arrivalResult: arrivalResult.value,
    nextStep: nextStep.value,
    retry: current?.retry ?? null,
  });
}

function applyProjection(projection: OceanOperationsProjection): void {
  selected.value = projection;
  const containerId = projection.container.id;
  const eta = projection.observations.find(
    (item) =>
      item.timeKind === "estimated" &&
      DESTINATION_ETA_EVENTS.has(item.semanticKey.toLowerCase()),
  );
  const existing = drafts.get(containerId);
  const draft =
    existing ??
    ({
      sourceObservationId:
        projection.review?.sourceObservationId ??
        eta?.id ??
        projection.observations[0]?.id ??
        "",
      reason: projection.review?.reason ?? "",
      decision: projection.review?.decision ?? "review_required",
      arrivalResult:
        projection.arrivalPreparation?.result ?? "pending_evidence",
      nextStep:
        projection.arrivalPreparation?.nextStep ??
        "按本岗条件开展准备，仅跟进影响具体动作的缺项",
      retry: null,
    } satisfies ReviewDraft);
  drafts.set(containerId, draft);
  selectedObservationId.value = draft.sourceObservationId;
  reason.value = draft.reason;
  decision.value = draft.decision;
  arrivalResult.value = draft.arrivalResult;
  nextStep.value = draft.nextStep;
}

watch(
  [selectedObservationId, reason, decision, arrivalResult, nextStep],
  snapshotDraft,
  {
    flush: "sync",
  },
);

async function loadQueue(): Promise<void> {
  loading.value = true;
  generalError.value = "";
  try {
    queue.value = await listOceanOperationsQueue();
    if (!selectedId.value && queue.value[0])
      selectedId.value = queue.value[0].containerId;
    if (selectedId.value) await select(selectedId.value, false);
  } catch (cause) {
    generalError.value =
      cause instanceof Error ? cause.message : "读取运输待办失败";
  } finally {
    loading.value = false;
  }
}

function submitCollaboration(): void {
  if (!collaborationContext.value) {
    collaboration.sendError.value = "消息没有发出。";
    return;
  }
  void collaboration.send();
}

function retryCollaboration(target: TaskCollaborationRetryTarget): void {
  if (!collaborationContext.value) {
    void reloadCoordinationTask();
    return;
  }
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

async function loadCoordinationTask(
  containerId: string,
  request: number,
): Promise<void> {
  if (request !== projectionRequest || selectedId.value !== containerId) return;
  coordinationTaskLoading.value = true;
  coordinationTaskError.value = "";
  coordinationTaskId.value = null;
  try {
    const page = await listNodeTasks({ containerId, pageSize: 50 });
    if (request !== projectionRequest || selectedId.value !== containerId)
      return;
    const matches = page.items.filter(
      (item) =>
        item.nodeCode === OCEAN_COLLABORATION_NODE &&
        item.containerId === containerId,
    );
    if (matches.length === 1) {
      coordinationTaskId.value = matches[0]?.id ?? null;
      return;
    }
    coordinationTaskError.value =
      matches.length > 1
        ? "这票有多条海运任务，协同对话未接通"
        : page.pageInfo.hasNextPage
          ? "海运任务未在当前读取范围确认，协同对话未接通"
          : "";
  } catch (cause) {
    if (request !== projectionRequest || selectedId.value !== containerId)
      return;
    coordinationTaskError.value =
      cause instanceof Error ? cause.message : "确认海运任务失败";
  } finally {
    if (request === projectionRequest) coordinationTaskLoading.value = false;
  }
}

async function reloadCoordinationTask(): Promise<void> {
  const containerId = selectedId.value;
  if (containerId) await loadCoordinationTask(containerId, projectionRequest);
}

async function select(containerId: string, updateUrl = true): Promise<void> {
  snapshotDraft();
  const request = ++projectionRequest;
  selectedId.value = containerId;
  coordinationTaskId.value = null;
  coordinationTaskError.value = "";
  coordinationTaskLoading.value = true;
  if (updateUrl) mobileScreen.value = "detail";
  loadingObject.value = true;
  if (selected.value?.container.id !== containerId) selected.value = null;
  try {
    if (updateUrl) await router.replace({ query: { containerId } });
    if (request !== projectionRequest || selectedId.value !== containerId)
      return;
    const projection = await getOceanOperationsProjection(containerId);
    if (request !== projectionRequest || selectedId.value !== containerId)
      return;
    applyProjection(projection);
    const nextErrors = { ...objectErrors.value };
    delete nextErrors[containerId];
    objectErrors.value = nextErrors;
    const nextConflicts = new Set(versionConflicts.value);
    nextConflicts.delete(containerId);
    versionConflicts.value = nextConflicts;
    await loadCoordinationTask(containerId, request);
  } catch (cause) {
    if (request !== projectionRequest || selectedId.value !== containerId)
      return;
    coordinationTaskLoading.value = false;
    objectErrors.value = {
      ...objectErrors.value,
      [containerId]:
        cause instanceof Error ? cause.message : "读取运输事项失败",
    };
  } finally {
    if (request === projectionRequest) loadingObject.value = false;
  }
}

async function rereadCurrent(): Promise<void> {
  if (selectedId.value) await select(selectedId.value, false);
}

onMounted(() => void loadQueue());
</script>

<template>
  <main class="ocean-operations-page page-frame">
    <WorkbenchLayout
      v-model:left-collapsed="leftCollapsed"
      v-model:right-collapsed="rightCollapsed"
      v-model:mobile-screen="mobileScreen"
      left-rail-label="运输待办"
      right-rail-label="到港准备办理"
      :left-rail-summary="`${queue.length} 票运输`"
      :right-rail-summary="
        hasVersionConflict ? '版本冲突 · 可重读' : decisionConclusion
      "
      mobile-context-label="办理"
    >
      <template #header>
        <WorkbenchPageHeader stage-code="ocean_operations" eyebrow="运输执行" />
      </template>
      <template #responsibility>
        <div class="page-status">
          <WorkbenchResponsibilityBand
            region-label="海运岗位与交接上下文"
            :items="responsibilityItems"
          />
          <WorkbenchDecisionStrip
            region-label="当前运输关注摘要"
            :conclusion="decisionConclusion"
            tone="info"
          >
            <template #conclusionDetail
              ><span>信息及时共享，单项待核不阻断其他工作</span></template
            >
          </WorkbenchDecisionStrip>
        </div>
      </template>
      <template #mobileBreadcrumb>
        <span>{{ selected?.container.number ?? "请选择运输" }} · 到港准备</span>
      </template>
      <template #queue>
        <WorkbenchPane
          id="ocean-queue"
          title="运输待办"
          region-label="运输待办队列"
          :count="queue.length"
        >
          <div v-if="generalError" class="error-banner" role="alert">
            <span>{{ generalError }}</span>
            <button
              v-if="generalError"
              class="retry-queue"
              type="button"
              @click="loadQueue"
            >
              重试读取
            </button>
          </div>

          <div class="queue-pane" :aria-busy="loading">
            <p v-if="loading" class="loading-state" role="status">
              正在读取运输待办...
            </p>
            <p
              v-if="!loading && !error && queue.length === 0"
              class="empty-state"
            >
              暂无运输待办
            </p>
            <button
              v-for="item in queue"
              :key="item.containerId"
              type="button"
              class="queue-item"
              :class="{ selected: item.containerId === selectedId }"
              @click="select(item.containerId)"
            >
              <span class="queue-heading">
                <strong>{{ item.containerNumber ?? "未绑定柜号" }}</strong>
                <span class="queue-kicker">{{
                  lifecycleStatusLabel(item.status)
                }}</span>
              </span>
              <small>
                {{ item.reviewDecision ? "已有本岗记录" : "查看进展与变化" }}
                · {{ item.observationCount }} 项依据<template
                  v-if="item.conflictCount"
                >
                  · {{ item.conflictCount }} 项冲突</template
                >
              </small>
            </button>
          </div>
        </WorkbenchPane>
      </template>
      <template #queueRail
        ><strong>{{ queue.length }}</strong
        ><span>运输</span></template
      >
      <template #detail>
        <WorkbenchPane
          id="ocean-detail"
          title="运输事实与依据"
          region-label="当前运输事实与缺口"
        >
          <div
            v-if="selected && error && !generalError"
            class="error-banner"
            role="alert"
          >
            <span>{{ error }}</span>
            <button class="reread" type="button" @click="rereadCurrent">
              重新读取运输事项
            </button>
          </div>
          <div v-if="selected" class="case-flow">
            <div class="case-scroll">
              <section
                class="transport-overview flow-section"
                aria-labelledby="overview-title"
              >
                <div class="section-heading">
                  <h2 id="overview-title">
                    运输概况 · {{ selected.container.number }}
                  </h2>
                  <button
                    class="refresh-current"
                    type="button"
                    @click="rereadCurrent"
                  >
                    刷新
                  </button>
                </div>
                <div class="transport-summary">
                  <div class="voyage-dates">
                    <div class="departure-dates" aria-label="出运时间">
                      <strong
                        ><span class="date-label">ETD </span>
                        <time
                          v-if="selected.shipment?.plannedDepartureAt"
                          :datetime="selected.shipment.plannedDepartureAt"
                          >{{
                            overviewDate(selected.shipment.plannedDepartureAt)
                          }}</time
                        ><span v-else>待补</span></strong
                      >
                      <span class="actual-date"
                        ><span class="date-label">ATD </span>
                        <time
                          v-if="selected.shipment?.actualDepartureAt"
                          data-kind="actual"
                          :datetime="selected.shipment.actualDepartureAt"
                          >{{
                            overviewDate(selected.shipment.actualDepartureAt)
                          }}</time
                        ><span v-else>待回流</span></span
                      >
                    </div>
                    <div class="arrival-dates" aria-label="到港时间">
                      <strong
                        ><span class="date-label">ETA </span>
                        <time
                          v-if="etaObservations[0]?.rawValue"
                          :datetime="etaObservations[0]?.rawValue"
                          >{{
                            overviewDate(etaObservations[0]?.rawValue)
                          }}</time
                        ><span v-else>待补</span></strong
                      >
                      <span class="actual-date"
                        ><span class="date-label">ATA </span>
                        <span>待回流</span></span
                      >
                    </div>
                  </div>
                  <div class="route-line">
                    <div class="route-port route-port--origin">
                      <span>起运港</span>
                      <strong
                        ><MapPin :size="18" aria-hidden="true" />{{
                          selected.standards?.origin.name ??
                          selected.shipment?.origin.name ??
                          "待补"
                        }}</strong
                      >
                      <small>{{
                        selected.shipment?.origin.code ?? "未编码"
                      }}</small>
                      <small
                        v-if="
                          selected.standards?.origin.status === 'unrecognized'
                        "
                        >来源码 · 待映射</small
                      >
                    </div>
                    <div class="route-journey">
                      <span class="route-status"
                        >货物状态：{{
                          lifecycleStatusLabel(selected.container.status)
                        }}</span
                      >
                      <div class="route-track" aria-hidden="true">
                        <span></span>
                        <Ship :size="16" />
                        <span></span>
                      </div>
                    </div>
                    <div class="route-port route-port--destination">
                      <span>目的港</span>
                      <strong
                        ><MapPin :size="18" aria-hidden="true" />{{
                          selected.standards?.destination.name ??
                          selected.shipment?.destination.name ??
                          "待补"
                        }}</strong
                      >
                      <small>{{
                        selected.shipment?.destination.code ?? "未编码"
                      }}</small>
                    </div>
                  </div>
                  <div class="transport-facts">
                    <p
                      v-if="selected.container.typeCode"
                      class="type-reference"
                    >
                      柜型 <strong>{{ selected.container.typeCode }}</strong
                      ><small
                        v-if="
                          selected.standards?.containerType.status ===
                          'pending_review'
                        "
                      >
                        · 映射待核</small
                      >
                    </p>
                    <div class="transport-identity">
                      <span
                        >货柜号
                        <strong>{{
                          selected.container.number ?? "待补"
                        }}</strong></span
                      >
                      <span
                        >备货单
                        <strong>{{
                          selected.references.replenishmentOrderNumber ?? "待补"
                        }}</strong></span
                      >
                      <span
                        >提单号（HBL）
                        <strong>{{
                          selected.references.houseBillNumber ?? "待补"
                        }}</strong></span
                      >
                    </div>
                    <div class="transport-vessel">
                      <span
                        >船公司
                        <strong>{{
                          selected.standards?.carrier.name ??
                          selected.shipment?.carrier ??
                          "待补"
                        }}</strong></span
                      >
                      <span
                        >船名/航次
                        <strong
                          >{{ selected.shipment?.vessel ?? "待补" }} /
                          {{ selected.shipment?.voyage ?? "待补" }}</strong
                        ></span
                      >
                    </div>
                  </div>
                </div>
              </section>
            </div>
            <div class="case-dock">
              <ol class="progress-rail" aria-label="运输环节">
                <li
                  v-for="node in progressNodes"
                  :key="node.code"
                  class="rail-node"
                  :data-state="node.state"
                >
                  <span class="rail-mark" aria-hidden="true"></span>
                  <span class="rail-body">
                    <span class="rail-name">{{ node.name }}</span>
                    <small v-if="node.place">{{ node.place }}</small>
                  </span>
                  <span class="rail-when">
                    <span class="rail-state">{{
                      node.state === "current"
                        ? `当前 · ${node.stateLabel}`
                        : node.stateLabel
                    }}</span>
                    <strong v-if="node.date" class="rail-date">{{
                      node.date
                    }}</strong>
                    <span v-if="node.kind" class="rail-kind">{{
                      node.kind
                    }}</span>
                    <span v-if="node.pending" class="rail-pending">{{
                      node.pending
                    }}</span>
                  </span>
                </li>
              </ol>
            </div>
          </div>
          <p v-else-if="loadingObject" class="loading-state" role="status">
            正在读取运输事项...
          </p>
          <div v-else class="empty-state">
            <p>{{ error || "从运输待办选择一票运输，查看事实与依据。" }}</p>
            <button
              v-if="selectedId"
              class="reread"
              type="button"
              @click="rereadCurrent"
            >
              重新读取运输事项
            </button>
          </div>
        </WorkbenchPane>
      </template>
      <template #context>
        <WorkbenchPane
          id="ocean-context"
          title="关注与办理"
          region-label="到港准备操作上下文"
        >
          <div v-if="error && !generalError" class="error-banner" role="alert">
            {{ error }}
          </div>
          <div v-if="selected" class="context-flow">
            <div class="context-tabs" role="tablist" aria-label="关注办理">
              <button
                v-for="tab in contextTabs"
                :key="tab.id"
                type="button"
                role="tab"
                :data-tab="tab.id"
                :aria-selected="contextTab === tab.id"
                @click="selectTab(tab.id)"
              >
                {{ tab.label }}
              </button>
            </div>
            <div class="context-body">
              <section
                v-if="contextTab === 'progress'"
                class="focus-context flow-section"
                aria-label="航运日期与记录"
              >
                <h2>运输进展</h2>
                <div class="deadline-row" aria-label="航运日期">
                  <div v-for="item in voyageDates" :key="item.code">
                    <span>{{ item.name }}</span>
                    <strong :data-known="item.known">{{ item.value }}</strong>
                  </div>
                </div>
                <div class="deadline-row" aria-label="期限与滞港费">
                  <div v-for="item in watchDates" :key="item.code">
                    <span>{{ item.name }}</span>
                    <strong :data-known="item.known">{{ item.value }}</strong>
                  </div>
                </div>
                <h2>日期记录</h2>
                <p v-if="visibleDateRecords.length === 0" class="focus-lead">
                  尚未记录日期修改
                </p>
                <ul v-else class="date-records">
                  <li v-for="(item, index) in visibleDateRecords" :key="index">
                    <strong>{{ item.kind }}</strong>
                    <span>{{ item.value }}</span>
                    <small v-if="item.note">{{ item.note }}</small>
                  </li>
                </ul>
                <form class="date-form" @submit.prevent="recordDate">
                  <label>
                    日期
                    <select v-model="dateKind">
                      <option>ETD</option>
                      <option>ATD</option>
                      <option>ETA</option>
                      <option>ATA</option>
                      <option>最晚清关</option>
                      <option>最晚提柜</option>
                      <option>最晚还箱</option>
                    </select>
                  </label>
                  <label>
                    记录值
                    <input v-model="dateValue" type="date" required />
                  </label>
                  <label>
                    说明
                    <input
                      v-model="dateNote"
                      type="text"
                      placeholder="说明这次记录或修改"
                    />
                  </label>
                  <button class="primary" type="submit">记录日期</button>
                </form>
              </section>
              <section
                v-if="contextTab === 'route_risk'"
                class="focus-context flow-section"
                aria-label="风险"
              >
                <h2>风险</h2>
                <ol class="risk-signals">
                  <li v-for="signal in riskSignals" :key="signal.code">
                    <div>
                      <strong>{{ signal.name }}</strong>
                      <b :data-status="signal.status">{{ signal.status }}</b>
                    </div>
                    <span>依据 {{ signal.evidence }}</span>
                    <small>影响 {{ signal.impact }}</small>
                  </li>
                </ol>
              </section>
              <section
                v-if="contextTab === 'coordination'"
                class="focus-context flow-section coordination-thread"
                aria-label="下游信息与协同"
              >
                <h2>下游信息与协同</h2>
                <TaskContextPanel
                  v-model="collaborationMode"
                  :context-key="
                    collaborationContext?.contextKey ??
                    selected?.container.id ??
                    null
                  "
                  :modes="collaborationModes"
                  :collaboration="collaboration"
                  :ai="aiPanel"
                  @submit="submitCollaboration"
                  @retry="retryCollaboration"
                  @load-more="loadMoreCollaboration"
                  @confirm-ai="confirmAi"
                  @reject-ai="rejectAi"
                  @retry-ai="retryAi"
                  @refresh-ai="refreshAi"
                />
              </section>
              <section
                v-if="contextTab === 'information'"
                class="side-facts flow-section"
                aria-label="清关资料与发送"
              >
                <div class="customs-head">
                  <div>
                    <h2>清关资料与附件</h2>
                    <p v-if="customsChecklist.countryCode">
                      <span>国别</span>
                      <strong>{{
                        customsChecklist.countryName ??
                        customsChecklist.countryCode
                      }}</strong>
                    </p>
                    <p v-if="customsChecklist.known">
                      <span>必交</span>
                      <strong
                        >{{ customsChecklist.satisfiedCount }} /
                        {{ customsChecklist.requiredCount }} 已满足</strong
                      >
                    </p>
                    <p v-else>
                      <span>资料</span>
                      <strong data-known="false">该国别不在需求表内</strong>
                    </p>
                  </div>
                  <div class="broker-check">
                    <h2>发给清关行</h2>
                    <p>
                      <span>核验</span>
                      <strong data-known="false">未核验</strong>
                    </p>
                  </div>
                </div>
                <ul
                  v-if="customsChecklist.items.length"
                  class="document-checklist"
                >
                  <li
                    v-for="item in customsChecklist.items"
                    :key="item.code"
                    :title="
                      [item.ensFileRule, item.note].filter(Boolean).join(' ')
                    "
                  >
                    <span class="document-name">
                      <strong>{{ item.nameZh }}</strong>
                      <small>{{ item.nameEn }}</small>
                    </span>
                    <b :data-met="String(item.satisfied)">{{
                      checklistStatusLabel(item)
                    }}</b>
                    <AttachmentControl
                      :label="`${item.nameZh}附件`"
                      :model-value="filesFor(item.code)"
                      @update:model-value="setFiles(item.code, $event)"
                    />
                  </li>
                </ul>
              </section>
              <section
                v-if="contextTab === 'fees'"
                class="side-facts flow-section"
                aria-label="财务"
              >
                <h2>财务</h2>
                <p>
                  <span>海运费</span>
                  <strong>{{ costAmount ?? "尚未接入" }}</strong>
                  <small
                    v-if="
                      selected.financialProjection.costFee.status ===
                      'source_amount_pending_verification'
                    "
                    >待核</small
                  >
                </p>
                <p>
                  <span>滞港费</span>
                  <strong>{{ demurrageWatch.label }}</strong>
                  <small>{{ demurrageWatch.detail }}</small>
                </p>
              </section>
            </div>
          </div>

          <p v-else class="empty-state">
            {{
              loadingObject
                ? "正在读取办理上下文..."
                : "选择运输后显示允许办理的事项。"
            }}
          </p>
        </WorkbenchPane>
      </template>
      <template #contextRail
        ><span>{{ hasVersionConflict ? "重读" : "办理" }}</span></template
      >
    </WorkbenchLayout>
  </main>
</template>
<style scoped>
.ocean-operations-page {
  min-width: 0;
  color: var(--ink);
}

.ocean-operations-page :deep(.workbench-layout__decision) {
  display: none;
}

.page-status {
  display: flex;
  align-items: stretch;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
  overflow: hidden;
}

.page-status :deep(.responsibility-band) {
  flex: 1 1 auto;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.page-status :deep(.responsibility-band dl > div) {
  padding: var(--space-2) var(--space-3);
}

.page-status :deep(.decision-strip) {
  flex: 0 1 24rem;
  grid-template-columns: minmax(0, 1fr);
  align-content: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border: 0;
  border-left: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
}

.page-status :deep(.decision-strip__conclusion) {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2);
}

.queue-pane,
.case-flow,
.context-flow {
  min-width: 0;
  padding: var(--space-3);
}

.queue-pane {
  display: grid;
  gap: var(--space-3);
}

.context-flow {
  height: 100%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--space-3);
  overflow: hidden;
}

.context-tabs {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--space-1);
  border-bottom: 1px solid var(--line);
}

.context-tabs button {
  min-width: 0;
  min-height: var(--touch-target);
  padding: var(--space-2) var(--space-1);
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--ink-soft);
  font: inherit;
  font-size: var(--text-label);
  cursor: pointer;
}

.context-tabs button[aria-selected="true"] {
  border-color: var(--brand-line);
  background: var(--surface);
  color: var(--brand-strong);
  font-weight: 700;
}

.context-body {
  min-height: 0;
  overflow-y: auto;
}

.case-flow {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow: hidden;
}

.case-scroll {
  flex: 0 0 auto;
  overflow: visible;
}

.case-dock {
  display: grid;
  gap: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--line);
}

.case-dock .deadline-row {
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
}

.flow-section {
  min-width: 0;
  padding: var(--space-4) 0;
  border-bottom: 1px solid var(--line);
}

.flow-section:first-child {
  padding-top: 0;
}

.section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}

.section-heading h2 {
  margin: 0;
  color: var(--ink);
  font-size: var(--text-title);
  font-weight: 600;
  line-height: var(--leading-title);
}

.queue-item {
  display: grid;
  gap: var(--space-1);
  width: 100%;
  padding: var(--space-3);
  text-align: left;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
  transition: background-color var(--motion-fast);
}

.queue-item:hover {
  background: var(--surface-2);
}

.queue-item.selected {
  border-color: var(--brand-line);
  box-shadow: inset 3px 0 var(--brand);
  background: var(--brand-soft);
}

.queue-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  min-width: 0;
}

.queue-kicker,
.eyebrow,
.queue-item small,
.date-label {
  color: var(--muted);
  font-size: var(--text-label);
  font-weight: 400;
  line-height: var(--leading-title);
}

.queue-item strong {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: var(--text-title);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: var(--leading-title);
}

.queue-item.selected .queue-kicker {
  color: var(--brand-strong);
}

.error-banner {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--risk-bg);
  color: var(--risk);
  border-left: 3px solid var(--risk);
}

.error-banner button,
.refresh-current,
.reread {
  justify-self: start;
  border: 1px solid currentColor;
  border-radius: var(--radius-control);
  background: var(--surface);
  color: inherit;
  padding: var(--space-1) var(--space-2);
  cursor: pointer;
  font: inherit;
}

.refresh-current {
  color: var(--brand-strong);
  border-color: var(--brand-line);
}

.transport-summary {
  margin-top: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--brand-line);
  border-radius: var(--radius-card);
  background: var(--surface);
  container-type: inline-size;
}

.voyage-dates {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  padding-bottom: var(--space-4);
}

.voyage-dates > div {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}

.voyage-dates strong,
.actual-date {
  display: grid;
  gap: var(--space-1);
  font-weight: 400;
}

.voyage-dates time,
.voyage-dates strong > span:not(.date-label),
.actual-date > span:not(.date-label) {
  color: var(--ink);
  font-size: var(--text-page);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: var(--leading-tight);
  white-space: nowrap;
}

.actual-date > span:not(.date-label),
.actual-date time {
  color: var(--ink-soft);
  font-size: var(--text-title);
  font-weight: 600;
}

.arrival-dates {
  text-align: right;
}

.arrival-dates strong,
.arrival-dates .actual-date {
  justify-items: end;
}

.route-line {
  display: grid;
  grid-template-columns: minmax(0, auto) minmax(0, 1fr) minmax(0, auto);
  align-items: center;
  gap: var(--space-3);
}

.route-port {
  display: grid;
  gap: var(--space-1);
}

.route-port--destination {
  text-align: right;
}

.route-port strong {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--ink);
  font-size: var(--text-page);
  font-weight: 700;
  line-height: var(--leading-tight);
}

.route-port--destination strong {
  justify-content: end;
}

.route-port strong svg {
  flex-shrink: 0;
  color: var(--brand);
}

.route-port > span,
.route-port small {
  color: var(--muted);
  font-size: var(--text-label);
  line-height: var(--leading-title);
}

.route-port small {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.route-journey {
  display: grid;
  gap: var(--space-2);
  align-self: stretch;
  align-content: center;
  min-width: 4.5rem;
}

.route-status {
  min-width: 0;
  text-align: center;
  color: var(--ink);
  font-size: var(--text-label);
  font-weight: 600;
  line-height: var(--leading-title);
}

.route-track {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 16px;
  margin: var(--space-1) 0;
}

.route-track::before {
  content: "";
  position: absolute;
  top: 50%;
  right: 0;
  left: 0;
  height: 2px;
  background: var(--brand);
  transform: translateY(-50%);
}

.route-track span,
.route-track svg {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  background: var(--surface);
}

.route-track span {
  width: 8px;
  height: 8px;
  border: 2px solid var(--brand);
  border-radius: 50%;
  background: var(--brand);
  box-shadow: 0 0 0 3px var(--surface);
}

.route-track svg {
  color: var(--brand);
  padding: 0 var(--space-1);
}

.transport-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4) var(--space-3);
  margin-top: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid var(--line);
}

.transport-identity,
.transport-vessel {
  display: contents;
}

.transport-identity > span,
.transport-vessel > span {
  display: grid;
  align-content: start;
  gap: var(--space-1);
  min-width: 0;
  color: var(--muted);
  font-size: var(--text-label);
  line-height: var(--leading-title);
}

.transport-identity strong,
.transport-vessel strong {
  color: var(--ink);
  overflow-wrap: anywhere;
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: var(--leading-title);
}

@container (max-width: 350px) {
  .voyage-dates time,
  .voyage-dates strong > span:not(.date-label) {
    font-size: var(--text-title);
  }

  .route-port strong {
    font-size: var(--text-title);
  }

  .route-port strong svg {
    display: none;
  }

  .route-line {
    gap: var(--space-2);
  }

  .transport-facts {
    grid-template-columns: 1fr;
  }
}

.focus-list {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: var(--space-2);
}

.focus-item {
  display: grid;
  grid-template-columns: 12px minmax(0, 1fr);
  align-items: start;
  gap: var(--space-2);
  min-width: 0;
  min-height: var(--touch-target);
  padding: var(--space-2);
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
}

.focus-item:hover {
  background: var(--surface-2);
}

.focus-item[aria-pressed="true"] {
  background: var(--brand-soft);
}

.focus-mark {
  width: 8px;
  height: 8px;
  justify-self: center;
  border: 2px solid var(--brand);
  border-radius: 50%;
  background: var(--brand);
  box-shadow: 0 0 0 3px var(--surface);
}

.focus-item:hover .focus-mark {
  box-shadow: 0 0 0 3px var(--surface-2);
}

.focus-item[aria-pressed="true"] .focus-mark {
  box-shadow: 0 0 0 3px var(--brand-soft);
}

.focus-item[data-status="unavailable"] .focus-mark {
  border-color: var(--line-strong);
  background: var(--surface);
}

.focus-item[data-status="unavailable"]:hover .focus-mark {
  background: var(--surface-2);
}

.focus-item[data-status="unavailable"][aria-pressed="true"] .focus-mark {
  background: var(--brand-soft);
}

.focus-item[data-status="attention"] .focus-mark {
  border-color: var(--warn);
  background: var(--warn);
}

.focus-copy {
  display: grid;
  gap: 0;
  min-width: 0;
}

.focus-copy strong {
  font-size: var(--text-meta);
  font-weight: 600;
  line-height: var(--leading-title);
}

.focus-copy small,
.muted {
  color: var(--muted);
  font-size: var(--text-label);
  line-height: var(--leading-title);
}

.focus-item[data-status="unavailable"]:not([aria-pressed="true"])
  .focus-copy
  strong {
  color: var(--ink-soft);
  font-weight: 400;
}

.focus-readout {
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: var(--text-label);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: var(--leading-tight);
}

.focus-item[data-status="attention"] small {
  color: var(--warn);
  font-weight: 600;
}

.focus-context {
  display: grid;
  gap: var(--space-3);
  overflow-wrap: anywhere;
}

.risk-signals {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
}

.risk-signals li {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--line);
}

.risk-signals span,
.risk-signals small {
  color: var(--ink-soft);
  font-size: var(--text-label);
}

.risk-signals strong {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
}

.risk-signals {
  list-style: none;
}

.risk-signals li > div {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2);
}

.risk-signals b {
  flex: 0 0 auto;
  font-size: var(--text-label);
  font-weight: 600;
}

.risk-signals b[data-status="未接入"],
.risk-signals b[data-status="未知"] {
  color: var(--ink-soft);
  font-weight: 400;
}

.coordination-thread :deep(.task-context__modes) {
  grid-template-columns: repeat(2, max-content);
}

.coordination-thread :deep(.collaboration__boundary p) {
  display: none;
}

.focus-context h2 {
  margin: 0;
  font-size: var(--text-title);
  font-weight: 600;
  line-height: var(--leading-title);
}

.focus-context p {
  margin: 0;
}

.focus-lead {
  margin: 0;
  color: var(--ink);
  font-size: var(--text-body);
  line-height: var(--leading-body);
}

.progress-rail {
  position: relative;
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.deadline-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--line);
}

.deadline-row div {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}

.deadline-row span {
  color: var(--muted);
  font-size: var(--text-label);
  line-height: var(--leading-title);
}

.deadline-row strong {
  color: var(--ink);
  font-size: var(--text-meta);
  font-weight: 600;
  line-height: var(--leading-title);
}

.deadline-row strong[data-known="false"] {
  color: var(--ink-soft);
  font-weight: 400;
}

.date-records {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.date-records li {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: baseline;
}

.date-form {
  display: grid;
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.date-form label {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
  font-weight: 600;
}

.progress-rail::before {
  content: "";
  position: absolute;
  top: 18px;
  bottom: 18px;
  left: 7px;
  width: 2px;
  background: var(--brand-line);
}

.rail-node {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  min-height: var(--touch-target);
  padding: var(--space-2) 0;
}

.rail-mark {
  width: 8px;
  height: 8px;
  justify-self: center;
  border: 2px solid var(--brand);
  border-radius: 50%;
  background: var(--surface);
  box-shadow: 0 0 0 3px var(--surface);
}

.rail-node[data-state="done"] .rail-mark,
.rail-node[data-state="current"] .rail-mark {
  background: var(--brand);
}

.rail-node[data-state="current"] .rail-mark {
  box-shadow: 0 0 0 3px var(--brand-soft);
}

.rail-node[data-state="ahead"] .rail-mark,
.rail-node[data-state="unknown"] .rail-mark {
  border-color: var(--line-strong);
}

.rail-body,
.rail-when {
  display: grid;
  gap: 0;
  min-width: 0;
}

.rail-when {
  justify-items: end;
  text-align: right;
}

.rail-name {
  font-size: var(--text-body);
  font-weight: 600;
  line-height: var(--leading-title);
}

.rail-body small,
.rail-kind,
.rail-pending,
.rail-state {
  color: var(--muted);
  font-size: var(--text-label);
  line-height: var(--leading-title);
}

.rail-node[data-state="current"] .rail-state {
  color: var(--brand-strong);
  font-weight: 600;
}

.rail-date {
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: var(--text-title);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: var(--leading-tight);
}

.rail-node[data-state="ahead"] .rail-date,
.rail-node[data-state="unknown"] .rail-date {
  color: var(--ink-soft);
  font-weight: 600;
}

.context-summary {
  display: grid;
  gap: var(--space-2);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--line);
}

.context-summary small {
  overflow-wrap: anywhere;
  color: var(--muted);
}

.context-summary span {
  color: var(--ink-soft);
  font-size: var(--text-label);
  line-height: var(--leading-dense);
}

.assessment-details {
  margin-top: var(--space-3);
}

summary {
  cursor: pointer;
  font-weight: 600;
}

.observation {
  display: flex;
  align-items: start;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding: var(--space-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface);
}

.observation:has(input:checked) {
  border-color: var(--brand-line);
  background: var(--brand-soft);
}

.observation span {
  overflow-wrap: anywhere;
}

.observation small {
  display: block;
  margin-top: var(--space-1);
  color: var(--muted);
}

.form-grid {
  display: grid;
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.form-grid label {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
  font-weight: 600;
}

select,
textarea,
.date-form input {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  padding: var(--space-2);
  font: inherit;
  background: var(--surface);
  color: var(--ink);
}

select {
  min-height: var(--touch-target);
}

textarea {
  resize: vertical;
  min-height: 72px;
  line-height: var(--leading-body);
}

.primary {
  width: 100%;
  margin-top: var(--space-3);
  min-height: var(--touch-target);
  border: 0;
  border-radius: var(--radius-control);
  padding: var(--space-2) var(--space-3);
  background: var(--brand);
  color: var(--on-brand);
  font-weight: 600;
  cursor: pointer;
}

.primary:hover:not(:disabled) {
  background: var(--brand-strong);
}

.primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.recovery {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding: var(--space-3);
  border-left: 3px solid var(--risk);
  background: var(--risk-bg);
  color: var(--risk);
}

.recovery p {
  margin: 0;
}

.side-facts {
  display: grid;
  gap: var(--space-2);
}

.customs-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--space-3);
}

.broker-check {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
}

.side-facts h2 {
  margin: 0;
  font-size: var(--text-meta);
  font-weight: 600;
  line-height: var(--leading-title);
}

.side-facts p {
  display: grid;
  grid-template-columns: 4rem minmax(0, 1fr);
  gap: var(--space-1) var(--space-2);
  margin: 0;
  align-items: baseline;
}

.side-facts p span {
  color: var(--muted);
  font-size: var(--text-label);
  line-height: var(--leading-title);
}

.side-facts p strong {
  font-size: var(--text-body);
  font-weight: 600;
}

.side-facts p strong[data-known="false"] {
  color: var(--ink-soft);
  font-weight: 400;
}

.document-checklist {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.document-checklist > li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--touch-target);
  padding-top: var(--space-2);
  border-top: 1px solid var(--line);
}

.document-name {
  display: flex;
  min-width: 0;
  gap: var(--space-2);
  align-items: baseline;
  white-space: nowrap;
}

.document-name strong {
  overflow: hidden;
  text-overflow: ellipsis;
}

.document-name small {
  color: var(--ink-soft);
  font-size: var(--text-label);
  line-height: var(--leading-body);
}

.document-checklist b[data-met="false"] {
  color: var(--ink-soft);
  font-weight: 400;
}

.side-facts p small {
  grid-column: 2;
  color: var(--ink-soft);
  font-size: var(--text-label);
  line-height: var(--leading-dense);
}

.recorded-facts {
  display: grid;
  gap: var(--space-2);
}

.recorded-facts p {
  margin: 0;
  color: var(--ink);
  font-size: var(--text-body);
  line-height: var(--leading-body);
}

.empty-state,
.loading-state {
  padding: var(--space-3);
  color: var(--muted);
}

button:focus-visible,
select:focus-visible,
textarea:focus-visible,
summary:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .queue-item,
  .focus-item {
    transition: none;
  }
}
</style>
