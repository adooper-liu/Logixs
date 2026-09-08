import type { DisplayFieldSchema } from "../components/ui/displayFieldContract";
import type {
  AchievementCalendarDimension,
  AchievementCalendarView,
} from "../components/management/achievementCalendarContract";
import type { RaciNodeRow } from "./raciContract";

export type Tone = "ok" | "warn" | "risk" | "info" | "muted";

export interface StatusView {
  code: string;
  label: string;
  tone: Tone;
  changedAt?: string;
}

export interface WorkNode {
  key: string;
  name: string;
  phase: "done" | "pending" | "optional" | "skipped";
  isCurrentStatus?: boolean;
  attention?: "current" | "warn" | "risk";
  planned?: string;
  estimated?: string;
  actual?: string;
  note?: string;
  sourceSystem?: string;
  ingestionChannel?: string;
  evidence?: string;
  taskId?: string;
}

export interface CheckItem {
  q: string;
  state: "ok" | "warn" | "risk";
  answer: string;
  action: string;
}

export interface EventRow {
  eventCode: string;
  label: string;
  planned?: string;
  estimated?: string;
  actual?: string;
  evidence?: string;
  eventRef?: string;
}

export interface ContainerProjection {
  containerRecordId: string;
  containerNumber: string;
  orderNumber: string;
  billOfLading: string;
  typeCode: string;
  nodeDisplaySchema: DisplayFieldSchema;
  currentNode: string;
  currentStatus: StatusView;
  taskStatus: StatusView;
  syncStatus: StatusView;
  location: string;
  markers: { key: string; name: string }[];
  nextActionHint: string;
  freeDaysLeft?: number;
  eta: string;
  actualAt?: string;
  risk: string;
  tone: Tone;
  rail: WorkNode[];
  checklist: CheckItem[];
  timeline: EventRow[];
}

export type TaskExecutionMode = "human" | "system" | "external" | "hybrid";
export type TaskQueueKind = "human" | "monitor";
export type TaskStatusCode =
  | "available"
  | "in_progress"
  | "blocked"
  | "reported"
  | "waiting_external"
  | "under_review"
  | "completed";
export type SubmissionStage =
  "idle" | "sending" | "received" | "accepted" | "committed" | "rejected";
export type TaskAssignmentMode = "auto" | "assigned" | "pool" | "team";
export type TaskConditionState = "met" | "waiting" | "blocked";
export type TaskInputState = "ready" | "pending" | "missing";
export type TaskEvidenceKind =
  "scan" | "document" | "photo" | "checklist" | "external_event" | "receipt";
export type TaskEvidenceState = "pending" | "verified" | "waiting";
export type TaskCompletionOutcome =
  "complete" | "waiting_external" | "record_only";

export interface TaskAssignment {
  mode: TaskAssignmentMode;
  label: string;
  assignee?: string;
}

export interface TaskPrecondition {
  id: string;
  label: string;
  detail: string;
  state: TaskConditionState;
}

export interface TaskRequiredInput {
  id: string;
  label: string;
  detail: string;
  state: TaskInputState;
  actionLabel?: string;
}

export interface TaskEvidenceRequirement {
  id: string;
  label: string;
  detail: string;
  kind: TaskEvidenceKind;
  required: boolean;
  state: TaskEvidenceState;
  expectedValue?: string;
  capturedValue?: string;
  validationMessage?: string;
}

export interface TaskAction {
  actionCode: string;
  label: string;
  intent: "complete" | "exception";
  tone: "primary" | "secondary" | "danger";
  confirmation: "none" | "review";
  catalogStatus: "catalog" | "candidate";
  summary: string;
  defaultPayload?: { label: string; value: string }[];
}

export interface TaskCompletionPolicy {
  summary: string;
  outcome: TaskCompletionOutcome;
  resultEventCode?: string;
  advancesContainerStatus: boolean;
}

export interface TaskItem {
  taskId: string;
  taskDefinitionKey: string;
  taskDefinitionVersion: number;
  containerRecordId: string;
  containerNumber: string;
  orderNumber: string;
  nodeKey: string;
  nodeName: string;
  triggerReason: string;
  dueAt: string;
  status: TaskStatusCode;
  riskPriority: number;
  location: string;
  workCategory: string;
  executionMode: TaskExecutionMode;
  executionModeLabel: string;
  queueKind: TaskQueueKind;
  assignment: TaskAssignment;
  preconditions: TaskPrecondition[];
  requiredInputs: TaskRequiredInput[];
  evidenceRequirements: TaskEvidenceRequirement[];
  actions: TaskAction[];
  completionPolicy: TaskCompletionPolicy;
  risk?: string;
}

export interface SubmissionView {
  taskId?: string;
  actionCode?: string;
  stage: SubmissionStage;
  clientOperationId?: string;
  traceId?: string;
  receivedAt?: string;
  acceptedAt?: string;
  committedAt?: string;
  message?: string;
  resultSummary?: string;
  resultRef?: string;
  resultEventCode?: string;
  errorCode?: string;
  canRetry?: boolean;
}

export interface OperationRecord extends SubmissionView {
  taskId: string;
  actionCode: string;
  actor: string;
  payloadSummary?: string;
}

export interface ExceptionRecord {
  id: string;
  containerRecordId: string;
  sourceTaskId: string;
  issue: string;
  owner: string;
  status: "reported" | "assigned" | "resolved" | "verified_closed";
  statusLabel: string;
  reportedAt: string;
  dueAt: string;
  next: string;
  resultRef?: string;
}

