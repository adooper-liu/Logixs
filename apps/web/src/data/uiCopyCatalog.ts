import type { TaskStatusCode, Tone } from "./sample";

/**
 * 作业壳显示字典。身份码仍走契约；这里只存屏幕字。
 * 加语言：在 uiCopyByLocale 增加 locale，不要在组件里写第二套中文。
 */
export const UI_COPY_LOCALE = "zh-CN" as const;
export type UiCopyLocale = typeof UI_COPY_LOCALE;

export const LIFECYCLE_NODE_CODES = [
  "cargo_ready",
  "container_stuffing",
  "shipment_dispatch",
  "origin_departure",
  "ocean_transit",
  "transshipment",
  "customs_clearance",
  "destination_arrival",
  "rail_transfer",
  "container_pickup",
  "warehouse_delivery",
  "container_unloading",
  "container_unstuffing",
  "empty_return",
] as const;

export type LifecycleNodeCode = (typeof LIFECYCLE_NODE_CODES)[number];

const uiCopyZhCN = {
  action: {
    claim: "领取",
    claimWorkOrder: "领取",
    complete: "完成工单",
    applyEvent: "推进本步骤",
    compensate: "需修正",
  },
  outcome: {
    claimed: "已领取",
    committed: "已入账",
    committedNodeHeld: "已入账，本步骤未推进",
  },
  taskStatus: {
    available: "待领取",
    in_progress: "进行中",
    blocked: "受阻",
    reported: "已报，未入账",
    waiting_external: "等待外部",
    under_review: "待复核",
    completed: "已完成",
  } satisfies Record<TaskStatusCode, string>,
  taskStatusTone: {
    available: "info",
    in_progress: "info",
    blocked: "risk",
    reported: "warn",
    waiting_external: "warn",
    under_review: "risk",
    completed: "ok",
  } satisfies Record<TaskStatusCode, Tone>,
  assignment: {
    pool: "待领取",
    claimed: "进行中",
    assigned: "已分配",
  },
  node: {
    cargo_ready: "备货",
    container_stuffing: "装箱",
    shipment_dispatch: "出运",
    origin_departure: "离港",
    ocean_transit: "海运",
    transshipment: "中转港",
    customs_clearance: "清关",
    destination_arrival: "到港",
    rail_transfer: "海铁",
    container_pickup: "提柜",
    warehouse_delivery: "送仓",
    container_unloading: "卸柜",
    container_unstuffing: "卸空",
    empty_return: "还箱",
  } satisfies Record<LifecycleNodeCode, string>,
  nodePurpose: {
    cargo_ready: "备货完成",
    container_stuffing: "装箱完成",
    shipment_dispatch: "出运完成",
    origin_departure: "离港完成",
    ocean_transit: "海运完成",
    transshipment: "中转完成",
    customs_clearance: "清关完成",
    destination_arrival: "到港完成",
    rail_transfer: "海铁完成",
    container_pickup: "提柜完成",
    warehouse_delivery: "送仓完成",
    container_unloading: "卸柜完成",
    container_unstuffing: "卸空完成",
    empty_return: "还箱完成",
  } satisfies Record<LifecycleNodeCode, string>,
  focus: {
    claim: "领取",
    preconditions: "前置条件",
    inputs: "资料",
    evidence: "单证",
    submit: "上报",
    sync: "入账",
    heading: "入账状态",
    attentionClaim: "领取任务",
    attentionSubmit: "完成工单",
    attentionSync: "等待入账",
    attentionDone: "已入账",
  },
  receipt: {
    sending: "处理中…",
    received: "已接收",
    accepted: "已确认",
    committed: "已入账",
    help: "核对本次操作是否被接收、规则是否通过、是否已入账。只有已入账才算生效。",
    reported: "处理中。尚未入账之前，不视为完成。",
  },
  reception: {
    pending: "未接收",
    received: "已接收",
    duplicate: "重复提交",
    boundary_rejected: "不予受理",
  },
  decision: {
    pending: "待确认",
    accepted: "已确认",
    rejected: "已拒绝",
  },
  commit: {
    pending: "待入账",
    committed: "已入账",
    commit_failed: "入账失败",
  },
  sync: {
    receivedPending: "已接收，待入账",
  },
  compensation: {
    not_required: "不需要",
    pending: "待处理",
    in_progress: "处理中",
    compensated: "已补偿",
    failed: "失败",
    manual_review: "人工复核",
  },
  error: {
    evidenceRequired:
      "缺少合格证据。装箱、出运、离港必须先填本柜单证并核对。",
  },
  chrome: {
    dueLabel: "应完成",
    dueNone: "暂无截止",
    waitingQueue: "等待外部 / 等待入账",
    guardrail: "注意事项",
    resultAdvances: "入账后本柜会往下走",
    resultNeutral: "仅入账，状态不变",
    liveGuidance: "做完后完成工单。只有已入账才算生效。",
    liveBlocked: "当前操作受阻，处理后方可继续。",
    liveWaiting: "等待系统将结果记入本柜。",
    liveCompletion:
      "工单已完成，已入账，且收到、确认、入账三步均通过。",
    liveGuardrail: "页面显示成功不等于完成。未填字段不在屏幕上虚构。",
    liveDone: "已入账。",
    completePolicy: "完成工单后，已入账才算生效。",
    evidenceOptional: "单证编号（可选）",
    evidenceHint: "没有可以不填。已核验编号用空格或逗号分开。",
    evidenceRequired: "单证编号",
    evidenceRequiredHint:
      "装箱、出运、离港必须先填本柜单证并核对，再完成工单。",
    idle: "",
    nodeFactsGroup: "本步骤已入账",
    emptyNodeTask: "本步骤暂无待领取任务",
    emptyFlow: "本柜尚未开始流程。",
    emptyEvents: "本柜尚无操作记录。",
    railsFailed: "各步骤加载失败",
    importTitle: "导入货柜",
    debugTitle: "按柜查看任务",
    debugHint: "领取后完成工单，查看入账状态。空闲不占位。装箱、出运、离港必须先填单证并核对。",
    operationsSummary: "已提交操作及系统入账状态。",
    containersSummary: "当前已记录的货柜列表。",
    claimFailed: "领取失败",
    completeFailed: "完成工单失败",
    columnStationEmpty: "尚未开始流程",
    columnTaskEmpty: "没有待办",
    columnSyncEmpty: "最近没有提交",
  },
  column: {
    containerStatus:
      "货柜实际走到哪里，以已入账的结果为准。",
    syncStatus: "看这次有没有被接收、规则通不通、有没有入账。",
    currentStation: "这一柜现在走到哪一站。",
    openTask: "这一柜还没做完的活。",
  },
} as const;

export const uiCopyByLocale = {
  "zh-CN": uiCopyZhCN,
} as const;

export const uiCopy = uiCopyZhCN;

export const NODE_CODE_LABELS: Record<string, string> = {
  ...uiCopy.node,
};

export const NODE_PURPOSE_LABELS: Record<string, string> = {
  ...uiCopy.nodePurpose,
};

export function nodeScreenName(nodeCode: string): string {
  return NODE_CODE_LABELS[nodeCode] ?? nodeCode;
}

export function nodePurposeName(nodeCode: string): string {
  return NODE_PURPOSE_LABELS[nodeCode] ?? nodeScreenName(nodeCode);
}

export function taskStatusCopy(status: TaskStatusCode): {
  label: string;
  tone: Tone;
} {
  return {
    label: uiCopy.taskStatus[status],
    tone: uiCopy.taskStatusTone[status],
  };
}
