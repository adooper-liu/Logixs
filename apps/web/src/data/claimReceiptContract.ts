import type { ClaimWorkOrderResult } from "../api/nodeTasks";
import type { SubmissionView } from "./sample";

export const CLAIM_WORK_ORDER_ACTION = "work_execution.claim_work_order";
export const CLAIM_WORK_ORDER_LABEL = "领取";

const CLAIMABLE_ASSIGNMENT = new Set(["unassigned", "pool"]);
const CLAIMABLE_STATE = new Set(["ready", "reopened", "in_progress"]);

export function canClaimWorkOrder(input: {
  state: string;
  assignmentState: string;
}): boolean {
  return (
    CLAIMABLE_ASSIGNMENT.has(input.assignmentState) &&
    CLAIMABLE_STATE.has(input.state)
  );
}

export function isAssignedTo(
  assigneeId: string | null | undefined,
  operatorId: string,
): boolean {
  return Boolean(assigneeId && assigneeId === operatorId);
}

export function toClaimSubmission(input: {
  taskId: string;
  result: ClaimWorkOrderResult;
  observedAt: string;
}): SubmissionView {
  const { result, taskId, observedAt } = input;
  const base = {
    taskId,
    actionCode: CLAIM_WORK_ORDER_ACTION,
    clientOperationId: result.clientOperationId,
    resultSummary: result.workOrderState,
  };

  if (result.commitState === "committed") {
    return {
      ...base,
      stage: "committed",
      receivedAt: observedAt,
      acceptedAt: observedAt,
      committedAt: observedAt,
      message: "已领取",
    };
  }

  if (
    result.businessDecisionState === "rejected" ||
    result.receptionState === "boundary_rejected"
  ) {
    const errorCode = result.rejectionReasonCode ?? "BUSINESS_REJECTED";
    return {
      ...base,
      stage: "rejected",
      receivedAt: observedAt,
      errorCode,
      message: errorCode,
      canRetry: false,
    };
  }

  return {
    ...base,
    stage: "received",
    receivedAt: observedAt,
    message: "服务器已收到",
  };
}