export const railDefinitions = [
  ["ready", "备货就绪"],
  ["stuffing", "装箱定稿"],
  ["shipment", "出运"],
  ["depart", "离港"],
  ["sailing", "海运在途"],
  ["transit", "中转港(可选)"],
  ["customs", "清关"],
  ["arrival", "目的港到港"],
  ["rail", "海铁联运(可选)"],
  ["pickup", "拖卡提柜"],
  ["delivery", "送仓"],
  ["unload", "卸柜"],
  ["unstuff", "卸空"],
  ["return", "还箱"],
] as const;

// candidate 演示值；来源=框架 RACI 表 22→14 收敛，待负责人回验。
export const raciRows: RaciNodeRow[] = [
  {
    nodeKey: "ready",
    nodeName: "备货就绪",
    cells: [
      { role: "ops", code: "A" },
      { role: "forwarder", code: "R" },
      { role: "finance", code: "I" },
      { role: "sales", code: "C" },
      { role: "manager", code: "I" },
    ],
  },
  {
    nodeKey: "stuffing",
    nodeName: "装箱定稿",
    cells: [
      { role: "ops", code: "A" },
      { role: "warehouse", code: "R" },
      { role: "sales", code: "C" },
      { role: "manager", code: "I" },
    ],
  },
  {
    nodeKey: "shipment",
    nodeName: "出运",
    cells: [
      { role: "ops", code: "A" },
      { role: "forwarder", code: "R" },
      { role: "customs", code: "C" },
      { role: "trucking", code: "C" },
      { role: "finance", code: "I" },
      { role: "sales", code: "I" },
      { role: "manager", code: "I" },
    ],
  },
  {
    nodeKey: "depart",
    nodeName: "离港",
    cells: [
      { role: "ops", code: "A" },
      { role: "forwarder", code: "R" },
      { role: "sales", code: "I" },
      { role: "manager", code: "I" },
    ],
  },
  {
    nodeKey: "sailing",
    nodeName: "海运在途",
    cells: [
      { role: "ops", code: "A" },
      { role: "forwarder", code: "R" },
      { role: "sales", code: "I" },
      { role: "manager", code: "I" },
    ],
  },
  {
    nodeKey: "transit",
    nodeName: "中转港(可选)",
    cells: [
      { role: "ops", code: "A" },
      { role: "forwarder", code: "R" },
      { role: "sales", code: "I" },
      { role: "manager", code: "I" },
    ],
  },
  {
    nodeKey: "customs",
    nodeName: "清关",
    cells: [
      { role: "ops", code: "A" },
      { role: "forwarder", code: "C" },
      { role: "customs", code: "R" },
      { role: "finance", code: "C" },
      { role: "sales", code: "I" },
      { role: "manager", code: "I" },
    ],
  },
  {
    nodeKey: "arrival",
    nodeName: "目的港到港",
    cells: [
      { role: "ops", code: "A" },
      { role: "forwarder", code: "R" },
      { role: "customs", code: "I" },
      { role: "sales", code: "I" },
    ],
  },
  {
    nodeKey: "rail",
    nodeName: "海铁联运(可选)",
    cells: [
      { role: "ops", code: "A" },
      { role: "forwarder", code: "R" },
      { role: "trucking", code: "C" },
      { role: "sales", code: "I" },
      { role: "manager", code: "I" },
    ],
  },
  {
    nodeKey: "pickup",
    nodeName: "拖卡提柜",
    cells: [
      { role: "ops", code: "I" },
      { role: "forwarder", code: "C" },
      { role: "trucking", code: "A" },
    ],
  },
  {
    nodeKey: "delivery",
    nodeName: "送仓",
    cells: [
      { role: "ops", code: "A" },
      { role: "forwarder", code: "C" },
      { role: "trucking", code: "R" },
      { role: "sales", code: "I" },
      { role: "manager", code: "I" },
    ],
  },
  {
    nodeKey: "unload",
    nodeName: "卸柜",
    cells: [
      { role: "ops", code: "I" },
      { role: "trucking", code: "C" },
      { role: "warehouse", code: "A" },
    ],
  },
  {
    nodeKey: "unstuff",
    nodeName: "卸空",
    cells: [
      { role: "ops", code: "I" },
      { role: "trucking", code: "C" },
      { role: "warehouse", code: "A" },
    ],
  },
  {
    nodeKey: "return",
    nodeName: "还箱",
    cells: [
      { role: "ops", code: "I" },
      { role: "forwarder", code: "C" },
      { role: "trucking", code: "A" },
      { role: "finance", code: "I" },
    ],
  },
];

const nodeDisplaySchema: DisplayFieldSchema = {
  schemaId: "container-work-node",
  schemaVersion: 1,
  groups: [{ code: "nodeFacts", label: "节点事实", order: 1 }],
  fields: [
    {
      code: "planned",
      label: "计划",
      groupCode: "nodeFacts",
      type: "text",
      order: 10,
      emptyLabel: "未提供",
    },
    {
      code: "estimated",
      label: "预计",
      groupCode: "nodeFacts",
      type: "text",
      order: 20,
      emptyLabel: "未提供",
    },
    {
      code: "actual",
      label: "实际",
      groupCode: "nodeFacts",
      type: "text",
      order: 30,
      emptyLabel: "待发生",
    },
    {
      code: "sourceSystem",
      label: "事实来源",
      groupCode: "nodeFacts",
      type: "text",
      order: 40,
      emptyLabel: "尚无权威来源",
    },
    {
      code: "ingestionChannel",
      label: "接入渠道",
      groupCode: "nodeFacts",
      type: "text",
      order: 50,
      emptyLabel: "尚未接入",
    },
    {
      code: "evidence",
      label: "业务证据",
      groupCode: "nodeFacts",
      type: "text",
      order: 60,
      emptyLabel: "尚无已落账证据",
    },
  ],
};

