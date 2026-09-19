import { HttpException, HttpStatus } from "@nestjs/common";
import type { LifecycleDateApplicationState } from "../domain/lifecycle-date-fact";

export interface LifecycleApplicationFailureDecision {
  state: Extract<
    LifecycleDateApplicationState,
    "pending_application" | "rejected"
  >;
  reasonCode: string;
}

export function classifyLifecycleApplicationFailure(
  error: unknown,
): LifecycleApplicationFailureDecision {
  const reasonCode = publicReasonCode(error);
  if (!(error instanceof HttpException)) {
    return { state: "pending_application", reasonCode };
  }
  const status = error.getStatus();
  const permanentlyRejected = [
    "LIFECYCLE_TIME_ORDER_CONFLICT",
    "LIFECYCLE_HISTORY_SEALED",
    "LIFECYCLE_IDEMPOTENCY_CONFLICT",
    "LIFECYCLE_GUARD_NOT_SATISFIED",
  ].includes(reasonCode);
  const retryable =
    !permanentlyRejected &&
    ([
      HttpStatus.CONFLICT,
      HttpStatus.PRECONDITION_FAILED,
      HttpStatus.TOO_MANY_REQUESTS,
      HttpStatus.BAD_GATEWAY,
      HttpStatus.SERVICE_UNAVAILABLE,
      HttpStatus.GATEWAY_TIMEOUT,
    ].includes(status) ||
      status >= 500);
  return {
    state: retryable ? "pending_application" : "rejected",
    reasonCode,
  };
}

function publicReasonCode(error: unknown): string {
  const message =
    error instanceof Error ? error.message : "LIFECYCLE_APPLY_FAILED";
  return (
    message.split(":")[0]?.trim().slice(0, 100) || "LIFECYCLE_APPLY_FAILED"
  );
}
