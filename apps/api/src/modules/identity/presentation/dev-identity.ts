import { UnauthorizedException } from "@nestjs/common";
import {
  USER_ACTOR_TYPE,
  type AuthenticatedUserIdentity,
} from "../domain/authenticated-user-identity";

export function attachDevIdentity(request: {
  headers: Record<string, string | string[] | undefined>;
  identity?: AuthenticatedUserIdentity;
}): AuthenticatedUserIdentity {
  const tenantId = headerValue(request.headers["x-tenant-id"]);
  const actorId = headerValue(request.headers["x-operator-id"]);
  if (!tenantId || !actorId) {
    throw new UnauthorizedException("AUTHENTICATION_REQUIRED");
  }
  request.identity = {
    actorType: USER_ACTOR_TYPE,
    actorId,
    tenantId,
    authenticationMethod: "development_headers",
  };
  return request.identity;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