const createRail = (overrides: Record<string, Partial<WorkNode>>): WorkNode[] =>
  railDefinitions.map(([key, name]) => ({
    key,
    name,
    phase: "pending",
    ...overrides[key],
  }));

// 脱敏演示投影。候选状态与动作只验证交互，不是正式 API、Seed 或生产规则。
export const createContainerSeed = (): ContainerProjection[] => [
  {
    containerRecordId: "cr_01J9LAX7K2D4",
    containerNumber: "TCLU-2387642",
    orderNumber: "24DSA1954",
    billOfLading: "MAEU254620074",
    typeCode: "40HQ",
    nodeDisplaySchema,
    currentNode: "目的港到港",
    currentStatus: {
      code: "at_port",
      label: "已到港",
      tone: "warn",
      changedAt: "09-09 06:40",
    },
    taskStatus: {
      code: "in_progress",
      label: "清关任务执行中",
      tone: "warn",
      changedAt: "09-10 09:18",
    },
    syncStatus: {
      code: "committed",
      label: "最近操作已落账",
      tone: "ok",
      changedAt: "09-10 09:18",
    },
    location: "洛杉矶港 WWT 码头",
    markers: [
      { key: "dangerous_goods", name: "危险品" },
      { key: "phytosanitary", name: "需植检" },
    ],
    nextActionHint: "补齐清关资料；放行事实落账后再派拖提柜",
    freeDaysLeft: 2,
    eta: "09-11",
    actualAt: "09-09",
    risk: "资料待补 · 免堆 2 天",
    tone: "risk",
    rail: createRail({
      ready: {
        phase: "done",
        actual: "08-01",
        sourceSystem: "计划系统",
        ingestionChannel: "文件导入",
        evidence: "备货单交接记录",
      },
      stuffing: {
        phase: "done",
        actual: "08-15",
        note: "40HQ · 66.2CBM · 42 托",
        sourceSystem: "装箱现场",
        ingestionChannel: "文件导入",
        evidence: "装箱单",
      },
      shipment: {
        phase: "done",
        actual: "08-18",
        sourceSystem: "船司",
        ingestionChannel: "文件导入",
        evidence: "装船确认",
      },
      depart: {
        phase: "done",
        actual: "08-18 14:20",
        sourceSystem: "船司",
        ingestionChannel: "API",
        evidence: "离港事件 ATD",
      },
      sailing: {
        phase: "done",
        estimated: "09-11",
        actual: "09-05",
        sourceSystem: "船司",
        ingestionChannel: "API",
        evidence: "航程事件",
      },
      transit: { phase: "skipped", note: "本航次未发生" },
      customs: {
        phase: "pending",
        attention: "risk",
        planned: "09-10",
        note: "ISF 待申报 · 单据 3/4",
        sourceSystem: "清关行",
        ingestionChannel: "人工录入",
        evidence: "任务记录 · 非海关放行事实",
        taskId: "task_1024",
      },
      arrival: {
        phase: "done",
        isCurrentStatus: true,
        estimated: "09-11",
        actual: "09-09 06:40",
        sourceSystem: "码头",
        ingestionChannel: "Webhook",
        evidence: "到港事件 ATA",
      },
      rail: { phase: "optional", note: "本柜未启用" },
      pickup: {
        phase: "pending",
        attention: "warn",
        planned: "最晚 09-12",
        note: "免费期剩余 2 天",
        taskId: "task_1025",
      },
      return: { phase: "pending", planned: "最晚 09-15" },
    }),
    checklist: [
      {
        q: "计划清关日期",
        state: "risk",
        answer: "09-10，今天到期",
        action: "今日处理",
      },
      {
        q: "清关作业",
        state: "warn",
        answer: "任务执行中",
        action: "跟进责任人",
      },
      {
        q: "单据传递",
        state: "warn",
        answer: "已传 3/4，缺 1 份",
        action: "补齐附件",
      },
      { q: "换单", state: "ok", answer: "业务事实已落账", action: "—" },
      { q: "ISF 申报", state: "risk", answer: "尚未报工", action: "执行申报" },
      {
        q: "异常",
        state: "warn",
        answer: "资料缺失待处理",
        action: "查看异常",
      },
    ],
    timeline: [
      {
        eventCode: "departed",
        label: "离港",
        planned: "计划 08-18",
        estimated: "预计 08-18",
        actual: "实际 08-18",
        evidence: "船司 ATD",
        eventRef: "evt_carrier_784",
      },
      {
        eventCode: "arrived",
        label: "到港",
        planned: "计划 09-10",
        estimated: "预计 09-11",
        actual: "实际 09-09",
        evidence: "码头 ATA",
        eventRef: "evt_terminal_517",
      },
      {
        eventCode: "release",
        label: "清关放行",
        planned: "计划 09-10",
        estimated: "预计 09-11",
        evidence: "尚无海关放行事实",
      },
    ],
  },
  {
    containerRecordId: "cr_01J9LAX8M5Q7",
    containerNumber: "TRLU-9912034",
    orderNumber: "24DSA1955",
    billOfLading: "MAEU254620101",
    typeCode: "40HQ",
    nodeDisplaySchema,
    currentNode: "送仓",
    currentStatus: {
      code: "picked_up",
      label: "已提柜",
      tone: "ok",
      changedAt: "09-10 08:20",
    },
    taskStatus: { code: "available", label: "卸柜任务待领取", tone: "info" },
    syncStatus: { code: "idle", label: "无待确认操作", tone: "muted" },
    location: "Ontario DC-02",
    markers: [],
    nextActionHint: "货柜已到仓，领取卸柜任务并先核对货柜身份。",
    eta: "09-10",
    actualAt: "09-08",
    risk: "月台已就绪",
    tone: "info",
    rail: createRail({
      ready: { phase: "done", actual: "08-02" },
      stuffing: { phase: "done", actual: "08-16" },
      shipment: { phase: "done", actual: "08-19" },
      depart: { phase: "done", actual: "08-19 09:15" },
      sailing: { phase: "done", actual: "09-06" },
      transit: { phase: "skipped", note: "本航次未发生" },
      customs: {
        phase: "done",
        actual: "09-09 14:10",
        evidence: "海关放行事件",
      },
      arrival: {
        phase: "done",
        actual: "09-08 07:30",
        evidence: "码头到港事件",
      },
      rail: { phase: "optional", note: "本柜未启用" },
      pickup: {
        phase: "done",
        isCurrentStatus: true,
        actual: "09-10 08:20",
        evidence: "闸口 EIR",
      },
      delivery: {
        phase: "done",
        actual: "09-10 08:42",
        evidence: "门岗到仓记录",
      },
      unload: {
        phase: "pending",
        attention: "current",
        planned: "09-10 09:00",
        taskId: "task_1026",
      },
    }),
    checklist: [],
    timeline: [
      {
        eventCode: "gate_out",
        label: "提柜出闸",
        actual: "实际 09-10 08:20",
        evidence: "闸口 EIR",
        eventRef: "evt_gate_204",
      },
      {
        eventCode: "warehouse_arrival",
        label: "到仓",
        actual: "实际 09-10 08:42",
        evidence: "门岗记录",
        eventRef: "evt_gatehouse_881",
      },
    ],
  },
  {
    containerRecordId: "cr_01J9LAX9R8T1",
    containerNumber: "MSKU-5521087",
    orderNumber: "24DSA1956",
    billOfLading: "MAEU254620115",
    typeCode: "40HQ",
    nodeDisplaySchema,
    currentNode: "海运在途",
    currentStatus: {
      code: "in_transit",
      label: "在途",
      tone: "info",
      changedAt: "09-05 18:00",
    },
    taskStatus: { code: "under_review", label: "离港冲突待复核", tone: "risk" },
    syncStatus: { code: "idle", label: "无待确认操作", tone: "muted" },
    location: "长滩港航线",
    markers: [],
    nextActionHint: "确认实际离港时间；状态投影只通过追加更正事件重放。",
    eta: "09-12",
    risk: "两方 ATD 相差 45 分钟",
    tone: "risk",
    rail: createRail({
      ready: { phase: "done", actual: "08-03" },
      stuffing: { phase: "done", actual: "08-17" },
      shipment: { phase: "done", actual: "08-20" },
      depart: {
        phase: "done",
        attention: "risk",
        actual: "08-20 14:20",
        taskId: "task_1027",
        evidence: "存在两方 ATD 冲突",
      },
      sailing: {
        phase: "done",
        isCurrentStatus: true,
        actual: "09-05 18:00",
        evidence: "航程事件",
      },
      transit: { phase: "skipped", note: "本航次未发生" },
      rail: { phase: "optional", note: "本柜未启用" },
    }),
    checklist: [],
    timeline: [
      {
        eventCode: "departed",
        label: "离港",
        actual: "船司 08-20 14:20 / 码头 15:05",
        evidence: "待对账",
        eventRef: "conflict_evt_784_392",
      },
      {
        eventCode: "sailing",
        label: "海运在途",
        actual: "实际 09-05 18:00",
        evidence: "船司航程事件",
        eventRef: "evt_carrier_811",
      },
    ],
  },
];

