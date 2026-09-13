export const FIRST_SLICE_INBOX_LEASE_SECONDS = 30;
export const DEFAULT_INBOX_CLAIM_LIMIT = 50;
export const MIN_INBOX_CLAIM_LIMIT = 1;
export const MAX_INBOX_CLAIM_LIMIT = 200;

export type InboxClaimState =
  "received" | "processing" | "processed" | "retry_wait" | "dead_letter";

export interface InboxLease {
  owner: string;
  lockedAt: Date;
  expiresAt: Date;
}

export interface ClaimedInbox {
  id: string;
  tenantId: string;
  consumerName: string;
  messageId: string;
  payloadHash: string;
  payloadJson: unknown;
  state: "processing";
  attemptCount: number;
  lease: InboxLease;
  traceId: string;
  receivedAt: Date;
}

export function parseInboxClaimLimit(raw: number | string | undefined): number {
  if (raw === undefined || raw === "") return DEFAULT_INBOX_CLAIM_LIMIT;
  const text = typeof raw === "number" ? String(raw) : raw;
  if (!/^\d+$/.test(text)) {
    throw new Error("VALIDATION_FORMAT: limit 必须是整数");
  }
  const limit = Number(text);
  if (limit < MIN_INBOX_CLAIM_LIMIT || limit > MAX_INBOX_CLAIM_LIMIT) {
    throw new Error("VALIDATION_FORMAT: limit 超出 1–200");
  }
  return limit;
}

export function isInboxClaimable(input: {
  state: InboxClaimState;
  lease: InboxLease | null;
  nextAttemptAt?: Date | null;
  now: Date;
}): boolean {
  if (input.nextAttemptAt && input.nextAttemptAt > input.now) return false;
  if (input.state === "received" || input.state === "retry_wait") return true;
  if (input.state === "processing") {
    return input.lease === null || input.lease.expiresAt <= input.now;
  }
  return false;
}

export function beginInboxProcessing(input: {
  attemptCount: number;
  owner: string;
  now: Date;
  leaseSeconds?: number;
}): { state: "processing"; attemptCount: number; lease: InboxLease } {
  const owner = input.owner.trim();
  if (owner.length === 0 || owner.length > 128) {
    throw new Error("VALIDATION_FORMAT: lease owner 无效");
  }
  const leaseSeconds = input.leaseSeconds ?? FIRST_SLICE_INBOX_LEASE_SECONDS;
  return {
    state: "processing",
    attemptCount: input.attemptCount + 1,
    lease: {
      owner,
      lockedAt: input.now,
      expiresAt: new Date(input.now.getTime() + leaseSeconds * 1000),
    },
  };
}

export function completeInboxProcessed(input: { processedAt: Date }): {
  state: "processed";
  processedAt: Date;
} {
  if (Number.isNaN(input.processedAt.getTime())) {
    throw new Error("VALIDATION_FORMAT: processedAt 无效");
  }
  return {
    state: "processed",
    processedAt: input.processedAt,
  };
}
