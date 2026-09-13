import type { ContainerLifecycleState } from "@logix/contracts";
import type { ContainerSummary } from "../api/containers";
import type { LifecycleNodeItem } from "../api/lifecycleNodes";
import type { NodeTaskDetail, WorkOrderSummary } from "../api/nodeTasks";
import type { DisplayFieldSchema } from "../components/ui/displayFieldContract";
import {
  canCompleteWorkOrder,
  COMPLETE_WORK_ORDER_ACTION,
} from "./completeReceiptContract";
import type {
  ContainerProjection,
  StatusView,
  TaskItem,
  TaskStatusCode,
  Tone,
  WorkNode,
} from "./sample";

export const LIVE_TASK_DEFINITION_KEY = "live_node_task";
export const LIVE_TASK_DEFINITION_VERSION = 1;

export const NODE_CODE_LABELS: Record<string, string> = {
  cargo_ready: "备货就绪",
  container_stuffing: "装箱定稿",
  shipment_dispatch: "出运",
  origin_departure: "离港",
  ocean_transit: "海运在途",
  transshipment: "中转港",
  customs_clearance: "清关",
  destination_arrival: "目的港到港",
  rail_transfer: "海铁联运",
  container_pickup: "拖卡提柜",
  warehouse_delivery: "送仓",
  container_unloading: "卸柜",
  container_unstuffing: "卸空",
  empty_return: "还箱",
};

const LIFECYCLE_STATUS: Record<
  ContainerLifecycleState,
  { label: string; tone: Tone }
> = {
  not_shipped: { label: "未出运", tone: "muted" },
  shipped: { label: "已出运", tone: "info" },
  in_transit: { label: "在途", tone: "info" },
  at_port: { label: "已到港", tone: "warn" },
  picked_up: { label: "已提柜", tone: "info" },
  unloaded: { label: "已卸柜", tone: "ok" },
  returned_empty: { label: "已还箱", tone: "ok" },
  cancelled: { label: "已取消", tone: "muted" },
};

const emptyNodeDisplaySchema: DisplayFieldSchema = {
  schemaId: "live-container-node",
  schemaVersion: 1,
  groups: [{ code: "nodeFacts", label: "节点事实", order: 1 }],
  fields: [],
};

const idleStatus = (changedAt?: string): StatusView => ({
  code: "idle",
  label: "无投影",
  tone: "muted",
  changedAt,
});

export function completeActionCode(workOrderId: string): string {
  return `${COMPLETE_WORK_ORDER_ACTION}:${workOrderId}`;
}

export function parseCompleteActionCode(actionCode: string): string | null {
  const prefix = `${COMPLETE_WORK_ORDER_ACTION}:`;
  if (!actionCode.startsWith(prefix)) return null;
  const workOrderId = actionCode.slice(prefix.length).trim();
  return workOrderId || null;
}

export function toLiveContainer(
  summary: ContainerSummary,
): ContainerProjection {
  const status = LIFECYCLE_STATUS[summary.currentStatus] ?? {
    label: summary.currentStatus,
    tone: "muted" as const,
  };
  const changedAt = summary.updatedAt;
  return {
    containerRecordId: summary.id,
    containerNumber: summary.containerNumber?.trim() || "无箱号",
    orderNumber: summary.orderNumber,
    billOfLading: "",
    typeCode: "",
    nodeDisplaySchema: emptyNodeDisplaySchema,
    currentNode: "",
    currentStatus: {
      code: summary.currentStatus,
      label: status.label,
      tone: status.tone,
      changedAt,
    },
    taskStatus: idleStatus(changedAt),
    syncStatus: idleStatus(changedAt),
    location: "",
    markers: [],
    nextActionHint: "去做这柜的任务。",
    eta: "",
    risk: "",
    tone: status.tone === "risk" ? "risk" : "ok",
    rail: [],
    checklist: [],
    timeline: [],
  };
}

function toTaskStatus(detail: NodeTaskDetail): TaskStatusCode {
  if (detail.state === "completed") return "completed";
  if (detail.workOrders.some((item) => item.state === "blocked")) {
    return "blocked";
  }
  if (detail.state === "in_progress") return "in_progress";
  return "in_progress";
}

const OPEN_TASK_LABELS: Record<TaskStatusCode, string> = {
  available: "待做",
  in_progress: "进行中",
  blocked: "受阻",
  reported: "已上报",
  waiting_external: "等外部",
  under_review: "复核中",
  completed: "已完成",
};

