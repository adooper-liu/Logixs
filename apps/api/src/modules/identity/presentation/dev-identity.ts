import { UnauthorizedException } from "@nestjs/common";
import {
  USER_ACTOR_TYPE,
  type AuthenticatedUserIdentity,
} from "../domain/authenticated-user-identity";
import { capabilitiesForRoles } from "../domain/role-capabilities";

export function attachDevIdentity(request: {
  headers: Record<string, string | string[] | undefined>;
  identity?: AuthenticatedUserIdentity;
}): AuthenticatedUserIdentity {
  const tenantId = headerValue(request.headers["x-tenant-id"]);
  const actorId = headerValue(request.headers["x-operator-id"]);
  if (!tenantId || !actorId) {
    throw new UnauthorizedException("AUTHENTICATION_REQUIRED");
  }

  const roles = csvHeader(request.headers["x-roles"]);
  const explicitCapabilities = csvHeader(request.headers["x-capabilities"]);
  const capabilities =
    explicitCapabilities.length > 0
      ? [...new Set(explicitCapabilities)].sort()
      : capabilitiesForRoles(roles);

  request.identity = {
    actorType: USER_ACTOR_TYPE,
    actorId,
    tenantId,
    authenticationMethod: "development_headers",
    roles,
    capabilities,
  };
  return request.identity;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function csvHeader(value: string | string[] | undefined): string[] {
  const raw = headerValue(value);
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
