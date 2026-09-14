import type { AssignmentState, WorkOrderState } from "@logix/contracts";

export type ClaimDecision =
  | { kind: "apply"; nextState: "in_progress"; assignmentState: "assigned" }
  | { kind: "already_done" }
  | { kind: "reject"; code: string; message: string };

const CLAIMABLE_ASSIGNMENT = new Set<AssignmentState>(["unassigned", "pool"]);
const CLAIMABLE_STATE = new Set<WorkOrderState>([
  "ready",
  "reopened",
  "in_progress",
]);

export function decideWorkOrderClaim(input: {
  state: WorkOrderState;
  assignmentState: AssignmentState;
  assigneeId: string | null;
  actorId: string;
}): ClaimDecision {
  const actorId = input.actorId.trim();
  if (!actorId) {
    return {
      kind: "reject",
      code: "AUTHORIZATION_SCOPE_DENIED",
      message: "缺少操作者",
    };
  }

  if (input.assignmentState === "automatic") {
    return {
      kind: "reject",
      code: "BUSINESS_STATE_VIOLATION",
      message: "自动工单不用领取",
    };
  }

  if (input.assignmentState === "assigned" && input.assigneeId === actorId) {
    return { kind: "already_done" };
  }

  if (
    input.assignmentState === "assigned" &&
    input.assigneeId &&
    input.assigneeId !== actorId
  ) {
    return {
      kind: "reject",
      code: "BUSINESS_STATE_VIOLATION",
      message: "工单已被他人领取",
    };
  }

  if (
    CLAIMABLE_ASSIGNMENT.has(input.assignmentState) &&
    CLAIMABLE_STATE.has(input.state)
  ) {
    return {
      kind: "apply",
      nextState: "in_progress",
      assignmentState: "assigned",
    };
  }

  return {
    kind: "reject",
    code: "BUSINESS_STATE_VIOLATION",
    message: `工单状态 ${input.state} 不能领取`,
  };
}
