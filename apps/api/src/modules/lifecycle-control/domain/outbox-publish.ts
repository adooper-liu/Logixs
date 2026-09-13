import { LIFECYCLE_OUTBOX_OWNER } from "./outbox-message";

export const FIRST_SLICE_PUBLISH_LEASE_SECONDS = 30;
export const DEFAULT_PUBLISH_BATCH_LIMIT = 50;
export const MIN_PUBLISH_BATCH_LIMIT = 1;
export const MAX_PUBLISH_BATCH_LIMIT = 200;
export const DEFAULT_DRAIN_ROUNDS = 5;
export const MIN_DRAIN_ROUNDS = 1;
export const MAX_DRAIN_ROUNDS = 20;

export type OutboxPublishState =
  | "pending"
  | "publishing"
  | "published"
  | "retry_wait"
  | "dead_letter";

export interface OutboxLease {
  owner: string;
  lockedAt: Date;
  expiresAt: Date;
}

export interface ClaimedOutbox {
  id: string;
  tenantId: string;
  ownerModule: string;
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payloadRef: string;
  payloadHash: string;
  state: "publishing";
  attemptCount: number;
  lease: OutboxLease;
  occurredAt: Date;
  createdAt: Date;
  idempotencyKey: string;
  traceId: string;
}

export function parsePublishBatchLimit(raw: number | string | undefined): number {
  if (raw === undefined || raw === "") return DEFAULT_PUBLISH_BATCH_LIMIT;
  const text = typeof raw === "number" ? String(raw) : raw;
  if (!/^\d+$/.test(text)) {
    throw new Error("VALIDATION_FORMAT: limit 必须是整数");
  }
  const limit = Number(text);
  if (limit < MIN_PUBLISH_BATCH_LIMIT || limit > MAX_PUBLISH_BATCH_LIMIT) {
    throw new Error("VALIDATION_FORMAT: limit 超出 1–200");
  }
  return limit;
}

export function parseDrainRounds(raw: number | string | undefined): number {
  if (raw === undefined || raw === "") return DEFAULT_DRAIN_ROUNDS;
  const text = typeof raw === "number" ? String(raw) : raw;
  if (!/^\d+$/.test(text)) {
    throw new Error("VALIDATION_FORMAT: maxRounds 必须是整数");
  }
  const rounds = Number(text);
  if (rounds < MIN_DRAIN_ROUNDS || rounds > MAX_DRAIN_ROUNDS) {
    throw new Error("VALIDATION_FORMAT: maxRounds 超出 1–20");
  }
  return rounds;
}

export function shouldContinueOutboxDrain(input: {
  claimed: number;
  round: number;
  maxRounds: number;
}): boolean {
  return input.claimed > 0 && input.round < input.maxRounds;
}

export function isOutboxClaimable(input: {
  state: OutboxPublishState;
  lease: OutboxLease | null;
  nextAttemptAt: Date | null;
  now: Date;
}): boolean {
  if (input.nextAttemptAt && input.nextAttemptAt > input.now) return false;
  if (input.state === "pending" || input.state === "retry_wait") return true;
  if (input.state === "publishing") {
    return input.lease === null || input.lease.expiresAt <= input.now;
  }
  return false;
}

export function beginOutboxPublishing(input: {
  attemptCount: number;
  owner: string;
  now: Date;
  leaseSeconds?: number;
}): { state: "publishing"; attemptCount: number; lease: OutboxLease } {
  const owner = input.owner.trim();
  if (owner.length === 0 || owner.length > 128) {
    throw new Error("VALIDATION_FORMAT: lease owner 无效");
  }
  const leaseSeconds = input.leaseSeconds ?? FIRST_SLICE_PUBLISH_LEASE_SECONDS;
  return {
    state: "publishing",
    attemptCount: input.attemptCount + 1,
    lease: {
      owner,
      lockedAt: input.now,
      expiresAt: new Date(input.now.getTime() + leaseSeconds * 1000),
    },
  };
}

export function completeOutboxPublished(input: {
  brokerReference: string;
  publishedAt: Date;
}): { state: "published"; brokerReference: string; publishedAt: Date } {
  const brokerReference = input.brokerReference.trim();
  if (brokerReference.length === 0 || brokerReference.length > 200) {
    throw new Error("VALIDATION_FORMAT: brokerReference 无效");
  }
  return {
    state: "published",
    brokerReference,
    publishedAt: input.publishedAt,
  };
}

export function lifecycleOutboxOwnerModule(): string {
  return LIFECYCLE_OUTBOX_OWNER;
}
