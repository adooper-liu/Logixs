import {
  FIRST_SLICE_DEAD_LETTER_QUEUE,
  FIRST_SLICE_OUTBOX_RETRY_POLICY,
  nextOutboxRetryAt,
  type OutboxRetryPolicy,
} from "./outbox-retry-policy";

const FAILURE_CATEGORY_BY_CODE: Record<string, string> = {
  timeout: "transient_technical",
  network_error: "transient_technical",
  rate_limited: "rate_limit",
  dependency_unavailable: "dependency",
  schema_invalid: "schema",
  authorization_denied: "authorization",
  business_rejected: "business",
  unknown_code: "unknown_code",
  idempotency_conflict: "idempotency",
  illegal_state: "illegal_state",
  task_not_initialized: "dependency",
  concurrency_conflict: "dependency",
  node_task_cancelled: "business",
  work_order_definition_unresolved: "business",
  work_order_state_not_completable: "business",
};

export class OutboxDeliveryError extends Error {
  readonly errorCode: string;

  constructor(errorCode: string, message?: string) {
    super(message ?? errorCode);
    this.name = "OutboxDeliveryError";
    this.errorCode = errorCode;
  }
}

export type OutboxDeliveryDecision =
  | {
      state: "retry_wait";
      nextAttemptAt: Date;
      lastErrorCode: string;
      failureCategory: string;
    }
  | {
      state: "dead_letter";
      lastErrorCode: string;
      failureCategory: string;
      deadLetteredAt: Date;
      ownerQueue: string;
    };

export function classifyOutboxDeliveryError(error: unknown): {
  errorCode: string;
  failureCategory: string;
} {
  if (
    error instanceof OutboxDeliveryError &&
    error.errorCode in FAILURE_CATEGORY_BY_CODE
  ) {
    return {
      errorCode: error.errorCode,
      failureCategory: FAILURE_CATEGORY_BY_CODE[error.errorCode],
    };
  }
  return {
    errorCode: "unknown_code",
    failureCategory: "unknown_code",
  };
}

export function decideOutboxFailure(input: {
  attemptCount: number;
  createdAt: Date;
  now: Date;
  error: unknown;
  policy?: OutboxRetryPolicy;
  ownerQueue?: string;
}): OutboxDeliveryDecision {
  const policy = input.policy ?? FIRST_SLICE_OUTBOX_RETRY_POLICY;
  const classified = classifyOutboxDeliveryError(input.error);
  const retryable = policy.retryableFailureCodes.includes(classified.errorCode);
  const exhausted = input.attemptCount >= policy.maximumAttempts;
  const timedOut =
    input.now.getTime() - input.createdAt.getTime() >=
    policy.totalTimeoutSeconds * 1000;

  if (!retryable || exhausted || timedOut) {
    return {
      state: "dead_letter",
      lastErrorCode: classified.errorCode,
      failureCategory: classified.failureCategory,
      deadLetteredAt: input.now,
      ownerQueue: input.ownerQueue ?? FIRST_SLICE_DEAD_LETTER_QUEUE,
    };
  }

  return {
    state: "retry_wait",
    nextAttemptAt: nextOutboxRetryAt(policy, input.attemptCount, input.now),
    lastErrorCode: classified.errorCode,
    failureCategory: classified.failureCategory,
  };
}
