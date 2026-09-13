export interface PublishDueSystemWorkflowInput {
  limit?: number;
  maxRounds?: number;
  maxTenants?: number;
}

export interface PublishDueSystemActivityResult {
  tenants: number;
  emptiedTenants: number;
  leftoverTenants: boolean;
  claimed: number;
  published: number;
  retryWait: number;
  deadLetter: number;
  leftover: number;
}

export interface ServiceCredentials {
  serviceId: string;
  serviceKey: string;
}

export interface PublishDueSystemRequest {
  url: string;
  method: "POST";
  headers: {
    "content-type": "application/json";
    "x-service-id": string;
    "x-service-key": string;
  };
  body: {
    limit?: number;
    maxRounds?: number;
    maxTenants?: number;
  };
}

export function resolveServiceCredentials(
  serviceId: string | undefined,
  serviceKey: string | undefined,
): ServiceCredentials {
  const id = (serviceId ?? "logix-outbox-publisher").trim();
  const key = (serviceKey ?? "dev-service-key").trim();
  if (!id || !key) {
    throw new Error("VALIDATION_FORMAT: 服务凭据无效");
  }
  return { serviceId: id, serviceKey: key };
}

export function buildPublishDueSystemRequest(
  input: PublishDueSystemWorkflowInput,
  apiUrl: string,
  credentials: ServiceCredentials,
): PublishDueSystemRequest {
  const serviceId = credentials.serviceId.trim();
  const serviceKey = credentials.serviceKey.trim();
  if (!serviceId || !serviceKey) {
    throw new Error("VALIDATION_FORMAT: 服务凭据无效");
  }
  const body: PublishDueSystemRequest["body"] = {};
  if (input.limit !== undefined) body.limit = input.limit;
  if (input.maxRounds !== undefined) body.maxRounds = input.maxRounds;
  if (input.maxTenants !== undefined) body.maxTenants = input.maxTenants;
  return {
    url: `${apiUrl}/api/outbox/system/publish-due`,
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-service-id": serviceId,
      "x-service-key": serviceKey,
    },
    body,
  };
}