const exceptionAction = (): TaskAction => ({
  actionCode: "dispatch_exception",
  label: "上报异常",
  intent: "exception",
  tone: "danger",
  confirmation: "review",
  catalogStatus: "catalog",
  summary: "创建独立异常记录并关联原任务；不覆盖原任务和货柜事实。",
});

export const createTaskSeed = (): TaskItem[] => [
  {
    taskId: "task_1024",
    taskDefinitionKey: "transmit_customs_documents",
    taskDefinitionVersion: 1,
    containerRecordId: "cr_01J9LAX7K2D4",
    containerNumber: "TCLU-2387642",
    orderNumber: "24DSA1954",
    nodeKey: "customs",
    nodeName: "清关",
    triggerReason: "本柜清关资料尚未发送，危险品声明待最终核对",
    dueAt: "2026-09-06T11:30:00+08:00",
    status: "in_progress",
    riskPriority: 3,
    location: "洛杉矶港 WWT",
    workCategory: "信息 / 外发",
    executionMode: "hybrid",
    executionModeLabel: "人工处理 · 外部受理",
    queueKind: "human",
    assignment: { mode: "auto", label: "规则自动分配", assignee: "林悦" },
    preconditions: [
      {
        id: "recipient",
        label: "清关行与收件人已确定",
        detail: "CB-LA-02 · Import Desk",
        state: "met",
      },
      {
        id: "document_scope",
        label: "本柜资料要求已确定",
        detail: "普通进口 + 危险品声明",
        state: "met",
      },
    ],
    requiredInputs: [
      {
        id: "doc_invoice",
        label: "商业发票",
        detail: "INV-24DSA1954.pdf",
        state: "ready",
      },
      {
        id: "doc_packing",
        label: "装箱单",
        detail: "PL-24DSA1954.pdf",
        state: "ready",
      },
      {
        id: "doc_dg",
        label: "危险品声明",
        detail: "版本 3 · 待最后核对",
        state: "pending",
        actionLabel: "确认版本",
      },
    ],
    evidenceRequirements: [
      {
        id: "document_bundle",
        label: "附件齐套核验",
        detail: "3 份适用资料，合计 4.8 MB",
        kind: "checklist",
        required: true,
        state: "pending",
      },
      {
        id: "delivery_receipt",
        label: "清关行受理回执",
        detail: "发送后由渠道回执更新",
        kind: "receipt",
        required: false,
        state: "waiting",
      },
    ],
    actions: [
      {
        actionCode: "forward_document",
        label: "发送资料",
        intent: "complete",
        tone: "primary",
        confirmation: "review",
        catalogStatus: "catalog",
        summary: "核对外发对象和附件后发送；本次只形成发送事实。",
        defaultPayload: [
          { label: "接收方", value: "CB-LA-02 · Import Desk" },
          { label: "附件", value: "商业发票、装箱单、危险品声明" },
        ],
      },
      exceptionAction(),
    ],
    completionPolicy: {
      summary: "资料发送事实落账后转为等待外部受理，不推进货柜状态。",
      outcome: "waiting_external",
      advancesContainerStatus: false,
    },
    risk: "危险品声明待核对，免堆剩余 2 天",
  },
  {
    taskId: "task_1025",
    taskDefinitionKey: "check_pickup_readiness",
    taskDefinitionVersion: 1,
    containerRecordId: "cr_01J9LAX7K2D4",
    containerNumber: "TCLU-2387642",
    orderNumber: "24DSA1954",
    nodeKey: "pickup",
    nodeName: "拖卡提柜",
    triggerReason: "码头已开放提柜，但尚无海关放行事实",
    dueAt: "2026-09-06T15:00:00+08:00",
    status: "blocked",
    riskPriority: 2,
    location: "洛杉矶港 WWT",
    workCategory: "核验 / 协调",
    executionMode: "hybrid",
    executionModeLabel: "系统汇总 · 人工处置",
    queueKind: "human",
    assignment: { mode: "assigned", label: "指定责任人", assignee: "刘晨" },
    preconditions: [
      {
        id: "available",
        label: "码头可提",
        detail: "码头 Webhook · 09:06",
        state: "met",
      },
      {
        id: "customs_release",
        label: "海关放行",
        detail: "尚无权威 release 事件",
        state: "blocked",
      },
      {
        id: "fee_release",
        label: "费用结清",
        detail: "船司 release 已确认",
        state: "met",
      },
    ],
    requiredInputs: [],
    evidenceRequirements: [
      {
        id: "release_event",
        label: "海关放行事件",
        detail: "由海关/清关行权威渠道提供",
        kind: "external_event",
        required: true,
        state: "waiting",
      },
      {
        id: "terminal_available",
        label: "码头可提事件",
        detail: "AVAILABLE · 09:06",
        kind: "external_event",
        required: true,
        state: "verified",
      },
    ],
    actions: [
      {
        actionCode: "candidate_recheck_pickup_readiness",
        label: "重新核验条件",
        intent: "complete",
        tone: "primary",
        confirmation: "none",
        catalogStatus: "candidate",
        summary: "重新读取权威放行与码头可提事实，形成可派拖或继续等待结论。",
      },
      exceptionAction(),
    ],
    completionPolicy: {
      summary: "所有条件满足后形成“可派拖”结论，不等于已经提柜。",
      outcome: "record_only",
      advancesContainerStatus: false,
    },
    risk: "等待海关放行",
  },
  {
    taskId: "task_1026",
    taskDefinitionKey: "execute_unload",
    taskDefinitionVersion: 1,
    containerRecordId: "cr_01J9LAX8M5Q7",
    containerNumber: "TRLU-9912034",
    orderNumber: "24DSA1955",
    nodeKey: "unload",
    nodeName: "卸柜",
    triggerReason: "货柜已到达 4 号月台，卸柜作业尚未领取",
    dueAt: "2026-09-07T09:00:00+08:00",
    status: "available",
    riskPriority: 1,
    location: "Ontario DC-02 · 4 号月台",
    workCategory: "实物 / 核验",
    executionMode: "human",
    executionModeLabel: "现场人工执行",
    queueKind: "human",
    assignment: { mode: "pool", label: "仓库班组任务池" },
    preconditions: [
      {
        id: "gate_arrival",
        label: "货柜已到仓",
        detail: "门岗记录 · 08:42",
        state: "met",
      },
      {
        id: "dock_ready",
        label: "月台与人员可用",
        detail: "4 号月台 · B 班",
        state: "met",
      },
    ],
    requiredInputs: [
      {
        id: "unload_sheet",
        label: "卸柜清单",
        detail: "42 托 · 1,086 件",
        state: "pending",
        actionLabel: "确认已领取",
      },
      {
        id: "safety_equipment",
        label: "现场安全装备",
        detail: "B 班设备交接已确认",
        state: "ready",
      },
    ],
    evidenceRequirements: [
      {
        id: "container_scan",
        label: "核对货柜身份",
        detail: "扫描或输入柜号",
        kind: "scan",
        required: true,
        state: "pending",
        expectedValue: "TRLU9912034",
      },
      {
        id: "quantity_check",
        label: "实收数量与差异清单",
        detail: "完成 42 托计数；短少或破损需记录",
        kind: "checklist",
        required: true,
        state: "pending",
      },
      {
        id: "door_photo",
        label: "开柜与箱况照片",
        detail: "异常时必需，正常时可选",
        kind: "photo",
        required: false,
        state: "pending",
      },
    ],
    actions: [
      {
        actionCode: "candidate_submit_unload_result",
        label: "提交卸柜结果",
        intent: "complete",
        tone: "primary",
        confirmation: "review",
        catalogStatus: "candidate",
        summary: "确认全部卸完、数量已核验后提交不可变卸柜事实。",
        defaultPayload: [
          { label: "货柜", value: "TRLU-9912034" },
          { label: "计划数量", value: "42 托 · 1,086 件" },
          { label: "结果事件", value: "unloaded" },
        ],
      },
      exceptionAction(),
    ],
    completionPolicy: {
      summary: "部分报工只保存进度；全部完成并核验后才产生 unloaded 事件。",
      outcome: "complete",
      resultEventCode: "unloaded",
      advancesContainerStatus: true,
    },
  },
  {
    taskId: "task_1027",
    taskDefinitionKey: "resolve_departure_conflict",
    taskDefinitionVersion: 1,
    containerRecordId: "cr_01J9LAX9R8T1",
    containerNumber: "MSKU-5521087",
    orderNumber: "24DSA1956",
    nodeKey: "depart",
    nodeName: "离港",
    triggerReason: "船司与码头离港记录相差 45 分钟",
    dueAt: "2026-09-06T10:30:00+08:00",
    status: "under_review",
    riskPriority: 3,
    location: "宁波港 · 航次 6AB4E",
    workCategory: "异常 / 对账",
    executionMode: "human",
    executionModeLabel: "授权人员复核",
    queueKind: "human",
    assignment: { mode: "assigned", label: "风险定向分配", assignee: "赵宁" },
    preconditions: [
      {
        id: "source_messages",
        label: "两方原始消息已保全",
        detail: "船司 API + 码头 Webhook",
        state: "met",
      },
      {
        id: "correction_window",
        label: "更正关系可核验",
        detail: "历史已密封，需追加更正事件",
        state: "met",
      },
    ],
    requiredInputs: [
      {
        id: "carrier_event",
        label: "船司离港事件",
        detail: "ATD 08-18 14:20 · evt_carrier_784",
        state: "ready",
      },
      {
        id: "terminal_event",
        label: "码头离港事件",
        detail: "ATD 08-18 15:05 · evt_terminal_392",
        state: "ready",
      },
    ],
    evidenceRequirements: [
      {
        id: "source_compare",
        label: "来源与发生时间对账",
        detail: "原始消息、时区和更正关系已并列",
        kind: "checklist",
        required: true,
        state: "verified",
      },
      {
        id: "review_reason",
        label: "采纳理由",
        detail: "提交前记录复核结论",
        kind: "checklist",
        required: true,
        state: "pending",
      },
    ],
    actions: [
      {
        actionCode: "candidate_submit_departure_reconciliation",
        label: "提交对账结论",
        intent: "complete",
        tone: "primary",
        confirmation: "review",
        catalogStatus: "candidate",
        summary: "追加对账结论和更正引用；货柜投影由事件重放决定。",
        defaultPayload: [
          { label: "原始事件", value: "evt_carrier_784 / evt_terminal_392" },
        ],
      },
      exceptionAction(),
    ],
    completionPolicy: {
      summary:
        "只落对账结论与更正引用；状态投影由服务端重放，不由任务直接回退。",
      outcome: "complete",
      advancesContainerStatus: false,
    },
    risk: "密封历史冲突",
  },
  {
    taskId: "monitor_2041",
    taskDefinitionKey: "monitor_port_arrival",
    taskDefinitionVersion: 1,
    containerRecordId: "cr_01J9LAX9R8T1",
    containerNumber: "MSKU-5521087",
    orderNumber: "24DSA1956",
    nodeKey: "arrival",
    nodeName: "目的港到港",
    triggerReason: "预计 09-12 到港，系统正在等待权威到港或卸船事件",
    dueAt: "2026-09-12T23:59:00+08:00",
    status: "in_progress",
    riskPriority: 0,
    location: "长滩港",
    workCategory: "监控",
    executionMode: "system",
    executionModeLabel: "系统自动执行",
    queueKind: "monitor",
    assignment: { mode: "auto", label: "系统责任" },
    preconditions: [
      {
        id: "subscription",
        label: "事件订阅可用",
        detail: "码头 Webhook 正常",
        state: "met",
      },
    ],
    requiredInputs: [],
    evidenceRequirements: [
      {
        id: "arrival_event",
        label: "权威到港事件",
        detail: "等待 arrived / discharged",
        kind: "external_event",
        required: true,
        state: "waiting",
      },
    ],
    actions: [],
    completionPolicy: {
      summary: "权威事件到达后自动落账；超时或冲突才派生人工任务。",
      outcome: "complete",
      advancesContainerStatus: true,
      resultEventCode: "arrived",
    },
  },
];

