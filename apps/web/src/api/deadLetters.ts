import { DEV_TENANT_ID } from "./developmentIdentity";

export interface DeadLetterItem {
  id: string;
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payloadRef: string;
  payloadHash: string;
  attemptCount: number;
  lastErrorCode: string | null;
  failureCategory: string | null;
  ownerQueue: string | null;
  deadLetteredAt: string;
  occurredAt: string;
  causationId: string | null;
  traceId: string;
}

export interface DeadLetterPage {
  items: DeadLetterItem[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
    pageSize: number;
  };
  asOf: string;
  projectionVersion: number;
}

export interface ReplayDeadLetterInput {
  reasonCode: string;
  targetConsumerVersion: string;
  idempotencyKey: string;
}

export interface ReplayDeadLetterResult {
  deadLetterId: string;
  replayedOutboxId: string;
  replayedEventId: string;
  applied: boolean;
  corrected: boolean;
  targetConsumerVersion: string;
}

const DEV_OPERATOR_ID = "dev-operator";

function identityHeaders(): HeadersInit {
  return {
    "X-Tenant-Id": DEV_TENANT_ID,
    "X-Operator-Id": DEV_OPERATOR_ID,
  };
}

async function readError(
  response: Response,
  fallback: string,
): Promise<string> {
  const text = (await response.text()).slice(0, 200);
  return text
    ? `${fallback}（${response.status}）：${text}`
    : `${fallback}（${response.status}）`;
}

export async function listDeadLetters(input?: {
  pageSize?: number;
  cursor?: string;
}): Promise<DeadLetterPage> {
  const query = new URLSearchParams();
  if (input?.pageSize !== undefined)
    query.set("pageSize", String(input.pageSize));
  if (input?.cursor) query.set("cursor", input.cursor);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const response = await fetch(`/api/outbox/dead-letters${suffix}`, {
    headers: identityHeaders(),
  });
  if (!response.ok) {
    throw new Error(await readError(response, "列死信失败"));
  }
  return (await response.json()) as DeadLetterPage;
}

export interface InboxDeadLetterItem {
  id: string;
  messageId: string;
  consumerName: string;
  payloadRef: string;
  payloadHash: string;
  attemptCount: number;
  lastErrorCode: string | null;
  failureCategory: string | null;
  ownerQueue: string | null;
  deadLetteredAt: string;
  receivedAt: string;
  causationId: string | null;
  traceId: string;
}

export interface ReplayInboxDeadLetterResult {
  deadLetterId: string;
  replayedInboxId: string;
  replayedMessageId: string;
  applied: boolean;
  corrected: boolean;
  targetConsumerVersion: string;
}

export function toDeadLetterItemFromInbox(
  item: InboxDeadLetterItem,
): DeadLetterItem {
  return {
    id: item.id,
    eventId: item.messageId,
    eventType: item.consumerName,
    aggregateType: "inbox",
    aggregateId: item.messageId,
    payloadRef: item.payloadRef,
    payloadHash: item.payloadHash,
    attemptCount: item.attemptCount,
    lastErrorCode: item.lastErrorCode,
    failureCategory: item.failureCategory,
    ownerQueue: item.ownerQueue,
    deadLetteredAt: item.deadLetteredAt,
    occurredAt: item.receivedAt,
    causationId: item.causationId,
    traceId: item.traceId,
  };
}

export async function listInboxDeadLetters(input?: {
  pageSize?: number;
  cursor?: string;
}): Promise<DeadLetterPage> {
  const query = new URLSearchParams();
  if (input?.pageSize !== undefined)
    query.set("pageSize", String(input.pageSize));
  if (input?.cursor) query.set("cursor", input.cursor);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const response = await fetch(`/api/inbox/dead-letters${suffix}`, {
    headers: identityHeaders(),
  });
  if (!response.ok) {
    throw new Error(await readError(response, "列 Inbox 死信失败"));
  }
  const page = (await response.json()) as {
    items: InboxDeadLetterItem[];
    pageInfo: DeadLetterPage["pageInfo"];
    asOf: string;
    projectionVersion: number;
  };
  return {
    items: page.items.map(toDeadLetterItemFromInbox),
    pageInfo: page.pageInfo,
    asOf: page.asOf,
    projectionVersion: page.projectionVersion,
  };
}

export async function replayInboxDeadLetter(
  deadLetterId: string,
  input: ReplayDeadLetterInput,
): Promise<ReplayInboxDeadLetterResult> {
  const response = await fetch(
    `/api/inbox/dead-letters/${deadLetterId}/replay`,
    {
      method: "POST",
      headers: {
        ...identityHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reasonCode: input.reasonCode,
        targetConsumerVersion: input.targetConsumerVersion,
        idempotencyKey: input.idempotencyKey,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(await readError(response, "Inbox 重放失败"));
  }
  return (await response.json()) as ReplayInboxDeadLetterResult;
}

export async function replayDeadLetter(
  deadLetterId: string,
  input: ReplayDeadLetterInput,
): Promise<ReplayDeadLetterResult> {
  const response = await fetch(
    `/api/outbox/dead-letters/${deadLetterId}/replay`,
    {
      method: "POST",
      headers: {
        ...identityHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reasonCode: input.reasonCode,
        targetConsumerVersion: input.targetConsumerVersion,
        idempotencyKey: input.idempotencyKey,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(await readError(response, "重放失败"));
  }
  return (await response.json()) as ReplayDeadLetterResult;
}
