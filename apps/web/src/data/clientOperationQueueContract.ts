import type {
  ClientOperationItem,
  CompensationItem,
} from "../api/clientOperations";
import type { ContainerProjection, StatusView, Tone } from "./sample";
import { uiCopy } from "./uiCopyCatalog";

export const OPERATION_FORBIDDEN_RENDER_KEYS = [
  "requestHash",
  "payload",
  "payloadBody",
  "token",
  "cookie",
  "serviceKey",
  "password",
] as const;

const RECEPTION_LABELS: Record<string, string> = { ...uiCopy.reception };

const DECISION_LABELS: Record<string, string> = { ...uiCopy.decision };

const COMMIT_LABELS: Record<string, string> = { ...uiCopy.commit };

const ACTION_LABELS: Record<string, string> = {
  "lifecycle.apply_event": uiCopy.action.applyEvent,
  "work_execution.complete_work_order": uiCopy.action.complete,
  "work_execution.claim_work_order": uiCopy.action.claimWorkOrder,
  "lifecycle.compensate_apply_event": uiCopy.action.compensate,
};

const COMPENSATION_STATE_LABELS: Record<string, string> = {
  ...uiCopy.compensation,
};

export interface ClientOperationRow {
  id: string;
  actionLabel: string;
  actionCode: string;
  objectRef: string;
  receptionLabel: string;
  decisionLabel: string;
  commitLabel: string;
  rejectionReasonCode: string | null;
  createdAt: string;
  traceId: string;
}

export interface CompensationRow {
  id: string;
  actionLabel: string;
  stateLabel: string;
  reasonCode: string;
  createdAt: string;
}

export function toOperationRow(item: ClientOperationItem): ClientOperationRow {
  return {
    id: item.clientOperationId,
    actionLabel: ACTION_LABELS[item.actionCode] ?? item.actionCode,
    actionCode: item.actionCode,
    objectRef: `${item.targetType}/${item.targetId}`,
    receptionLabel:
      RECEPTION_LABELS[item.receptionState] ?? item.receptionState,
    decisionLabel:
      DECISION_LABELS[item.businessDecisionState] ?? item.businessDecisionState,
    commitLabel: COMMIT_LABELS[item.commitState] ?? item.commitState,
    rejectionReasonCode: item.rejectionReasonCode,
    createdAt: item.createdAt,
    traceId: item.traceId,
  };
}

export interface OperationContainerHint {
  containerId: string;
  taskId: string;
  workOrderIds: readonly string[];
}

function indexContainerHints(hints: readonly OperationContainerHint[]): {
  byTaskId: Map<string, string>;
  byWorkOrderId: Map<string, string>;
} {
  const byTaskId = new Map<string, string>();
  const byWorkOrderId = new Map<string, string>();
  for (const hint of hints) {
    const containerId = hint.containerId.trim();
    if (!containerId) continue;
    if (hint.taskId.trim()) byTaskId.set(hint.taskId.trim(), containerId);
    for (const workOrderId of hint.workOrderIds) {
      if (workOrderId.trim())
        byWorkOrderId.set(workOrderId.trim(), containerId);
    }
  }
  return { byTaskId, byWorkOrderId };
}

function referredContainerIds(
  item: ClientOperationItem,
  hints: ReturnType<typeof indexContainerHints>,
): string[] {
  const ids: string[] = [];
  if (item.targetType === "container" && item.targetId.trim()) {
    ids.push(item.targetId.trim());
  }
  if (item.targetType === "work_order") {
    const containerId = hints.byWorkOrderId.get(item.targetId.trim());
    if (containerId) ids.push(containerId);
  }
  for (const ref of item.resultRefs) {
    const entityId = ref.entityId.trim();
    if (!entityId) continue;
    if (ref.entityType === "container") {
      ids.push(entityId);
      continue;
    }
    if (ref.entityType === "node_task") {
      const containerId = hints.byTaskId.get(entityId);
      if (containerId) ids.push(containerId);
      continue;
    }
    if (ref.entityType === "work_order") {
      const containerId = hints.byWorkOrderId.get(entityId);
      if (containerId) ids.push(containerId);
    }
  }
  return ids;
}

export function toContainerSyncStatus(item: ClientOperationItem): StatusView {
  let label = COMMIT_LABELS[item.commitState] ?? item.commitState;
  if (item.commitState === "pending") {
    if (item.receptionState === "boundary_rejected") {
      label = RECEPTION_LABELS.boundary_rejected;
    } else if (item.businessDecisionState === "rejected") {
      label = DECISION_LABELS.rejected;
    } else if (item.receptionState === "received") {
      label = uiCopy.sync.receivedPending;
    }
  }
  const tone: Tone =
    item.commitState === "commit_failed" ||
    item.businessDecisionState === "rejected" ||
    item.receptionState === "boundary_rejected"
      ? "risk"
      : item.commitState === "committed"
        ? "ok"
        : "info";
  return {
    code: item.commitState,
    label,
    tone,
    changedAt: item.createdAt,
  };
}

export function attachLatestSync(
  containers: readonly ContainerProjection[],
  operations: readonly ClientOperationItem[],
  hints: readonly OperationContainerHint[] = [],
): ContainerProjection[] {
  const known = new Set(
    containers.map((container) => container.containerRecordId),
  );
  const indexed = indexContainerHints(hints);
  const latest = new Map<string, ClientOperationItem>();
  for (const item of operations) {
    for (const id of referredContainerIds(item, indexed)) {
      if (!known.has(id) || latest.has(id)) continue;
      latest.set(id, item);
    }
  }
  return containers.map((container) => {
    const item = latest.get(container.containerRecordId);
    if (!item) return container;
    return { ...container, syncStatus: toContainerSyncStatus(item) };
  });
}

export function toCompensationRow(item: CompensationItem): CompensationRow {
  return {
    id: item.compensationId,
    actionLabel:
      ACTION_LABELS[item.compensationActionCode] ?? item.compensationActionCode,
    stateLabel: COMPENSATION_STATE_LABELS[item.state] ?? item.state,
    reasonCode: item.reasonCode,
    createdAt: item.createdAt,
  };
}

export function assertOperationRowSafe(row: ClientOperationRow): void {
  const serialized = JSON.stringify(row);
  for (const key of OPERATION_FORBIDDEN_RENDER_KEYS) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      throw new Error(`操作行不得包含 ${key}`);
    }
  }
  if (
    /"requestHash"\s*:/.test(serialized) ||
    /serviceKey|Bearer /.test(serialized)
  ) {
    throw new Error("操作行不得包含请求哈希或凭据");
  }
}