export const createSubmissionSeed = (): Record<string, SubmissionView> => ({
  task_1025: {
    taskId: "task_1025",
    actionCode: "candidate_recheck_pickup_readiness",
    stage: "committed",
    clientOperationId: "op_demo_task_1025",
    traceId: "trace_demo_task_1025",
    receivedAt: "09:18:04",
    acceptedAt: "09:18:05",
    committedAt: "09:18:06",
    message: "最近一次核验结论已落账：等待海关放行",
    resultRef: "result_demo_task_1025",
  },
});

export const createExceptionSeed = (): ExceptionRecord[] => [
  {
    id: "EX-240910-03",
    containerRecordId: "cr_01J9LAX7K2D4",
    sourceTaskId: "task_1024",
    issue: "清关附件缺失",
    owner: "刘晨",
    status: "assigned",
    statusLabel: "处理中",
    reportedAt: "2026-09-06T09:10:00+08:00",
    dueAt: "今天 11:00",
    next: "补齐危险品声明",
  },
  {
    id: "EX-240909-07",
    containerRecordId: "cr_01J9LAX9R8T1",
    sourceTaskId: "task_1027",
    issue: "ETA 漂移",
    owner: "王敏",
    status: "resolved",
    statusLabel: "已处理·待验证",
    reportedAt: "2026-09-05T14:00:00+08:00",
    dueAt: "今天 16:00",
    next: "确认新到港窗口",
  },
];

