import {
  decideOutboxFailure,
  OutboxDeliveryError,
  type OutboxDeliveryDecision,
} from "./outbox-failure";

export const FIRST_SLICE_INBOX_DEAD_LETTER_QUEUE = "lifecycle-control-inbox";

export class InboxConsumptionError extends OutboxDeliveryError {
  constructor(errorCode: string, message?: string) {
    super(errorCode, message);
    this.name = "InboxConsumptionError";
  }
}

export function decideInboxFailure(input: {
  attemptCount: number;
  receivedAt: Date;
  now: Date;
  error: unknown;
}): OutboxDeliveryDecision {
  return decideOutboxFailure({
    attemptCount: input.attemptCount,
    createdAt: input.receivedAt,
    now: input.now,
    error: input.error,
    ownerQueue: FIRST_SLICE_INBOX_DEAD_LETTER_QUEUE,
  });
}

export function classifyHttpConsumeError(
  error: unknown,
): InboxConsumptionError {
  if (error instanceof InboxConsumptionError) return error;
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("VALIDATION_FORMAT")) {
    return new InboxConsumptionError("schema_invalid", message);
  }
  if (message.startsWith("AUTHORIZATION_SCOPE_DENIED")) {
    return new InboxConsumptionError("authorization_denied", message);
  }
  if (
    message.startsWith("EVIDENCE_REQUIRED") ||
    message.startsWith("TIME_ORDER_CONFLICT") ||
    message.startsWith("RESOURCE_NOT_FOUND")
  ) {
    return new InboxConsumptionError("business_rejected", message);
  }
  if (
    message.includes("timeout") ||
    message.includes("ECONN") ||
    message.includes("dependency")
  ) {
    return new InboxConsumptionError("dependency_unavailable", message);
  }
  return new InboxConsumptionError("unknown_code", message || "unknown");
}
