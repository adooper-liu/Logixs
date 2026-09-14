import type { CompleteWorkOrderResult } from "../api/nodeTasks";
import type { SubmissionView } from "./sample";

export const COMPLETE_WORK_ORDER_ACTION = "work_execution.complete_work_order";
export const COMPLETE_WORK_ORDER_LABEL = "完成工单";

const COMPLETABLE_WORK_ORDER_STATES = new Set([
  "ready",
  "in_progress",
  "blocked",
  "reopened",
]);

const BUSINESS_NO_RETRY = new Set([
  "EVIDENCE_REQUIRED",
  "BUSINESS_STATE_VIOLATION",
  "IDEMPOTENCY_CONFLICT",
  "AUTHORIZATION_SCOPE_DENIED",
  "VALIDATION_FORMAT",
  "RESOURCE_NOT_FOUND",
]);

export function canCompleteWorkOrder(state: string): boolean {
  return COMPLETABLE_WORK_ORDER_STATES.has(state);
}

export function parseEvidenceInput(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\s,]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

export function extractErrorCode(message: string): string {
  const match = message.match(/\b([A-Z][A-Z0-9_]{2,})\b/);
  return match?.[1] ?? "REQUEST_FAILED";
}

export function toSendingSubmission(
  taskId: string,
  actionCode = COMPLETE_WORK_ORDER_ACTION,
): SubmissionView {
  return {
    taskId,
    actionCode,
    stage: "sending",
    message: "正在提交…",
  };
}

export function toCompleteSubmission(input: {
  taskId: string;
  result: CompleteWorkOrderResult;
  observedAt: string;
}): SubmissionView {
  const { result, taskId, observedAt } = input;
  const base = {
    taskId,
    actionCode: COMPLETE_WORK_ORDER_ACTION,
    clientOperationId: result.clientOperationId,
    resultSummary: result.workOrderState,
    resultEventCode: result.lifecycleEventCode ?? undefined,
  };

  if (result.commitState === "committed") {
    return {
      ...base,
      stage: "committed",
      receivedAt: observedAt,
      acceptedAt: observedAt,
      committedAt: observedAt,
      message:
        result.lifecycleApply === "rejected"
          ? "已落账；生命周期申请未成功"
          : "已落账",
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

  if (result.businessDecisionState === "accepted") {
    return {
      ...base,
      stage: "accepted",
      receivedAt: observedAt,
      acceptedAt: observedAt,
      message: "业务已接受",
    };
  }

  return {
    ...base,
    stage: "received",
    receivedAt: observedAt,
    message: "服务器已收到",
  };
}

export function toFailedSubmission(input: {
  taskId: string;
  message: string;
  actionCode?: string;
}): SubmissionView {
  const errorCode = extractErrorCode(input.message);
  return {
    taskId: input.taskId,
    actionCode: input.actionCode ?? COMPLETE_WORK_ORDER_ACTION,
    stage: "rejected",
    errorCode,
    message: input.message,
    canRetry: !BUSINESS_NO_RETRY.has(errorCode),
  };
}