export const capabilityRows = [
  {
    planId: "CAP-2026-CUSTOMS",
    parentPlanId: "FIRST-MILE-2026",
    nodeKey: "customs",
    resource: "清关行",
    provider: "CB-LA-01 / 02",
    period: "年度→W38",
    capacity: 15,
    assigned: 12,
    gap: "富余 3",
  },
  {
    planId: "CAP-2026-TRUCK-W38",
    parentPlanId: "FIRST-MILE-2026",
    nodeKey: "pickup",
    resource: "拖车",
    provider: "TR-LA-01",
    period: "W38→今日",
    capacity: 8,
    assigned: 6,
    warning: "2 柜待放行",
  },
  {
    planId: "CAP-2026-UNLOAD-W38",
    parentPlanId: "FIRST-MILE-2026",
    nodeKey: "unload",
    resource: "卸柜月台",
    provider: "Ontario DC-02",
    period: "W38",
    capacity: 16,
    assigned: 14,
    warning: "接近上限",
  },
];

export const achievementRows = [
  {
    planId: "PLAN-CUSTOMS-W38",
    nodeKey: "customs",
    containerRecordId: "cr_01J9LAX7K2D4",
    stage: "清关",
    month: "48/60",
    week: "10/15",
    day: "2/3",
    rate: "67%",
    tone: "warn" as Tone,
    resultRef: "result_customs_w38",
  },
  {
    planId: "PLAN-PICKUP-W38",
    nodeKey: "pickup",
    containerRecordId: "cr_01J9LAX7K2D4",
    stage: "提柜",
    month: "22/26",
    week: "6/8",
    day: "1/1",
    rate: "100%",
    tone: "ok" as Tone,
    resultRef: "result_pickup_w38",
  },
  {
    planId: "PLAN-DELIVERY-W38",
    nodeKey: "delivery",
    containerRecordId: "cr_01J9LAX8M5Q7",
    stage: "送仓",
    month: "29/34",
    week: "7/9",
    day: "1/2",
    rate: "50%",
    tone: "risk" as Tone,
    resultRef: "result_delivery_w38",
  },
  {
    planId: "PLAN-UNLOAD-W38",
    nodeKey: "unload",
    containerRecordId: "cr_01J9LAX8M5Q7",
    stage: "卸柜",
    month: "50/59",
    week: "13/16",
    day: "3/4",
    rate: "75%",
    tone: "warn" as Tone,
    resultRef: "result_unload_w38",
  },
];

