import {
  buildInboxReceived,
  inboxPayloadRef,
  type InboxReceivedRecord,
} from "./inbox-message";
import type { InboxClaimState } from "./inbox-processing";

export interface StoredInboxDeadLetter {
  id: string;
  tenantId: string;
  consumerName: string;
  messageId: string;
  payloadHash: string;
  payloadJson: unknown;
  state: InboxClaimState;
  attemptCount: number;
  lastErrorCode: string | null;
  failureCategory: string | null;
  ownerQueue: string | null;
  deadLetteredAt: Date | null;
  receivedAt: Date;
  causationId: string | null;
  traceId: string;
}

export interface InboxDeadLetterSummary {
  id: string;
  messageId: string;
  consumerName: string;
  payloadRef: string;
  payloadHash: string;
  attemptCount: number;
  lastErrorCode: string | null;
  failureCategory: string | null;
  ownerQueue: string | null;
  deadLetteredAt: Date;
  receivedAt: Date;
  causationId: string | null;
  traceId: string;
}

export interface InboxReplayRequestDraft {
  tenantId: string;
  deadLetterId: string;
  replayedInboxId: string;
  replayedMessageId: string;
  targetConsumerVersion: string;
  requestedBy: string;
  reasonCode: string;
  requestedAt: Date;
  traceId: string;
  idempotencyKey: string;
  requestHash: string;
}

export function decideReplayInboxDeadLetter(input: {
  state: string;
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

export function assertInboxReplayPayload(payloadJson: unknown): unknown {
  if (payloadJson === undefined || payloadJson === null) {
    throw new Error("BUSINESS_STATE_VIOLATION: 死信缺少可重放载荷");
  }
  return payloadJson;
}

export function parseInboxPayloadRef(raw: string): string {
  const payloadRef = raw.trim();
  if (!payloadRef.startsWith("inbox/") || payloadRef.length > 500) {
    throw new Error("VALIDATION_FORMAT: payloadRef 必须是 inbox/{id}");
  }
  const inboxId = payloadRef.slice("inbox/".length).trim();
  if (!inboxId || inboxId.includes("/")) {
    throw new Error("VALIDATION_FORMAT: payloadRef 必须是 inbox/{id}");
  }
  return inboxId;
}

export function resolveInboxReplayPayload(input: {
  original: Pick<
    StoredInboxDeadLetter,
    "id" | "consumerName" | "payloadHash" | "payloadJson"
  >;
  payloadRef?: string;
  payloadHash?: string;
  source?: Pick<
    StoredInboxDeadLetter,
    "id" | "consumerName" | "payloadHash" | "payloadJson"
  >;
}): {
  payloadRef: string;
  payloadHash: string;
  payloadJson: unknown;
  corrected: boolean;
} {
  if (input.payloadRef === undefined || input.payloadHash === undefined) {
    return {
      payloadRef: inboxPayloadRef(input.original.id),
      payloadHash: input.original.payloadHash,
      payloadJson: assertInboxReplayPayload(input.original.payloadJson),
      corrected: false,
    };
  }
  const sourceId = parseInboxPayloadRef(input.payloadRef);
  if (!input.source || input.source.id !== sourceId) {
    throw new Error("VALIDATION_FORMAT: payloadRef 无法解析为同租户 Inbox");
  }
  if (input.source.consumerName !== input.original.consumerName) {
    throw new Error("VALIDATION_FORMAT: 修正引用必须是同一消费者");
  }
  if (input.source.payloadHash !== input.payloadHash) {
    throw new Error("VALIDATION_FORMAT: payloadHash 与引用 Inbox 不一致");
  }
  return {
    payloadRef: inboxPayloadRef(input.source.id),
    payloadHash: input.source.payloadHash,
    payloadJson: assertInboxReplayPayload(input.source.payloadJson),
    corrected:
      input.source.id !== input.original.id ||
      input.source.payloadHash !== input.original.payloadHash,
  };
}

export function buildReplayInbox(input: {
  original: StoredInboxDeadLetter;
  replayId: string;
  replayMessageId: string;
  requestedAt: Date;
  traceId: string;
  payloadHash?: string;
  payloadJson?: unknown;
}): InboxReceivedRecord {
  if (input.replayMessageId === input.original.messageId) {
    throw new Error("VALIDATION_FORMAT: 重放不得复用原 messageId");
  }
  if (input.replayId === input.original.id) {
    throw new Error("VALIDATION_FORMAT: 重放不得复用原 inboxRecordId");
  }
  return buildInboxReceived({
    id: input.replayId,
    tenantId: input.original.tenantId,
    consumerName: input.original.consumerName,
    messageId: input.replayMessageId,
    payloadHash: input.payloadHash ?? input.original.payloadHash,
    payloadJson: assertInboxReplayPayload(
      input.payloadJson ?? input.original.payloadJson,
    ),
    causationId: input.original.messageId,
    traceId: input.traceId,
    receivedAt: input.requestedAt,
  });
}

export function buildInboxReplayRequest(input: {
  originalId: string;
  replay: InboxReceivedRecord;
  targetConsumerVersion: string;
  requestedBy: string;
  reasonCode: string;
  requestedAt: Date;
  commandIdempotencyKey: string;
  requestHash: string;
}): InboxReplayRequestDraft {
  return {
    tenantId: input.replay.tenantId,
    deadLetterId: input.originalId,
    replayedInboxId: input.replay.id,
    replayedMessageId: input.replay.messageId,
    targetConsumerVersion: input.targetConsumerVersion,
    requestedBy: input.requestedBy,
    reasonCode: input.reasonCode,
    requestedAt: input.requestedAt,
    traceId: input.replay.traceId,
    idempotencyKey: input.commandIdempotencyKey,
    requestHash: input.requestHash,
  };
}

export function inboxReplayPayloadRef(originalId: string): string {
  return inboxPayloadRef(originalId);
}
