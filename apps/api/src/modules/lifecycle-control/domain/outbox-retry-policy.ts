// 本刀占位策略：参数不写入 Outbox 业务状态，只供失败裁决读取。
export const FIRST_SLICE_OUTBOX_RETRY_POLICY: OutboxRetryPolicy = {
  policyCode: "outbox_publish_first_slice",
  policyVersion: 1,
  retryableFailureCodes: [
    "timeout",
    "network_error",
    "rate_limited",
    "dependency_unavailable",
  ],
  initialDelaySeconds: 5,
  backoffMultiplier: 2,
  jitterRatio: 0,
  maximumAttempts: 3,
  totalTimeoutSeconds: 300,
};

export const FIRST_SLICE_DEAD_LETTER_QUEUE = "lifecycle-control-outbox";

export type OutboxRetryPolicy = {
  policyCode: string;
  policyVersion: number;
  retryableFailureCodes: readonly string[];
  initialDelaySeconds: number;
  backoffMultiplier: number;
  jitterRatio: number;
  maximumAttempts: number;
  totalTimeoutSeconds: number;
};

export function nextOutboxRetryAt(
  policy: OutboxRetryPolicy,
  attemptCount: number,
  now: Date,
): Date {
  const exponent = Math.max(0, attemptCount - 1);
  const delaySeconds =
    policy.initialDelaySeconds * policy.backoffMultiplier ** exponent;
  return new Date(now.getTime() + delaySeconds * 1000);
}
