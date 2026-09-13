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

const DEV_TENANT_ID = "dev-tenant";
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
