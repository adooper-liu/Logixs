import { timingSafeEqual } from "node:crypto";

export const SERVICE_ACTOR_TYPE = "service" as const;

export interface ServiceIdentity {
  actorType: typeof SERVICE_ACTOR_TYPE;
  serviceId: string;
  actorId: string;
}

export interface ServiceCredentials {
  serviceId: string;
  serviceKey: string;
}

export function serviceActorId(serviceId: string): string {
  const id = serviceId.trim();
  if (id.length === 0 || id.length > 128) {
    throw new Error("VALIDATION_FORMAT: serviceId 无效");
  }
  return `service:${id}`;
}

export function serviceCredentialsMatch(
  provided: ServiceCredentials,
  expected: ServiceCredentials,
): boolean {
  return (
    safeEqual(provided.serviceId, expected.serviceId) &&
    safeEqual(provided.serviceKey, expected.serviceKey)
  );
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
