export interface ClientOperationItem {
  clientOperationId: string;
  actionCode: string;
  receptionState: string;
  businessDecisionState: string;
  commitState: string;
  rejectionReasonCode: string | null;
  resultRefs: Array<{ entityType: string; entityId: string }>;
  traceId: string;
  targetType: string;
  targetId: string;
  createdAt: string;
}

export interface ClientOperationPage {
  items: ClientOperationItem[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
    pageSize: number;
  };
  asOf: string;
  projectionVersion: number;
}

export interface CompensationItem {
  compensationId: string;
  originalClientOperationId: string;
  compensationActionCode: string;
  state: string;
  reasonCode: string;
  requestedBy: string;
  resultRefs: Array<{ entityType: string; entityId: string }>;
  createdAt: string;
  updatedAt: string;
  traceId: string;
}

export interface CompensationPage {
  items: CompensationItem[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
    pageSize: number;
  };
  asOf: string;
  projectionVersion: number;
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

function toOperationItem(raw: Record<string, unknown>): ClientOperationItem {
  return {
    clientOperationId: String(raw.clientOperationId ?? ""),
    actionCode: String(raw.actionCode ?? ""),
    receptionState: String(raw.receptionState ?? ""),
    businessDecisionState: String(raw.businessDecisionState ?? ""),
    commitState: String(raw.commitState ?? ""),
    rejectionReasonCode:
      typeof raw.rejectionReasonCode === "string"
        ? raw.rejectionReasonCode
        : null,
    resultRefs: Array.isArray(raw.resultRefs)
      ? (raw.resultRefs as ClientOperationItem["resultRefs"])
      : [],
    traceId: String(raw.traceId ?? ""),
    targetType: String(raw.targetType ?? ""),
    targetId: String(raw.targetId ?? ""),
    createdAt: String(raw.createdAt ?? ""),
  };
}

export async function listClientOperations(input?: {
  pageSize?: number;
  cursor?: string;
}): Promise<ClientOperationPage> {
  const query = new URLSearchParams();
  if (input?.pageSize !== undefined)
    query.set("pageSize", String(input.pageSize));
  if (input?.cursor) query.set("cursor", input.cursor);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const response = await fetch(`/api/client-operations${suffix}`, {
    headers: identityHeaders(),
  });
  if (!response.ok) {
    throw new Error(await readError(response, "列同步操作失败"));
  }
  const page = (await response.json()) as {
    items: Record<string, unknown>[];
    pageInfo: ClientOperationPage["pageInfo"];
    asOf: string;
    projectionVersion: number;
  };
  return {
    items: page.items.map(toOperationItem),
    pageInfo: page.pageInfo,
    asOf: page.asOf,
    projectionVersion: page.projectionVersion,
  };
}

export async function listCompensations(
  originalClientOperationId: string,
  input?: { pageSize?: number; cursor?: string },
): Promise<CompensationPage> {
  const query = new URLSearchParams();
  if (input?.pageSize !== undefined)
    query.set("pageSize", String(input.pageSize));
  if (input?.cursor) query.set("cursor", input.cursor);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const response = await fetch(
    `/api/client-operations/${originalClientOperationId}/compensations${suffix}`,
    { headers: identityHeaders() },
  );
  if (!response.ok) {
    throw new Error(await readError(response, "列补偿失败"));
  }
  return (await response.json()) as CompensationPage;
}
