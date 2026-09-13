import { createHash } from "node:crypto";
import type { OutboxPublishState } from "./outbox-publish";

const PAYLOAD_HASH_PATTERN = /^[a-f0-9]{64}$/;

export interface StoredOutboxMessage {
  id: string;
  tenantId: string;
  ownerModule: string;
  eventId: string;
  eventType: string;
  eventVersion: number;
  aggregateType: string;
  aggregateId: string;
  payloadRef: string;
  payloadHash: string;
  state: OutboxPublishState;
  attemptCount: number;
  occurredAt: Date;
  idempotencyKey: string;
  causationId: string | null;
  traceId: string;
}

export interface ReplayOutboxDraft {
  id: string;
  tenantId: string;
  ownerModule: string;
  eventId: string;
  eventType: string;
  eventVersion: number;
  aggregateType: string;
  aggregateId: string;
  payloadRef: string;
  payloadHash: string;
  causationId: string;
  state: "pending";
  attemptCount: 0;
  occurredAt: Date;
  idempotencyKey: string;
  traceId: string;
}

export interface ReplayRequestDraft {
  tenantId: string;
  deadLetterId: string;
  replayedOutboxId: string;
  targetConsumerVersion: string;
  requestedBy: string;
  reasonCode: string;
  requestedAt: Date;
  traceId: string;
  idempotencyKey: string;
  requestHash: string;
}

export function assertReplayCommand(input: {
  reasonCode: string;
  targetConsumerVersion: string;
  idempotencyKey: string;
  requestedBy: string;
  payloadRef?: string;
  payloadHash?: string;
}): {
  reasonCode: string;
  targetConsumerVersion: string;
  idempotencyKey: string;
  requestedBy: string;
  payloadRef?: string;
  payloadHash?: string;
} {
  const reasonCode = input.reasonCode.trim();
  const targetConsumerVersion = input.targetConsumerVersion.trim();
  const idempotencyKey = input.idempotencyKey.trim();
  const requestedBy = input.requestedBy.trim();
  if (reasonCode.length === 0 || reasonCode.length > 64) {
    throw new Error("VALIDATION_FORMAT: reasonCode 无效");
  }
  if (
    targetConsumerVersion.length === 0 ||
    targetConsumerVersion.length > 64
  ) {
    throw new Error("VALIDATION_FORMAT: targetConsumerVersion 无效");
  }
  if (idempotencyKey.length === 0 || idempotencyKey.length > 200) {
    throw new Error("VALIDATION_FORMAT: idempotencyKey 无效");
  }
  if (requestedBy.length === 0 || requestedBy.length > 128) {
    throw new Error("VALIDATION_FORMAT: requestedBy 无效");
  }
  const payloadRef = input.payloadRef?.trim();
  const payloadHash = input.payloadHash?.trim();
  const hasRef = payloadRef !== undefined && payloadRef.length > 0;
  const hasHash = payloadHash !== undefined && payloadHash.length > 0;
  if (hasRef !== hasHash) {
    throw new Error("VALIDATION_FORMAT: payloadRef 与 payloadHash 必须同时提供");
  }
  if (hasRef && hasHash) {
    if (payloadRef.length > 500) {
      throw new Error("VALIDATION_FORMAT: payloadRef 无效");
    }
    if (!PAYLOAD_HASH_PATTERN.test(payloadHash)) {
      throw new Error("VALIDATION_FORMAT: payloadHash 必须是 sha256 hex");
    }
    return {
      reasonCode,
      targetConsumerVersion,
      idempotencyKey,
      requestedBy,
      payloadRef,
      payloadHash,
    };
  }
  return { reasonCode, targetConsumerVersion, idempotencyKey, requestedBy };
}

export function resolveReplayPayload(input: {
  original: Pick<StoredOutboxMessage, "payloadRef" | "payloadHash">;
  payloadRef?: string;
  payloadHash?: string;
}): { payloadRef: string; payloadHash: string; corrected: boolean } {
  if (input.payloadRef === undefined || input.payloadHash === undefined) {
    return {
      payloadRef: input.original.payloadRef,
      payloadHash: input.original.payloadHash,
      corrected: false,
    };
  }
  return {
    payloadRef: input.payloadRef,
    payloadHash: input.payloadHash,
    corrected:
      input.payloadRef !== input.original.payloadRef ||
      input.payloadHash !== input.original.payloadHash,
  };
}

export function hashReplayRequest(input: {
  reasonCode: string;
  targetConsumerVersion: string;
  payloadRef: string;
  payloadHash: string;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        payloadHash: input.payloadHash,
        payloadRef: input.payloadRef,
        reasonCode: input.reasonCode,
        targetConsumerVersion: input.targetConsumerVersion,
      }),
      "utf8",
    )
    .digest("hex");
}

export function compareReplayIdempotency(
  storedHash: string | null,
  computedHash: string,
): "replay" | "conflict" {
  if (!storedHash || storedHash !== computedHash) return "conflict";
  return "replay";
}

export function decideReplayDeadLetter(input: {
  state: OutboxPublishState;
  tenantId: string;
  commandTenantId: string;
}): { kind: "ok" } | { kind: "reject"; code: string; message: string } {
  if (input.tenantId !== input.commandTenantId) {
    return {
      kind: "reject",
      code: "AUTHORIZATION_SCOPE_DENIED",
      message: "租户不匹配",
    };
  }
  if (input.state !== "dead_letter") {
    return {
      kind: "reject",
      code: "BUSINESS_STATE_VIOLATION",
      message: "只有死信可以人工重放",
    };
  }
  return { kind: "ok" };
}

export function buildReplayOutbox(input: {
  original: StoredOutboxMessage;
  replayEventId: string;
  commandIdempotencyKey: string;
  requestedAt: Date;
  traceId: string;
  payloadRef: string;
  payloadHash: string;
}): ReplayOutboxDraft {
  if (input.replayEventId === input.original.eventId) {
    throw new Error("VALIDATION_FORMAT: 重放不得复用原 eventId");
  }
  return {
    id: input.replayEventId,
    tenantId: input.original.tenantId,
    ownerModule: input.original.ownerModule,
    eventId: input.replayEventId,
    eventType: input.original.eventType,
    eventVersion: input.original.eventVersion,
    aggregateType: input.original.aggregateType,
    aggregateId: input.original.aggregateId,
    payloadRef: input.payloadRef,
    payloadHash: input.payloadHash,
    causationId: input.original.eventId,
    state: "pending",
    attemptCount: 0,
    occurredAt: input.original.occurredAt,
    idempotencyKey: `replay:${input.original.id}:${input.commandIdempotencyKey}`,
    traceId: input.traceId,
  };
}

export function buildReplayRequest(input: {
  originalId: string;
  replay: ReplayOutboxDraft;
  targetConsumerVersion: string;
  requestedBy: string;
  reasonCode: string;
  requestedAt: Date;
  commandIdempotencyKey: string;
  requestHash: string;
}): ReplayRequestDraft {
  return {
    tenantId: input.replay.tenantId,
    deadLetterId: input.originalId,
    replayedOutboxId: input.replay.id,
    targetConsumerVersion: input.targetConsumerVersion,
    requestedBy: input.requestedBy,
    reasonCode: input.reasonCode,
    requestedAt: input.requestedAt,
    traceId: input.replay.traceId,
    idempotencyKey: input.commandIdempotencyKey,
    requestHash: input.requestHash,
  };
}
