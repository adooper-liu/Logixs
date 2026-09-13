export interface PublishDueWorkflowInput {
  tenantId: string;
  operatorId: string;
  limit?: number;
  maxRounds?: number;
}

export interface PublishDueActivityResult {
  rounds: number;
  emptied: boolean;
  claimed: number;
  published: number;
  retryWait: number;
  deadLetter: number;
  leftover: number;
}

export interface PublishDueRequest {
  url: string;
  method: "POST";
  headers: {
    "content-type": "application/json";
    "x-tenant-id": string;
    "x-operator-id": string;
  };
  body: {
    limit?: number;
    maxRounds?: number;
  };
}

export function resolveLogixApiUrl(raw: string | undefined): string {
  const value = (raw ?? "http://localhost:3000").trim();
  if (!/^https?:\/\//i.test(value)) {
    throw new Error("VALIDATION_FORMAT: LOGIX_API_URL 必须是 http(s) URL");
  }
  return value.replace(/\/$/, "");
}

export function buildPublishDueRequest(
  input: PublishDueWorkflowInput,
  apiUrl: string,
): PublishDueRequest {
  const tenantId = input.tenantId.trim();
  const operatorId = input.operatorId.trim();
  if (!tenantId || !operatorId) {
    throw new Error("VALIDATION_FORMAT: tenantId/operatorId 无效");
  }
  const body: PublishDueRequest["body"] = {};
  if (input.limit !== undefined) body.limit = input.limit;
  if (input.maxRounds !== undefined) body.maxRounds = input.maxRounds;
  return {
    url: `${apiUrl}/api/outbox/publish-due`,
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tenant-id": tenantId,
      "x-operator-id": operatorId,
    },
    body,
  };
}

export function classifyPublishDueHttpStatus(
  status: number,
): "retryable" | "non_retryable" {
  if (status === 408 || status === 429 || status >= 500) return "retryable";
  return "non_retryable";
}