export const achievementCalendars: Readonly<
  Record<AchievementCalendarDimension, AchievementCalendarView>
> = {
  month: {
    columns: [
      { key: "w35", label: "W35" },
      { key: "w36", label: "W36" },
      { key: "w37", label: "W37" },
      { key: "w38", label: "W38", isCurrent: true },
    ],
    rows: [
      {
        stage: "清关",
        tone: "warn",
        values: { w35: "13/15", w36: "12/15", w37: "13/15", w38: "10/15" },
      },
      {
        stage: "提柜",
        tone: "ok",
        values: { w35: "5/6", w36: "6/6", w37: "5/6", w38: "6/8" },
      },
      {
        stage: "送仓",
        tone: "risk",
        values: { w35: "8/8", w36: "7/8", w37: "7/9", w38: "7/9" },
      },
      {
        stage: "卸柜",
        tone: "warn",
        values: {
          w35: "12/14",
          w36: "13/14",
          w37: "12/15",
          w38: "13/16",
        },
      },
    ],
  },
  week: {
    columns: [
      { key: "monday", label: "周一" },
      { key: "tuesday", label: "周二" },
      { key: "wednesday", label: "周三" },
      { key: "thursday", label: "周四", isCurrent: true },
      { key: "friday", label: "周五" },
      { key: "saturday", label: "周六" },
      { key: "sunday", label: "周日" },
    ],
    rows: [
      {
        stage: "清关",
        tone: "warn",
        values: {
          monday: "2/3",
          tuesday: "2/3",
          wednesday: "2/3",
          thursday: "2/3",
          friday: "2/3",
          saturday: "0/0",
          sunday: "0/0",
        },
      },
      {
        stage: "提柜",
        tone: "ok",
        values: {
          monday: "1/1",
          tuesday: "1/1",
          wednesday: "1/1",
          thursday: "1/1",
          friday: "1/1",
          saturday: "1/2",
          sunday: "0/1",
        },
      },
      {
        stage: "送仓",
        tone: "risk",
        values: {
          monday: "1/1",
          tuesday: "1/1",
          wednesday: "1/1",
          thursday: "1/2",
          friday: "1/1",
          saturday: "1/1",
          sunday: "1/2",
        },
      },
      {
        stage: "卸柜",
        tone: "warn",
        values: {
          monday: "2/2",
          tuesday: "2/2",
          wednesday: "2/2",
          thursday: "3/4",
          friday: "2/2",
          saturday: "1/2",
          sunday: "1/2",
        },
      },
    ],
  },
  day: {
    columns: [
      { key: "0800", label: "08:00" },
      { key: "1000", label: "10:00" },
      { key: "1200", label: "12:00" },
      { key: "1400", label: "14:00", isCurrent: true },
      { key: "1600", label: "16:00" },
      { key: "1800", label: "18:00" },
    ],
    rows: [
      {
        stage: "清关",
        tone: "warn",
        values: {
          "0800": "0/0",
          "1000": "1/1",
          "1200": "0/1",
          "1400": "1/1",
          "1600": "0/0",
          "1800": "0/0",
        },
      },
      {
        stage: "提柜",
        tone: "ok",
        values: {
          "0800": "1/1",
          "1000": "0/0",
          "1200": "0/0",
          "1400": "0/0",
          "1600": "0/0",
          "1800": "0/0",
        },
      },
      {
        stage: "送仓",
        tone: "risk",
        values: {
          "0800": "0/0",
          "1000": "0/1",
          "1200": "1/1",
          "1400": "0/0",
          "1600": "0/0",
          "1800": "0/0",
        },
      },
      {
        stage: "卸柜",
        tone: "warn",
        values: {
          "0800": "1/1",
          "1000": "1/1",
          "1200": "0/1",
          "1400": "1/1",
          "1600": "0/0",
          "1800": "0/0",
        },
      },
    ],
  },
};

