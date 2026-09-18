import type { ContainerLifecycleState } from "@logix/contracts";
import type { ContainerSummary } from "../api/containers";
import type { LifecycleNodeItem } from "../api/lifecycleNodes";
import type { NodeTaskDetail } from "../api/nodeTasks";
import type { DisplayFieldSchema } from "../components/ui/displayFieldContract";
import {
  CLAIM_WORK_ORDER_ACTION,
  CLAIM_WORK_ORDER_LABEL,
} from "./claimReceiptContract";
import { completionRequiresEvidence } from "./completionEvidencePolicy";
import {
  COMPLETE_WORK_ORDER_ACTION,
  COMPLETE_WORK_ORDER_LABEL,
} from "./completeReceiptContract";
import { nodePurposeName, nodeScreenName, uiCopy } from "./uiCopyCatalog";
import type {
  ContainerProjection,
  StatusView,
  TaskAction,
  TaskAssignment,
  TaskItem,
  TaskStatusCode,
  Tone,
  WorkNode,
} from "./sample";

export const LIVE_TASK_DEFINITION_KEY = "live_node_task";
export const LIVE_TASK_DEFINITION_VERSION = 1;

export { NODE_CODE_LABELS, NODE_PURPOSE_LABELS } from "./uiCopyCatalog";

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
  groups: [
    { code: "nodeFacts", label: uiCopy.chrome.nodeFactsGroup, order: 1 },
  ],
  fields: [],
};

const idleStatus = (changedAt?: string): StatusView => ({
  code: "idle",
  label: uiCopy.chrome.idle,
  tone: "muted",
  changedAt,
});

export function completeActionCode(workOrderId: string): string {
  return `${COMPLETE_WORK_ORDER_ACTION}:${workOrderId}`;
}

export function claimActionCode(workOrderId: string): string {
  return `${CLAIM_WORK_ORDER_ACTION}:${workOrderId}`;
}

export function parseCompleteActionCode(actionCode: string): string | null {
  return parsePrefixedActionCode(COMPLETE_WORK_ORDER_ACTION, actionCode);
}

export function parseClaimActionCode(actionCode: string): string | null {
  return parsePrefixedActionCode(CLAIM_WORK_ORDER_ACTION, actionCode);
}

function parsePrefixedActionCode(
  action: string,
  actionCode: string,
): string | null {
  const prefix = `${action}:`;
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
  if (
    detail.applicability === "optional_not_applicable" ||
    detail.readinessState === "waiting_conditions"
  ) {
    return "waiting_external";
  }
  if (detail.workOrders.some((item) => item.state === "blocked")) {
    return "blocked";
  }
  if (detail.state === "in_progress") return "in_progress";
  return "in_progress";
}

const OPEN_TASK_LABELS = uiCopy.taskStatus;

export function attachCurrentNodes(
  containers: readonly ContainerProjection[],
  items: readonly { containerId: string; currentNodeCode: string }[],
): ContainerProjection[] {
  const labels = new Map<string, string>();
  for (const item of items) {
    const containerId = item.containerId.trim();
    const code = item.currentNodeCode.trim();
    if (!containerId || !code) continue;
    labels.set(containerId, nodeScreenName(code));
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
    name: nodeScreenName(node.nodeCode),
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
    const current = openByContainer.get(containerId);
    if (!current || taskDisplayRank(detail) < taskDisplayRank(current)) {
      openByContainer.set(containerId, detail);
    }
  }
  return containers.map((container) => {
    const open = openByContainer.get(container.containerRecordId);
    if (!open) return container;
    const code = toTaskStatus(open);
    const purpose = nodePurposeName(open.nodeCode);
    return {
      ...container,
      taskStatus: {
        code,
        label: `${purpose} · ${OPEN_TASK_LABELS[code]}`,
        tone: code === "blocked" ? "risk" : "info",
      },
    };
  });
}

function taskDisplayRank(detail: NodeTaskDetail): number {
  if (
    detail.applicability !== "optional_not_applicable" &&
    detail.readinessState === "ready"
  ) {
    return 0;
  }
  if (detail.applicability !== "optional_not_applicable") return 1;
  return 2;
}

function toAssignment(detail: NodeTaskDetail): TaskAssignment {
  const nextAction = detail.nextAction;
  if (
    nextAction?.actionCode === CLAIM_WORK_ORDER_ACTION ||
    nextAction?.assignmentState === "unassigned" ||
    nextAction?.assignmentState === "pool"
  ) {
    return { mode: "pool", label: uiCopy.assignment.pool };
  }
  if (nextAction?.assigneeId) {
    return {
      mode: "assigned",
      label: uiCopy.assignment.claimed,
      assignee: nextAction.assigneeId,
    };
  }
  return { mode: "assigned", label: uiCopy.assignment.assigned };
}

function toActions(detail: NodeTaskDetail): TaskAction[] {
  const nextAction = detail.nextAction;
  if (!nextAction) return [];
  if (nextAction.actionCode === CLAIM_WORK_ORDER_ACTION) {
    return [
      {
        actionCode: claimActionCode(nextAction.workOrderId),
        label: CLAIM_WORK_ORDER_LABEL,
        intent: "claim",
        tone: "primary",
        confirmation: "none",
        catalogStatus: "catalog",
        summary: nextAction.workOrderDefinitionKey,
      },
    ];
  }
  if (nextAction.actionCode !== COMPLETE_WORK_ORDER_ACTION) return [];
  return [
    {
      actionCode: completeActionCode(nextAction.workOrderId),
      label: COMPLETE_WORK_ORDER_LABEL,
      intent: "complete",
      tone: "primary",
      confirmation: "none",
      catalogStatus: "catalog",
      summary: nextAction.workOrderDefinitionKey,
    },
  ];
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
  const nodeName = nodeScreenName(detail.nodeCode);
  const actions = toActions(detail);
  const canComplete =
    detail.nextAction?.actionCode === COMPLETE_WORK_ORDER_ACTION;
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
    dueAt: detail.nextAction?.dueAt ?? "",
    status: toTaskStatus(detail),
    riskPriority: 0,
    location: "",
    workCategory: detail.taskDefinitionKey,
    executionMode: "human",
    executionModeLabel: "现场作业",
    queueKind: "human",
    assignment: toAssignment(detail),
    preconditions: [],
    requiredInputs: [],
    evidenceRequirements: canComplete
      ? [
          {
            id: `evidence-${detail.id}`,
            label: completionRequiresEvidence(detail.nodeCode)
              ? uiCopy.chrome.evidenceRequired
              : uiCopy.chrome.evidenceOptional,
            detail: completionRequiresEvidence(detail.nodeCode)
              ? uiCopy.chrome.evidenceRequiredHint
              : uiCopy.chrome.evidenceHint,
            kind: "scan",
            required: completionRequiresEvidence(detail.nodeCode),
            state: "pending",
          },
        ]
      : [],
    actions,
    completionPolicy: {
      summary: uiCopy.chrome.completePolicy,
      outcome: "complete",
      advancesContainerStatus: false,
    },
  };
}
