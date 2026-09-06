import { computed, reactive } from "vue";
import {
  createContainerSeed,
  createExceptionSeed,
  createSubmissionSeed,
  createTaskSeed,
  type ContainerProjection,
  type ExceptionRecord,
  type OperationRecord,
  type StatusView,
  type SubmissionView,
  type TaskAction,
  type TaskItem,
} from "../data/sample";
import { getTaskStatusLanguage } from "../data/taskLanguageCatalog";

interface DemoOperationsState {
  containers: ContainerProjection[];
  tasks: TaskItem[];
  submissions: Record<string, SubmissionView>;
  operations: OperationRecord[];
  exceptions: ExceptionRecord[];
  sequence: number;
}

interface EventProjectionRule {
  from: string;
  to: string;
  label: string;
  tone: StatusView["tone"];
  nodeKey: string;
  nextNodeKey?: string;
  nextActionHint: string;
}

const eventProjectionRules: Record<string, EventProjectionRule> = {
  arrived: {
    from: "in_transit",
    to: "at_port",
    label: "已到港",
    tone: "warn",
    nodeKey: "arrival",
    nextNodeKey: "pickup",
    nextActionHint: "核对放行、码头可提、费用和预约条件。",
  },
  unloaded: {
    from: "picked_up",
    to: "unloaded",
    label: "已卸柜",
    tone: "ok",
    nodeKey: "unload",
    nextNodeKey: "unstuff",
    nextActionHint: "核验货柜已卸空及箱况，再安排还箱。",
  },
};

const createState = (): DemoOperationsState => ({
  containers: createContainerSeed(),
  tasks: createTaskSeed(),
  submissions: createSubmissionSeed(),
  operations: [],
  exceptions: createExceptionSeed(),
  sequence: 0,
});

const state = reactive<DemoOperationsState>(createState());
const containers = computed(() => state.containers);
const tasks = computed(() => state.tasks);
const submissions = computed(() => state.submissions);
const operations = computed(() => state.operations);
const exceptions = computed(() => state.exceptions);

const nowLabel = () =>
  new Date().toLocaleTimeString("zh-CN", { hour12: false });
