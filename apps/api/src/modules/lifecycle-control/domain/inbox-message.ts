export const FIRST_SLICE_INBOX_CONSUMER = "lifecycle-control-inbox";
export const INBOX_RECEIVED_STATE = "received" as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAYLOAD_HASH_PATTERN = /^[a-f0-9]{64}$/;

export type InboxReceiveState = typeof INBOX_RECEIVED_STATE;

export interface InboxReceivedRecord {
  id: string;
  tenantId: string;
  consumerName: string;
  messageId: string;
  payloadHash: string;
  payloadJson: unknown;
  causationId: string | null;
  state: InboxReceiveState;
  attemptCount: 0;
  traceId: string;
  receivedAt: Date;
}

export function parseInboxConsumerName(raw: string): string {
  const consumerName = raw.trim();
  if (consumerName !== FIRST_SLICE_INBOX_CONSUMER) {
    throw new Error("VALIDATION_FORMAT: consumerName 不受理");
  }
  return consumerName;
}

export function parseInboxMessageId(raw: string): string {
  const messageId = raw.trim();
  if (!UUID_PATTERN.test(messageId)) {
    throw new Error("VALIDATION_FORMAT: messageId 必须是 UUID");
  }
  return messageId;
}

export function parseInboxPayloadHash(raw: string): string {
  const payloadHash = raw.trim();
  if (!PAYLOAD_HASH_PATTERN.test(payloadHash)) {
    throw new Error("VALIDATION_FORMAT: payloadHash 必须是 sha256 hex");
  }
  return payloadHash;
}

export function parseInboxTraceId(raw: string): string {
  const traceId = raw.trim();
  if (traceId.length === 0 || traceId.length > 128) {
    throw new Error("VALIDATION_FORMAT: traceId 无效");
  }
  return traceId;
}

export function decideInboxIdempotency(
  existingHash: string,
  incomingHash: string,
): "reuse" | "conflict" {
  return existingHash === incomingHash ? "reuse" : "conflict";
}

export function inboxPayloadRef(inboxRecordId: string): string {
  return `inbox/${inboxRecordId}`;
}

export function buildInboxReceived(input: {
  id: string;
  tenantId: string;
  consumerName: string;
  messageId: string;
  payloadHash: string;
  payloadJson: unknown;
  causationId?: string | null;
  traceId: string;
  receivedAt: Date;
}): InboxReceivedRecord {
  const tenantId = input.tenantId.trim();
  if (!tenantId) {
    throw new Error("VALIDATION_FORMAT: tenantId 无效");
  }
  return {
    id: input.id,
    tenantId,
    consumerName: parseInboxConsumerName(input.consumerName),
    messageId: parseInboxMessageId(input.messageId),
    payloadHash: parseInboxPayloadHash(input.payloadHash),
    payloadJson: input.payloadJson,
    causationId: input.causationId ?? null,
    state: INBOX_RECEIVED_STATE,
    attemptCount: 0,
    traceId: parseInboxTraceId(input.traceId),
    receivedAt: input.receivedAt,
  };
}
