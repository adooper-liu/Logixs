import { UnauthorizedException } from "@nestjs/common";

export interface DevIdentity {
  tenantId: string;
  operatorId: string;
}

export function attachDevIdentity(request: {
  headers: Record<string, string | string[] | undefined>;
  devIdentity?: DevIdentity;
}): DevIdentity {
  const tenantId = headerValue(request.headers["x-tenant-id"]);
  const operatorId = headerValue(request.headers["x-operator-id"]);
  if (!tenantId || !operatorId) {
    throw new UnauthorizedException("AUTHENTICATION_REQUIRED");
  }
  request.devIdentity = { tenantId, operatorId };
  return request.devIdentity;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