const nextId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36).toUpperCase()}_${++state.sequence}`;
const getTask = (taskId: string) =>
  state.tasks.find((task) => task.taskId === taskId);
const getContainer = (containerRecordId: string) =>
  state.containers.find(
    (container) => container.containerRecordId === containerRecordId,
  );

const updateTaskProjection = (task: TaskItem) => {
  const container = getContainer(task.containerRecordId);
  if (!container) return;
  const language = getTaskStatusLanguage(task.status);
  container.taskStatus = {
    code: task.status,
    label: language.label,
    tone: language.tone,
    changedAt: nowLabel(),
  };
};

const updateSyncProjection = (task: TaskItem, submission: SubmissionView) => {
  const container = getContainer(task.containerRecordId);
  if (!container) return;
  const labels: Record<SubmissionView["stage"], string> = {
    idle: "无待确认操作",
    sending: "正在提交",
    received: "请求已接收·校验中",
    accepted: "业务已接受·待落账",
    committed: "操作事实已落账",
    rejected: "业务拒绝·需处理",
  };
  const tones: Record<SubmissionView["stage"], StatusView["tone"]> = {
    idle: "muted",
    sending: "warn",
    received: "warn",
    accepted: "warn",
    committed: "ok",
    rejected: "risk",
  };
  container.syncStatus = {
    code: submission.stage,
    label: labels[submission.stage],
    tone: tones[submission.stage],
    changedAt:
      submission.committedAt ??
      submission.acceptedAt ??
      submission.receivedAt ??
      nowLabel(),
  };
};

const saveSubmission = (task: TaskItem, submission: SubmissionView) => {
  state.submissions[task.taskId] = submission;
  updateSyncProjection(task, submission);
  return submission;
};

const recordOperation = (
  task: TaskItem,
  submission: SubmissionView,
  payloadSummary?: string,
) => {
  if (!submission.actionCode) return;
  state.operations.push({
    ...submission,
    taskId: task.taskId,
    actionCode: submission.actionCode,
    actor: task.assignment.assignee ?? "当前员工",
    payloadSummary,
  });
};

const commitImmediate = (
  task: TaskItem,
  actionCode: string,
  message: string,
  resultPrefix: string,
  apply: () => void,
  payloadSummary?: string,
) => {
  const timestamp = nowLabel();
  const suffix = nextId(resultPrefix);
  apply();
  const submission = saveSubmission(task, {
    taskId: task.taskId,
    actionCode,
    stage: "committed",
    clientOperationId: nextId("op"),
    traceId: nextId("tr"),
    receivedAt: timestamp,
    acceptedAt: timestamp,
    committedAt: timestamp,
    message,
    resultRef: suffix,
  });
  updateTaskProjection(task);
  recordOperation(task, submission, payloadSummary);
};

const rejectImmediate = (
  task: TaskItem,
  actionCode: string,
  message: string,
  errorCode: string,
) => {
  const submission = saveSubmission(task, {
    taskId: task.taskId,
    actionCode,
    stage: "rejected",
    clientOperationId: nextId("op"),
    traceId: nextId("tr"),
    receivedAt: nowLabel(),
    message,
    errorCode,
  });
  recordOperation(task, submission);
};

const claimTask = (taskId: string) => {
  const task = getTask(taskId);
  if (!task || task.assignment.mode !== "pool" || task.assignment.assignee)
    return;
  commitImmediate(
    task,
    "candidate_claim_task",
    "任务领取事实已落账",
    "assignment",
    () => {
      task.assignment.assignee = "当前员工";
      task.status = "in_progress";
    },
  );
};

const acknowledgeInput = (taskId: string, inputId: string) => {
  const task = getTask(taskId);
  const input = task?.requiredInputs.find((item) => item.id === inputId);
  if (!task || !input || input.state === "missing" || input.state === "ready")
    return;
  commitImmediate(
    task,
    "candidate_acknowledge_task_input",
    `${input.label}确认事实已落账`,
    "input",
    () => {
      input.state = "ready";
    },
    input.id,
  );
};

const verifyEvidence = (taskId: string, evidenceId: string, value?: string) => {
  const task = getTask(taskId);
  const evidence = task?.evidenceRequirements.find(
    (item) => item.id === evidenceId,
  );
  if (
    !task ||
    !evidence ||
    evidence.kind === "external_event" ||
    evidence.kind === "receipt"
  )
    return;

  if (evidence.kind === "scan") {
    const normalized = (value ?? "").replace(/[-\s]/g, "").toUpperCase();
    if (!evidence.expectedValue || normalized !== evidence.expectedValue) {
      evidence.state = "pending";
      evidence.validationMessage = `扫描结果与任务货柜 ${task.containerNumber} 不一致`;
      rejectImmediate(
        task,
        "candidate_verify_container_identity",
        evidence.validationMessage,
        "TASK_CONTAINER_MISMATCH",
      );
      return;
    }
  }

  if (evidence.kind === "photo" && !value) {
    evidence.validationMessage = "请选择实际照片后再记录证据";
    rejectImmediate(
      task,
      "candidate_verify_task_evidence",
      evidence.validationMessage,
      "TASK_EVIDENCE_MISSING",
    );
    return;
  }

  commitImmediate(
    task,
    "candidate_verify_task_evidence",
    `${evidence.label}验证事实已落账`,
    "evidence",
    () => {
      evidence.state = "verified";
      evidence.capturedValue = value ?? "人工确认";
      evidence.validationMessage = undefined;
    },
    evidence.id,
  );
};

const startOperation = (
  taskId: string,
  actionCode: string,
  existingOperationId?: string,
) => {
  const task = getTask(taskId);
  if (!task) return;
  return saveSubmission(task, {
    taskId,
    actionCode,
    stage: "sending",
    clientOperationId: existingOperationId ?? nextId("op"),
    message: existingOperationId
      ? "正在使用原操作编号重试"
      : "正在提交；未获得可靠回执前不会计入完成",
  });
};

const markReceived = (taskId: string) => {
  const task = getTask(taskId);
  const submission = state.submissions[taskId];
  if (!task || !submission) return;
  Object.assign(submission, {
    stage: "received",
    traceId: submission.traceId ?? nextId("tr"),
    receivedAt: submission.receivedAt ?? nowLabel(),
    message: "请求已可靠接收，正在校验权限、任务版本和证据",
    canRetry: false,
  });
  updateSyncProjection(task, submission);
};

const markAccepted = (taskId: string, action: TaskAction) => {
  const task = getTask(taskId);
  const submission = state.submissions[taskId];
  if (!task || !submission) return;
  Object.assign(submission, {
    stage: "accepted",
    acceptedAt: nowLabel(),
    message:
      action.intent === "exception"
        ? "异常上报已受理，等待异常事实落账"
        : "业务操作已接受，等待事实落账",
  });
  if (action.intent === "complete") {
    task.status = "reported";
    updateTaskProjection(task);
  }
  updateSyncProjection(task, submission);
};

const applyContainerEvent = (
  task: TaskItem,
  eventCode: string,
  resultRef: string,
) => {
  const container = getContainer(task.containerRecordId);
  const rule = eventProjectionRules[eventCode];
  if (!container || !rule || container.currentStatus.code !== rule.from)
    return false;

  const timestamp = nowLabel();
  container.currentStatus = {
    code: rule.to,
    label: rule.label,
    tone: rule.tone,
    changedAt: timestamp,
  };
  container.currentNode = task.nodeName;
  container.nextActionHint = rule.nextActionHint;
  container.rail.forEach((node) => {
    node.isCurrentStatus = node.key === rule.nodeKey;
    if (node.key === rule.nodeKey) {
      node.phase = "done";
      node.attention = undefined;
      node.actual = timestamp;
      node.evidence = `任务结果事件 ${eventCode}`;
    } else if (node.key === rule.nextNodeKey && node.phase === "pending") {
      node.attention = "current";
    }
  });
  container.timeline.push({
    eventCode,
    label: rule.label,
    actual: `实际 ${timestamp}`,
    evidence: `任务 ${task.taskId} 已确认结果`,
    eventRef: resultRef,
  });
  return true;
};

const commitTaskResult = (taskId: string, action: TaskAction) => {
  const task = getTask(taskId);
  const submission = state.submissions[taskId];
  if (!task || !submission) return false;
  const resultRef = nextId("result");
  const eventCode = task.completionPolicy.resultEventCode;

  if (
    eventCode &&
    task.completionPolicy.advancesContainerStatus &&
    !applyContainerEvent(task, eventCode, resultRef)
  ) {
    Object.assign(submission, {
      stage: "rejected",
      message: "货柜状态或版本已变化，请刷新后重新核对",
      errorCode: "CONTAINER_VERSION_CONFLICT",
      canRetry: false,
    });
    task.status = "in_progress";
    updateTaskProjection(task);
    updateSyncProjection(task, submission);
    recordOperation(task, submission);
    return false;
  }

  if (task.completionPolicy.outcome === "waiting_external") {
    task.status = "waiting_external";
    submission.message = "发送事实已落账，正在等待外部业务受理";
  } else {
    task.status = "completed";
    submission.message = eventCode
      ? `业务事件 ${eventCode} 已落账，任务完成`
      : "任务结果已落账；本任务不直接推进货柜状态";
  }

  Object.assign(submission, {
    stage: "committed",
    committedAt: nowLabel(),
    resultRef,
    resultEventCode: eventCode,
    errorCode: undefined,
    canRetry: false,
  });
  updateTaskProjection(task);
  updateSyncProjection(task, submission);
  recordOperation(task, submission, action.actionCode);
  return true;
};

const commitException = (
  taskId: string,
  action: TaskAction,
  detail: string,
) => {
  const task = getTask(taskId);
  const submission = state.submissions[taskId];
  if (!task || !submission) return;
  const resultRef = nextId("exception");
  state.exceptions.push({
    id: `EX-${String(state.sequence).padStart(6, "0")}`,
    containerRecordId: task.containerRecordId,
    sourceTaskId: task.taskId,
    issue: detail,
    owner: task.assignment.assignee ?? "待分派",
    status: "reported",
    statusLabel: "已上报·待分派",
    reportedAt: new Date().toISOString(),
    dueAt: "待确定",
    next: "确认影响范围并分派处置责任人",
    resultRef,
  });

  if (!["completed", "waiting_external"].includes(task.status)) {
    task.status = "blocked";
    updateTaskProjection(task);
  }
  Object.assign(submission, {
    stage: "committed",
    committedAt: nowLabel(),
    resultRef,
    message: "异常事实已落账；原任务事实与历史已保留",
    canRetry: false,
  });
  updateSyncProjection(task, submission);
  recordOperation(task, submission, detail);
};

const markRetryable = (taskId: string, message: string) => {
  const task = getTask(taskId);
  const submission = state.submissions[taskId];
  if (!task || !submission) return;
  submission.canRetry = true;
  submission.message = message;
  updateSyncProjection(task, submission);
};

export const resetDemoOperations = () => {
  Object.assign(state, createState());
};

export function useDemoOperationsStore() {
  return {
    containers,
    tasks,
    submissions,
    operations,
    exceptions,
    getTask,
    getContainer,
    claimTask,
    acknowledgeInput,
    verifyEvidence,
    startOperation,
    markReceived,
    markAccepted,
    commitTaskResult,
    commitException,
    markRetryable,
  };
}