export const weeklyAchievementSummary = {
  completed: 36,
  planned: 48,
  rate: "75%",
} as const;

export const cycleRows = [
  {
    containerRecordId: "cr_01J9LAX7K2D4",
    stage: "海运",
    planned: "28 天",
    estimated: "30 天",
    actual: "29 天",
    basis: "离港实际 → 到港实际",
    eventRefs: "evt_carrier_784 → evt_terminal_517",
  },
  {
    containerRecordId: "cr_01J9LAX7K2D4",
    stage: "清关",
    planned: "1 天",
    estimated: "2 天",
    actual: "进行中",
    basis: "到港实际 → 海关放行实际",
    eventRefs: "evt_terminal_517 → 待发生",
  },
  {
    containerRecordId: "cr_01J9LAX7K2D4",
    stage: "拖卡",
    planned: "1 天",
    estimated: "1 天",
    actual: "待发生",
    basis: "码头可提 → 提柜闸口事件",
    eventRefs: "evt_available_119 → 待发生",
  },
  {
    containerRecordId: "cr_01J9LAX8M5Q7",
    stage: "卸柜",
    planned: "1 天",
    estimated: "1 天",
    actual: "待发生",
    basis: "到仓实际 → 卸柜实际",
    eventRefs: "evt_gatehouse_881 → 待发生",
  },
];

export const feeRows = [
  {
    feeId: "FEE-DEM-1954",
    containerRecordId: "cr_01J9LAX7K2D4",
    type: "Demurrage",
    stage: "预计",
    amount: "USD 160.00",
    period: "码头内重箱期",
    authority: "合同规则待样本确认",
    ruleRef: "RULE-DEM-CBLA-C",
    tone: "warn" as Tone,
  },
  {
    feeId: "FEE-DET-1955",
    containerRecordId: "cr_01J9LAX8M5Q7",
    type: "Detention",
    stage: "未开始",
    amount: "—",
    period: "提柜后至还空",
    authority: "等待提柜事件",
    ruleRef: "RULE-DET-CBLA-A",
    tone: "muted" as Tone,
  },
  {
    feeId: "FEE-STO-1954",
    containerRecordId: "cr_01J9LAX7K2D4",
    type: "Storage",
    stage: "账单待核",
    amount: "USD 50.00",
    period: "码头堆存",
    authority: "码头账单 · 待审核",
    ruleRef: "INVOICE-WWT-4401",
    tone: "risk" as Tone,
  },
];

export const meetingDecisions = [
  {
    decisionId: "DEC-SUB-W39-01",
    meeting: "Sub. 物流例会",
    decision: "W39 增加 1 个卸柜窗口",
    owner: "赵宁",
    dueAt: "09-13",
    status: "已分派",
    sourceRef: "CAP-2026-UNLOAD-W38",
    followUpTaskId: "task_1026",
    targetPlanId: "CAP-2026-UNLOAD-W39",
  },
  {
    decisionId: "DEC-SUP-09-02",
    meeting: "供应商月会",
    decision: "复盘清关资料一次通过率",
    owner: "CB-LA-01",
    dueAt: "09-30",
    status: "待执行",
    sourceRef: "result_customs_w38",
    followUpTaskId: "task_1024",
    targetPlanId: "CAP-2026-CUSTOMS",
  },
];
