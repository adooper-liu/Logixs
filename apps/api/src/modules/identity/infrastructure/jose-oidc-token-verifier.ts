import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { OidcAuthenticationConfig } from "../../../config/env";
import {
  USER_ACTOR_TYPE,
  type AuthenticatedUserIdentity,
} from "../domain/authenticated-user-identity";
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
    return {
      actorType: USER_ACTOR_TYPE,
      actorId,
      tenantId,
      authenticationMethod: "oidc",
    };
  }
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}
