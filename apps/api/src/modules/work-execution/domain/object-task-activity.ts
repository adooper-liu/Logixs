import { WORK_CLAIM_ACTION, WORK_COMPLETE_ACTION } from "./client-operation";
import type {
  NodeTaskWithWorkOrders,
  WorkOrderRecord,
} from "./work-execution.repository";

export type ObjectTaskActivityCode =
  "task_created" | "work_order_claimed" | "work_order_completed";

export interface WorkActivityOperation {
  id: string;
  actionCode: string;
  targetId: string;
  actorId: string;
  committedAt: Date;
  recordedAt: Date;
}

export interface ObjectTaskActivityRecord {
  id: string;
  activityCode: ObjectTaskActivityCode;
  sourceType: "node_task" | "client_operation";
  sourceId: string;
  occurredAt: Date;
  recordedAt: Date;
  containerId: string;
  taskId: string;
  workOrderId: string | null;
  actorId: string | null;
  nodeCode: string;
  taskDefinitionKey: string;
  workOrderDefinitionKey: string | null;
}

export interface TaskNextAction {
  actionCode: typeof WORK_CLAIM_ACTION | typeof WORK_COMPLETE_ACTION;
  containerId: string;
  taskId: string;
  workOrderId: string;
  nodeCode: NodeTaskWithWorkOrders["task"]["nodeCode"];
  taskDefinitionKey: string;
  workOrderDefinitionKey: string;
  assignmentState: WorkOrderRecord["assignmentState"];
  assigneeId: string | null;
  dueAt: Date | null;
}

const CLAIMABLE_STATES = new Set(["ready", "reopened", "in_progress"]);
const COMPLETABLE_STATES = new Set([
  "ready",
  "in_progress",
  "blocked",
  "reopened",
]);

export function projectNextActions(
  bundles: readonly NodeTaskWithWorkOrders[],
): TaskNextAction[] {
  return bundles.flatMap((bundle) => {
    const { task } = bundle;
    if (
      !task.containerId ||
      task.applicability === "optional_not_applicable" ||
      task.readinessState !== "ready" ||
      task.state === "completed" ||
      task.state === "cancelled"
    ) {
      return [];
    }

    const candidates = [...bundle.workOrders].sort(compareWorkOrders);
    for (const workOrder of candidates) {
      const actionCode = nextActionCode(workOrder);
      if (!actionCode) continue;
      return [
        {
          actionCode,
          containerId: task.containerId,
          taskId: task.id,
          workOrderId: workOrder.id,
          nodeCode: task.nodeCode,
          taskDefinitionKey: task.taskDefinitionKey,
          workOrderDefinitionKey: workOrder.workOrderDefinitionKey,
          assignmentState: workOrder.assignmentState,
          assigneeId: workOrder.assigneeId,
          dueAt: workOrder.dueAt,
        },
      ];
    }
    return [];
  });
}

export function projectTaskActivities(
  bundles: readonly NodeTaskWithWorkOrders[],
  operations: readonly WorkActivityOperation[],
): ObjectTaskActivityRecord[] {
  const byWorkOrderId = new Map<
    string,
    { bundle: NodeTaskWithWorkOrders; workOrder: WorkOrderRecord }
  >();
  const created = bundles.flatMap((bundle) => {
    if (!bundle.task.containerId) return [];
    for (const workOrder of bundle.workOrders) {
      byWorkOrderId.set(workOrder.id, { bundle, workOrder });
    }
    return [
      {
        id: `task:${bundle.task.id}:created`,
        activityCode: "task_created" as const,
        sourceType: "node_task" as const,
        sourceId: bundle.task.id,
        occurredAt: bundle.task.createdAt,
        recordedAt: bundle.task.createdAt,
        containerId: bundle.task.containerId,
        taskId: bundle.task.id,
        workOrderId: null,
        actorId: null,
        nodeCode: bundle.task.nodeCode,
        taskDefinitionKey: bundle.task.taskDefinitionKey,
        workOrderDefinitionKey: null,
      },
    ];
  });

  const operationActivities = operations.flatMap((operation) => {
    const context = byWorkOrderId.get(operation.targetId);
    if (!context?.bundle.task.containerId) return [];
    const activityCode = operationActivityCode(operation.actionCode);
    if (!activityCode) return [];
    return [
      {
        id: `operation:${operation.id}`,
        activityCode,
        sourceType: "client_operation" as const,
        sourceId: operation.id,
        occurredAt: operation.committedAt,
        recordedAt: operation.recordedAt,
        containerId: context.bundle.task.containerId,
        taskId: context.bundle.task.id,
        workOrderId: context.workOrder.id,
        actorId: operation.actorId,
        nodeCode: context.bundle.task.nodeCode,
        taskDefinitionKey: context.bundle.task.taskDefinitionKey,
        workOrderDefinitionKey: context.workOrder.workOrderDefinitionKey,
      },
    ];
  });

  return [...created, ...operationActivities];
}

function nextActionCode(
  workOrder: WorkOrderRecord,
): TaskNextAction["actionCode"] | null {
  if (
    (workOrder.assignmentState === "unassigned" ||
      workOrder.assignmentState === "pool") &&
    CLAIMABLE_STATES.has(workOrder.state)
  ) {
    return WORK_CLAIM_ACTION;
  }
  if (
    (workOrder.assignmentState === "assigned" ||
      workOrder.assignmentState === "automatic") &&
    COMPLETABLE_STATES.has(workOrder.state)
  ) {
    return WORK_COMPLETE_ACTION;
  }
  return null;
}

function operationActivityCode(
  actionCode: string,
): ObjectTaskActivityCode | null {
  if (actionCode === WORK_CLAIM_ACTION) return "work_order_claimed";
  if (actionCode === WORK_COMPLETE_ACTION) return "work_order_completed";
  return null;
}

function compareWorkOrders(
  left: WorkOrderRecord,
  right: WorkOrderRecord,
): number {
  const leftDue = left.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const rightDue = right.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
  return (
    leftDue - rightDue ||
    left.createdAt.getTime() - right.createdAt.getTime() ||
    left.id.localeCompare(right.id)
  );
}
