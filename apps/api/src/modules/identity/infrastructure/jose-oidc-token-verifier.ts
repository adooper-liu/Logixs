import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { OidcAuthenticationConfig } from "../../../config/env";
import {
  USER_ACTOR_TYPE,
  type AuthenticatedUserIdentity,
} from "../domain/authenticated-user-identity";
import { capabilitiesForRoles } from "../domain/role-capabilities";
import type { UserTokenVerifier } from "../domain/user-token-verifier";

export class JoseOidcTokenVerifier implements UserTokenVerifier {
  private readonly getKey: JWTVerifyGetKey;

  constructor(
    private readonly config: OidcAuthenticationConfig,
    getKey?: JWTVerifyGetKey,
  ) {
    this.getKey =
      getKey ??
      createRemoteJWKSet(new URL(config.jwksUrl), {
        timeoutDuration: 5_000,
        cooldownDuration: 30_000,
        cacheMaxAge: 10 * 60_000,
      });
  }

  async verify(accessToken: string): Promise<AuthenticatedUserIdentity> {
    const { payload } = await jwtVerify(accessToken, this.getKey, {
      issuer: this.config.issuerUrl,
      audience: this.config.audience,
      algorithms: ["RS256"],
      requiredClaims: ["sub", this.config.tenantClaim, "exp"],
    });
    const actorId = nonEmptyString(payload.sub);
    const tenantId = nonEmptyString(payload[this.config.tenantClaim]);
    if (!actorId || !tenantId) throw new Error("INVALID_IDENTITY_CLAIMS");

    const roles = collectRoles(payload as Record<string, unknown>);
    const explicitCapabilities = collectStringList(
      (payload as Record<string, unknown>).capabilities,
    );
    const capabilities =
      explicitCapabilities.length > 0
        ? [...new Set(explicitCapabilities)].sort()
        : capabilitiesForRoles(roles);

    return {
      actorType: USER_ACTOR_TYPE,
      actorId,
      tenantId,
      authenticationMethod: "oidc",
      roles,
      capabilities,
    };
  }
}

function collectRoles(payload: Record<string, unknown>): string[] {
  const direct = collectStringList(payload.roles);
  if (direct.length > 0) return direct;
  const realmAccess = payload.realm_access;
  if (realmAccess && typeof realmAccess === "object") {
    return collectStringList((realmAccess as { roles?: unknown }).roles);
  }
  return [];
}

function collectStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}
