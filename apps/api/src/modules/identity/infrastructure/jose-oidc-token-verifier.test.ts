import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JSONWebKeySet,
  type KeyLike,
} from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import type { OidcAuthenticationConfig } from "../../../config/env";
import { JoseOidcTokenVerifier } from "./jose-oidc-token-verifier";

const config: OidcAuthenticationConfig = {
  mode: "oidc",
  issuerUrl: "https://id.example.test/realms/logix",
  audience: "logix-api",
  jwksUrl: "https://id.example.test/realms/logix/certs",
  tenantClaim: "tenant_id",
};

describe("JoseOidcTokenVerifier", () => {
  let privateKey: KeyLike;
  let otherPrivateKey: KeyLike;
  let verifier: JoseOidcTokenVerifier;

  beforeAll(async () => {
    const pair = await generateKeyPair("RS256");
    const otherPair = await generateKeyPair("RS256");
    privateKey = pair.privateKey;
    otherPrivateKey = otherPair.privateKey;
    const publicJwk = await exportJWK(pair.publicKey);
    publicJwk.kid = "logix-test-key";
    publicJwk.alg = "RS256";
    const keySet: JSONWebKeySet = { keys: [publicJwk] };
    verifier = new JoseOidcTokenVerifier(config, createLocalJWKSet(keySet));
  });

  it("returns a normalized user identity for a valid access token", async () => {
    const token = await signToken(privateKey, {
      sub: "user-1",
      tenant_id: "tenant-1",
    });

    await expect(verifier.verify(token)).resolves.toEqual({
      actorType: "user",
      actorId: "user-1",
      tenantId: "tenant-1",
      authenticationMethod: "oidc",
    });
  });

  it.each([
    ["wrong issuer", { issuer: "https://attacker.example.test" }],
    ["wrong audience", { audience: "other-api" }],
    ["missing subject", { subject: undefined }],
    ["missing tenant", { tenantId: undefined }],
    ["missing expiration", { includeExpiration: false }],
  ])("rejects %s", async (_label, overrides) => {
    const token = await signToken(privateKey, {}, overrides);

    await expect(verifier.verify(token)).rejects.toThrow();
  });

  it("rejects a malformed token", async () => {
    await expect(verifier.verify("not-a-jwt")).rejects.toThrow();
  });

  it("rejects a token signed by an unknown key", async () => {
    const token = await signToken(otherPrivateKey, {
      sub: "user-1",
      tenant_id: "tenant-1",
    });

    await expect(verifier.verify(token)).rejects.toThrow();
  });
});

async function signToken(
  key: KeyLike,
  claims: Record<string, unknown>,
  overrides: {
    issuer?: string;
    audience?: string;
    subject?: string;
    tenantId?: string;
    includeExpiration?: boolean;
  } = {},
): Promise<string> {
  const subject = Object.prototype.hasOwnProperty.call(overrides, "subject")
    ? overrides.subject
    : "user-1";
  const tenantId = Object.prototype.hasOwnProperty.call(overrides, "tenantId")
    ? overrides.tenantId
    : "tenant-1";
  let token = new SignJWT({
    ...claims,
    ...(tenantId === undefined ? {} : { tenant_id: tenantId }),
  })
    .setProtectedHeader({ alg: "RS256", kid: "logix-test-key" })
    .setIssuer(overrides.issuer ?? config.issuerUrl)
    .setAudience(overrides.audience ?? config.audience)
    .setIssuedAt();
  if (overrides.includeExpiration !== false) {
    token = token.setExpirationTime("5m");
  }
  if (subject !== undefined) token = token.setSubject(subject);
  return token.sign(key);
}