export function attachCurrentNodes(
  containers: readonly ContainerProjection[],
  items: readonly { containerId: string; currentNodeCode: string }[],
): ContainerProjection[] {
  const labels = new Map<string, string>();
  for (const item of items) {
    const containerId = item.containerId.trim();
    const code = item.currentNodeCode.trim();
    if (!containerId || !code) continue;
    labels.set(containerId, NODE_CODE_LABELS[code] ?? code);
  }
  return containers.map((container) => {
    const name = labels.get(container.containerRecordId);
    if (!name) return container;
    return { ...container, currentNode: name };
  });
}

function toRailNode(node: LifecycleNodeItem): WorkNode {
  return {
    key: node.nodeCode,
    name: NODE_CODE_LABELS[node.nodeCode] ?? node.nodeCode,
    phase:
      node.applicability === "optional_not_applicable"
        ? "skipped"
        : node.state === "completed"
          ? "done"
          : "pending",
    isCurrentStatus: node.isCurrent,
    actual: node.completedAt ?? undefined,
  };
}

export function attachLiveNodes(
  containers: readonly ContainerProjection[],
  items: readonly {
    containerId: string;
    nodes: readonly LifecycleNodeItem[];
  }[],
): ContainerProjection[] {
  const rails = new Map<string, WorkNode[]>();
  for (const item of items) {
    const containerId = item.containerId.trim();
    if (!containerId || item.nodes.length === 0) continue;
    rails.set(containerId, item.nodes.map(toRailNode));
  }
  return containers.map((container) => {
    const rail = rails.get(container.containerRecordId);
    if (!rail) return container;
    return { ...container, rail };
  });
}

export function attachOpenTasks(
  containers: readonly ContainerProjection[],
  details: readonly NodeTaskDetail[],
): ContainerProjection[] {
  const openByContainer = new Map<string, NodeTaskDetail>();
  for (const detail of details) {
    const containerId = detail.containerId?.trim() ?? "";
    if (!containerId || detail.state === "completed") continue;
    if (!openByContainer.has(containerId)) {
      openByContainer.set(containerId, detail);
    }
  }
  return containers.map((container) => {
    const open = openByContainer.get(container.containerRecordId);
    if (!open) return container;
    const code = toTaskStatus(open);
    const nodeName = NODE_CODE_LABELS[open.nodeCode] ?? open.nodeCode;
    return {
      ...container,
      taskStatus: {
        code,
        label: `${nodeName} · ${OPEN_TASK_LABELS[code]}`,
        tone: code === "blocked" ? "risk" : "info",
      },
    };
  });
}

function completableWorkOrders(detail: NodeTaskDetail): WorkOrderSummary[] {
  return detail.workOrders.filter((item) => canCompleteWorkOrder(item.state));
}

export interface TaskContainerRef {
  id: string;
  containerNumber: string | null;
  orderNumber: string;
}

export function toLiveTask(
  detail: NodeTaskDetail,
  container: TaskContainerRef,
): TaskItem {
  const nodeName = NODE_CODE_LABELS[detail.nodeCode] ?? detail.nodeCode;
  const completable = completableWorkOrders(detail);
  return {
    taskId: detail.id,
    taskDefinitionKey: LIVE_TASK_DEFINITION_KEY,
    taskDefinitionVersion: LIVE_TASK_DEFINITION_VERSION,
    containerRecordId: container.id,
    containerNumber: container.containerNumber?.trim() || "无箱号",
    orderNumber: container.orderNumber,
    nodeKey: detail.nodeCode,
    nodeName,
    triggerReason: "",
    dueAt: "",
    status: toTaskStatus(detail),
    riskPriority: 0,
    location: "",
    workCategory: detail.taskDefinitionKey,
    executionMode: "human",
    executionModeLabel: "现场作业",
    queueKind: "human",
    assignment: {
      mode: "assigned",
      label: "已分配",
      assignee: "dev-operator",
    },
    preconditions: [],
    requiredInputs: [],
    evidenceRequirements: completable.length
      ? [
          {
            id: `evidence-${detail.id}`,
            label: "凭证编号（可选）",
            detail: "没有可以不填。多个编号用空格或逗号分开。",
            kind: "document",
            required: false,
            state: "pending",
          },
        ]
      : [],
    actions: completable.map((workOrder) => ({
      actionCode: completeActionCode(workOrder.id),
      label: "完成工单",
      intent: "complete",
      tone: "primary",
      confirmation: "none",
      catalogStatus: "catalog",
      summary: workOrder.workOrderDefinitionKey,
    })),
    completionPolicy: {
      summary: "点完成后，这一步才算做完。",
      outcome: "complete",
      advancesContainerStatus: false,
    },
  };
}
