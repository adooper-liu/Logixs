import { describe, expect, it } from "vitest";
import { readEnv } from "./env";

describe("readEnv database schema", () => {
  it("defaults to the public schema when the URL declares none", () => {
    const result = readEnv({
      DATABASE_URL: "postgresql://logix:logix@localhost:5433/logix",
    });

    expect(result.databaseSchema).toBe("public");
  });

  it("reads the schema the connection string declares", () => {
    const result = readEnv({
      DATABASE_URL:
        "postgresql://logix:logix@localhost:5433/logix?schema=it_isolated_1",
    });

    expect(result.databaseSchema).toBe("it_isolated_1");
  });

  it.each([
    // 大写会被 PostgreSQL 折叠：适配器按原样引用，search_path 却折成小写，
    // 两条路会指向不同的 schema —— 所以必须在边界拒绝，而不是事后发现。
    "Isolated",
    "1leading",
    "with-dash",
    "with space",
    'quote"injection',
    "semi;colon",
    "dollar$user",
  ])("rejects the schema %j instead of silently falling back", (schema) => {
    expect(() =>
      readEnv({
        DATABASE_URL: `postgresql://logix:logix@localhost:5433/logix?schema=${encodeURIComponent(schema)}`,
      }),
    ).toThrow("DATABASE_SCHEMA_INVALID");
  });

  it("treats a blank schema parameter as not declared", () => {
    const result = readEnv({
      DATABASE_URL: "postgresql://logix:logix@localhost:5433/logix?schema=",
    });

    expect(result.databaseSchema).toBe("public");
  });

  it("keeps working for connection strings that are not URLs", () => {
    // 非 URL 形式（libpq 关键字串/Unix socket）里没有 schema 可读，
    // 沿用默认值，不因为解析不了就拒绝启动。
    const result = readEnv({ DATABASE_URL: "host=localhost dbname=logix" });

    expect(result.databaseSchema).toBe("public");
  });
});

describe("readEnv authentication", () => {
  it("defaults local development to explicit development-header authentication", () => {
    const result = readEnv({ NODE_ENV: "development" });

    expect(result.authentication).toEqual({ mode: "development" });
  });

  it("requires OIDC configuration when OIDC mode is enabled", () => {
    expect(() => readEnv({ NODE_ENV: "test", AUTH_MODE: "oidc" })).toThrow(
      "AUTH_CONFIGURATION_INVALID",
    );
  });

  it("rejects an unknown authentication mode", () => {
    expect(() => readEnv({ NODE_ENV: "test", AUTH_MODE: "legacy" })).toThrow(
      "AUTH_CONFIGURATION_INVALID",
    );
  });

  it("builds the OIDC configuration from explicit values", () => {
    const result = readEnv({
      NODE_ENV: "test",
      AUTH_MODE: "oidc",
      OIDC_ISSUER_URL: "https://id.example.test/realms/logix",
      OIDC_AUDIENCE: "logix-api",
      OIDC_JWKS_URL: "https://id.example.test/realms/logix/certs",
      OIDC_TENANT_CLAIM: "tenant_id",
    });

    expect(result.authentication).toEqual({
      mode: "oidc",
      issuerUrl: "https://id.example.test/realms/logix",
      audience: "logix-api",
      jwksUrl: "https://id.example.test/realms/logix/certs",
      tenantClaim: "tenant_id",
    });
  });

  it("fails closed when production is configured for development headers", () => {
    expect(() =>
      readEnv({ NODE_ENV: "production", AUTH_MODE: "development" }),
    ).toThrow("AUTH_CONFIGURATION_INVALID");
  });

  it.each(["staging", "preview"])(
    "fails closed outside development and test when development headers are requested in %s",
    (nodeEnv) => {
      expect(() =>
        readEnv({ NODE_ENV: nodeEnv, AUTH_MODE: "development" }),
      ).toThrow("AUTH_CONFIGURATION_INVALID");
    },
  );

  it("defaults a shared non-production environment to OIDC", () => {
    expect(() => readEnv({ NODE_ENV: "staging" })).toThrow(
      "AUTH_CONFIGURATION_INVALID",
    );
  });

  it.each([
    {
      issuerUrl: "http://id.example.test/realms/logix",
      jwksUrl: "https://id.example.test/realms/logix/certs",
    },
    {
      issuerUrl: "https://id.example.test/realms/logix",
      jwksUrl: "http://id.example.test/realms/logix/certs",
    },
  ])(
    "requires HTTPS OIDC endpoints in production",
    ({ issuerUrl, jwksUrl }) => {
      expect(() =>
        readEnv({
          NODE_ENV: "production",
          AUTH_MODE: "oidc",
          OIDC_ISSUER_URL: issuerUrl,
          OIDC_AUDIENCE: "logix-api",
          OIDC_JWKS_URL: jwksUrl,
        }),
      ).toThrow("AUTH_CONFIGURATION_INVALID");
    },
  );

  it("derives the Keycloak JWKS URL when none is configured", () => {
    const result = readEnv({
      NODE_ENV: "test",
      AUTH_MODE: "oidc",
      OIDC_ISSUER_URL: "https://id.example.test/realms/logix/",
      OIDC_AUDIENCE: "logix-api",
    });

    expect(result.authentication).toEqual({
      mode: "oidc",
      issuerUrl: "https://id.example.test/realms/logix/",
      audience: "logix-api",
      jwksUrl:
        "https://id.example.test/realms/logix/protocol/openid-connect/certs",
      tenantClaim: "tenant_id",
    });
  });

  it("rejects an explicitly blank JWKS URL instead of silently deriving one", () => {
    expect(() =>
      readEnv({
        NODE_ENV: "test",
        AUTH_MODE: "oidc",
        OIDC_ISSUER_URL: "https://id.example.test/realms/logix",
        OIDC_AUDIENCE: "logix-api",
        OIDC_JWKS_URL: "   ",
      }),
    ).toThrow("AUTH_CONFIGURATION_INVALID");
  });

  it("rejects non-HTTP OIDC endpoints in non-production environments", () => {
    expect(() =>
      readEnv({
        NODE_ENV: "test",
        AUTH_MODE: "oidc",
        OIDC_ISSUER_URL: "file:///tmp/issuer",
        OIDC_AUDIENCE: "logix-api",
      }),
    ).toThrow("AUTH_CONFIGURATION_INVALID");
  });
});
