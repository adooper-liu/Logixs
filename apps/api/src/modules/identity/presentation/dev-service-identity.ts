import { UnauthorizedException } from "@nestjs/common";
import {
  SERVICE_ACTOR_TYPE,
  serviceActorId,
  serviceCredentialsMatch,
  type ServiceIdentity,
} from "../domain/service-identity";

export type { ServiceIdentity };

export function attachDevServiceIdentity(
  request: {
    headers: Record<string, string | string[] | undefined>;
    devServiceIdentity?: ServiceIdentity;
  },
  expected: { serviceId: string; serviceKey: string },
): ServiceIdentity {
  const serviceId = headerValue(request.headers["x-service-id"]);
  const serviceKey = headerValue(request.headers["x-service-key"]);
  if (!serviceId || !serviceKey) {
    throw new UnauthorizedException("AUTHENTICATION_REQUIRED");
  }
  if (
    !expected.serviceId ||
    !expected.serviceKey ||
    !serviceCredentialsMatch(
      { serviceId, serviceKey },
      { serviceId: expected.serviceId, serviceKey: expected.serviceKey },
    )
  ) {
    throw new UnauthorizedException("AUTHENTICATION_REQUIRED");
  }
  const identity: ServiceIdentity = {
    actorType: SERVICE_ACTOR_TYPE,
    serviceId,
    actorId: serviceActorId(serviceId),
  };
  request.devServiceIdentity = identity;
  return identity;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
