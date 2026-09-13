import type {
  NodeTaskState,
  WorkOrderApplicability,
  WorkOrderState,
} from "@logix/contracts";

export type StateDecision =
  | { kind: "apply"; next: string }
  | { kind: "already_done" }
  | { kind: "reject"; code: string; message: string };

// GC-005 §5.2 合法转换。第一刀只走 ready/in_progress → completed 与重放。
export const WORK_ORDER_TRANSITIONS: Record<WorkOrderState, WorkOrderState[]> =
  {
    draft: ["ready", "cancelled"],
    ready: ["in_progress", "blocked", "completed", "cancelled"],
    in_progress: ["blocked", "completed", "failed", "cancelled"],
    blocked: ["ready", "in_progress", "completed", "failed", "cancelled"],
    completed: ["reopened"],
    failed: ["reopened", "cancelled"],
    reopened: [
      "ready",
      "in_progress",
      "blocked",
      "completed",
      "failed",
      "cancelled",
    ],
    cancelled: [],
  };

// GC-005 §5.1 合法转换。任务状态只能由创建、取消、重开和聚合器改变。
export const NODE_TASK_TRANSITIONS: Record<NodeTaskState, NodeTaskState[]> = {
  pending: ["in_progress", "blocked", "completed", "cancelled"],
  in_progress: ["blocked", "completed", "cancelled"],
  blocked: ["pending", "in_progress", "completed", "cancelled"],
  completed: ["reopened"],
  reopened: ["in_progress", "blocked", "completed", "cancelled"],
  cancelled: [],
};

export function decideWorkOrderCompletion(
  current: WorkOrderState,
): StateDecision {
  if (current === "completed") return { kind: "already_done" };
  if (WORK_ORDER_TRANSITIONS[current]?.includes("completed")) {
    return { kind: "apply", next: "completed" };
  }
  return {
    kind: "reject",
    code: "BUSINESS_STATE_VIOLATION",
    message: `工单状态 ${current} 不能完成`,
  };
}

export function decideNodeTaskTransition(
  current: NodeTaskState,
  next: NodeTaskState,
): StateDecision {
  if (current === next) return { kind: "already_done" };
  if (current === "cancelled") return { kind: "already_done" };
  if (NODE_TASK_TRANSITIONS[current]?.includes(next)) {
    return { kind: "apply", next };
  }
  return {
    kind: "reject",
    code: "BUSINESS_STATE_VIOLATION",
    message: `任务状态 ${current} 不能转到 ${next}`,
  };
}

export interface WorkOrderForAggregation {
  state: WorkOrderState;
  applicability: WorkOrderApplicability;
}

// GC-005 §6：required / conditional_required 全部 completed 才完成任务。
// optional 未完成不阻止；failed / blocked / cancelled 的 required 工单不得误完成。
export function aggregateNodeTaskState(
  workOrders: WorkOrderForAggregation[],
): NodeTaskState {
  if (workOrders.length === 0) {
    throw new Error("VALIDATION_FORMAT: NodeTask 至少需要一张工单");
  }

  const required = workOrders.filter(
    (workOrder) =>
      workOrder.applicability === "required" ||
      workOrder.applicability === "conditional_required",
  );
  if (required.length === 0) {
    throw new Error(
      "VALIDATION_FORMAT: NodeTask 至少需要一张 required 或 conditional_required 工单",
    );
  }

  if (
    required.some(
      (workOrder) =>
        workOrder.state === "failed" ||
        workOrder.state === "blocked" ||
        workOrder.state === "cancelled",
    )
  ) {
    return "blocked";
  }

  if (required.every((workOrder) => workOrder.state === "completed")) {
    return "completed";
  }

  const noneStarted = workOrders.every(
    (workOrder) => workOrder.state === "draft" || workOrder.state === "ready",
  );
  return noneStarted ? "pending" : "in_progress";
}
