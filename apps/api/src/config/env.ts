// 环境配置（P3-09）：端口/环境带默认值；DATABASE_URL 本地开发回退到 docker-compose 默认值
// （与 prisma.config.ts 一致），生产环境必须显式设置。
const LOCAL_DEV_DATABASE_URL =
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const LOCAL_DEV_AI_SERVICE_URL = "http://localhost:8001";
const LOCAL_DEV_SERVICE_ID = "logix-outbox-publisher";
const LOCAL_DEV_SERVICE_KEY = "dev-service-key";
const LOCAL_DEV_OBJECT_STORAGE_ENDPOINT = "http://localhost:9000";
const LOCAL_DEV_OBJECT_STORAGE_ACCESS_KEY = "logix";
const LOCAL_DEV_OBJECT_STORAGE_SECRET_KEY = "logix-dev-secret";

export interface ObjectStorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  forcePathStyle: boolean;
  allowBucketCreation: boolean;
  timeoutMs: number;
}

export interface DevelopmentAuthenticationConfig {
  mode: "development";
}

export interface OidcAuthenticationConfig {
  mode: "oidc";
  issuerUrl: string;
  audience: string;
  jwksUrl: string;
  tenantClaim: string;
}

export type AuthenticationConfig =
  DevelopmentAuthenticationConfig | OidcAuthenticationConfig;

export interface EnvConfig {
  port: number;
  databaseUrl: string;
  aiServiceUrl: string;
  nodeEnv: string;
  serviceId: string;
  serviceKey: string;
  authentication: AuthenticationConfig;
  importSourceStorage: ObjectStorageConfig;
}

export function readEnv(
  environment: NodeJS.ProcessEnv = process.env,
): EnvConfig {
  const nodeEnv = environment.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";
  const allowsDevelopmentAuthentication =
    nodeEnv === "development" || nodeEnv === "test";
  return {
    port: Number(environment.PORT ?? 3000),
    databaseUrl: environment.DATABASE_URL ?? LOCAL_DEV_DATABASE_URL,
    aiServiceUrl: environment.AI_SERVICE_URL ?? LOCAL_DEV_AI_SERVICE_URL,
    nodeEnv,
    serviceId:
      environment.LOGIX_SERVICE_ID ??
      (isProduction ? "" : LOCAL_DEV_SERVICE_ID),
    serviceKey:
      environment.LOGIX_SERVICE_KEY ??
      (isProduction ? "" : LOCAL_DEV_SERVICE_KEY),
    authentication: readAuthenticationConfig(
      environment,
      allowsDevelopmentAuthentication,
    ),
    importSourceStorage: {
      endpoint:
        environment.OBJECT_STORAGE_ENDPOINT ??
        (isProduction ? "" : LOCAL_DEV_OBJECT_STORAGE_ENDPOINT),
      region: environment.OBJECT_STORAGE_REGION ?? "us-east-1",
      bucket: environment.IMPORT_SOURCE_BUCKET ?? "logix-import-sources",
      accessKey:
        environment.OBJECT_STORAGE_ACCESS_KEY ??
        (isProduction ? "" : LOCAL_DEV_OBJECT_STORAGE_ACCESS_KEY),
      secretKey:
        environment.OBJECT_STORAGE_SECRET_KEY ??
        (isProduction ? "" : LOCAL_DEV_OBJECT_STORAGE_SECRET_KEY),
      forcePathStyle: environment.OBJECT_STORAGE_FORCE_PATH_STYLE !== "false",
      allowBucketCreation:
        !isProduction && environment.OBJECT_STORAGE_AUTO_CREATE !== "false",
      timeoutMs: Number(environment.OBJECT_STORAGE_TIMEOUT_MS ?? 10_000),
    },
  };
}

function readAuthenticationConfig(
  environment: NodeJS.ProcessEnv,
  allowsDevelopmentAuthentication: boolean,
): AuthenticationConfig {
  const mode =
    environment.AUTH_MODE ??
    (allowsDevelopmentAuthentication ? "development" : "oidc");
  if (mode === "development") {
    if (!allowsDevelopmentAuthentication) {
      throw new Error("AUTH_CONFIGURATION_INVALID");
    }
    return { mode };
  }
  if (mode !== "oidc") throw new Error("AUTH_CONFIGURATION_INVALID");

  const issuerUrl = requiredValue(environment.OIDC_ISSUER_URL);
  const audience = requiredValue(environment.OIDC_AUDIENCE);
  const tenantClaim = requiredValue(
    environment.OIDC_TENANT_CLAIM ?? "tenant_id",
  );
  if (!issuerUrl || !audience || !tenantClaim) {
    throw new Error("AUTH_CONFIGURATION_INVALID");
  }

  const validatedIssuer = validateUrl(
    issuerUrl,
    !allowsDevelopmentAuthentication,
  );
  const configuredJwksUrl =
    environment.OIDC_JWKS_URL === undefined
      ? undefined
      : requiredValue(environment.OIDC_JWKS_URL);
  if (environment.OIDC_JWKS_URL !== undefined && !configuredJwksUrl) {
    throw new Error("AUTH_CONFIGURATION_INVALID");
  }
  const jwksUrl = validateUrl(
    configuredJwksUrl ??
      `${validatedIssuer.replace(/\/+$/, "")}/protocol/openid-connect/certs`,
    !allowsDevelopmentAuthentication,
  );
  return {
    mode,
    issuerUrl: validatedIssuer,
    audience,
    jwksUrl,
    tenantClaim,
  };
}

function requiredValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function validateUrl(value: string, requireHttps: boolean): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("AUTH_CONFIGURATION_INVALID");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("AUTH_CONFIGURATION_INVALID");
  }
  if (requireHttps && parsed.protocol !== "https:") {
    throw new Error("AUTH_CONFIGURATION_INVALID");
  }
  return value;
}

export const config = readEnv();
