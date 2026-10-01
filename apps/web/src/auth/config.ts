export const AUTH_CALLBACK_PATH = "/auth/callback";
export const AUTH_LOGOUT_CALLBACK_PATH = "/auth/logout-callback";
export const AUTH_SILENT_CALLBACK_PATH = "/auth/silent-callback";

export interface DevelopmentAuthConfig {
  readonly mode: "development";
  readonly tenantId: string;
  readonly operatorId: string;
  readonly roles: readonly string[];
}

export interface OidcAuthConfig {
  readonly mode: "oidc";
  readonly authority: string;
  readonly clientId: string;
  readonly scope: string;
  readonly redirectUri: string;
  readonly postLogoutRedirectUri: string;
  readonly silentRedirectUri: string | null;
}

export type AuthConfig = DevelopmentAuthConfig | OidcAuthConfig;

export interface AuthEnvironment {
  readonly VITE_AUTH_MODE?: string;
  readonly VITE_OIDC_AUTHORITY?: string;
  readonly VITE_OIDC_CLIENT_ID?: string;
  readonly VITE_OIDC_SCOPE?: string;
  readonly VITE_OIDC_REDIRECT_URI?: string;
  readonly VITE_OIDC_POST_LOGOUT_REDIRECT_URI?: string;
  readonly VITE_OIDC_SILENT_REDIRECT_URI?: string;
  readonly VITE_DEV_TENANT_ID?: string;
  readonly VITE_DEV_OPERATOR_ID?: string;
  readonly VITE_DEV_ROLES?: string;
}

export interface AuthRuntime {
  /** Vite `import.meta.env.DEV`：生产构建中恒为 false，development 分支随之失效。 */
  readonly dev: boolean;
  /** 应用自身 origin；回调必须回到本应用，否则路由永远收不到协议响应。 */
  readonly origin: string;
}

export class AuthConfigError extends Error {
  readonly code = "AUTH_CONFIG_INVALID";

  constructor(detail: string) {
    super(`AUTH_CONFIG_INVALID: ${detail}`);
    this.name = "AuthConfigError";
  }
}

export function parseAuthConfig(
  env: AuthEnvironment,
  runtime: AuthRuntime,
): AuthConfig {
  const mode = text(env.VITE_AUTH_MODE);
  if (mode === "development") return parseDevelopment(env, runtime);
  if (mode === "oidc") return parseOidc(env, runtime);
  throw new AuthConfigError(
    mode
      ? `VITE_AUTH_MODE 不支持 ${mode}`
      : "缺少 VITE_AUTH_MODE（development | oidc）",
  );
}

function parseDevelopment(
  env: AuthEnvironment,
  runtime: AuthRuntime,
): DevelopmentAuthConfig {
  if (!runtime.dev) {
    throw new AuthConfigError("生产构建只允许 oidc 模式");
  }
  const roles = (text(env.VITE_DEV_ROLES) ?? "")
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);
  if (roles.length === 0) {
    throw new AuthConfigError("development 模式缺少 VITE_DEV_ROLES");
  }
  return Object.freeze({
    mode: "development",
    tenantId: required(env.VITE_DEV_TENANT_ID, "VITE_DEV_TENANT_ID"),
    operatorId: required(env.VITE_DEV_OPERATOR_ID, "VITE_DEV_OPERATOR_ID"),
    roles: Object.freeze(roles),
  });
}

function parseOidc(env: AuthEnvironment, runtime: AuthRuntime): OidcAuthConfig {
  const scope = required(env.VITE_OIDC_SCOPE, "VITE_OIDC_SCOPE");
  if (!scope.split(/\s+/).includes("openid")) {
    throw new AuthConfigError("VITE_OIDC_SCOPE 必须包含 openid");
  }
  const silent = text(env.VITE_OIDC_SILENT_REDIRECT_URI);
  return Object.freeze({
    mode: "oidc",
    authority: absoluteUrl(
      required(env.VITE_OIDC_AUTHORITY, "VITE_OIDC_AUTHORITY"),
      "VITE_OIDC_AUTHORITY",
      runtime,
    ),
    clientId: required(env.VITE_OIDC_CLIENT_ID, "VITE_OIDC_CLIENT_ID"),
    scope,
    redirectUri: appCallbackUrl(
      env.VITE_OIDC_REDIRECT_URI,
      "VITE_OIDC_REDIRECT_URI",
      AUTH_CALLBACK_PATH,
      runtime,
    ),
    postLogoutRedirectUri: appCallbackUrl(
      env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI,
      "VITE_OIDC_POST_LOGOUT_REDIRECT_URI",
      AUTH_LOGOUT_CALLBACK_PATH,
      runtime,
    ),
    silentRedirectUri: silent
      ? appCallbackUrl(
          silent,
          "VITE_OIDC_SILENT_REDIRECT_URI",
          AUTH_SILENT_CALLBACK_PATH,
          runtime,
        )
      : null,
  });
}

function appCallbackUrl(
  raw: string | undefined,
  name: string,
  path: string,
  runtime: AuthRuntime,
): string {
  const value = absoluteUrl(required(raw, name), name, runtime);
  const url = new URL(value);
  if (url.origin !== runtime.origin || url.pathname !== path) {
    throw new AuthConfigError(`${name} 必须是 ${runtime.origin}${path}`);
  }
  if (url.search || url.hash) {
    throw new AuthConfigError(`${name} 不得携带查询参数或片段`);
  }
  return url.toString();
}

function absoluteUrl(value: string, name: string, runtime: AuthRuntime) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AuthConfigError(`${name} 必须是绝对 URL`);
  }
  // 本机 IdP（如 localhost Keycloak）仅在 DEV 放行 http；生产一律 HTTPS。
  const loopbackHttp =
    runtime.dev &&
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !loopbackHttp) {
    throw new AuthConfigError(`${name} 必须使用 HTTPS`);
  }
  if (url.username || url.password) {
    throw new AuthConfigError(`${name} 不得内嵌凭据`);
  }
  return value;
}

function required(value: string | undefined, name: string): string {
  const resolved = text(value);
  if (!resolved) throw new AuthConfigError(`缺少 ${name}`);
  return resolved;
}

function text(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

let resolved: AuthConfig | null = null;

/**
 * 显式白名单：逐键读取以便 Vite 静态替换，生产产物只内联这些值，不携带整个 env 对象。
 * client secret 不在白名单内，由 vite.config.ts 在构建/启动前拒绝。
 */
function browserAuthEnvironment(): AuthEnvironment {
  return {
    VITE_AUTH_MODE: import.meta.env.VITE_AUTH_MODE,
    VITE_OIDC_AUTHORITY: import.meta.env.VITE_OIDC_AUTHORITY,
    VITE_OIDC_CLIENT_ID: import.meta.env.VITE_OIDC_CLIENT_ID,
    VITE_OIDC_SCOPE: import.meta.env.VITE_OIDC_SCOPE,
    VITE_OIDC_REDIRECT_URI: import.meta.env.VITE_OIDC_REDIRECT_URI,
    VITE_OIDC_POST_LOGOUT_REDIRECT_URI: import.meta.env
      .VITE_OIDC_POST_LOGOUT_REDIRECT_URI,
    VITE_OIDC_SILENT_REDIRECT_URI: import.meta.env
      .VITE_OIDC_SILENT_REDIRECT_URI,
    VITE_DEV_TENANT_ID: import.meta.env.VITE_DEV_TENANT_ID,
    VITE_DEV_OPERATOR_ID: import.meta.env.VITE_DEV_OPERATOR_ID,
    VITE_DEV_ROLES: import.meta.env.VITE_DEV_ROLES,
  };
}

/** 全应用唯一的认证配置读取入口；首次调用解析并缓存，非法配置直接抛出。 */
export function authConfig(): AuthConfig {
  resolved ??= parseAuthConfig(browserAuthEnvironment(), {
    dev: import.meta.env.DEV,
    origin: window.location.origin,
  });
  return resolved;
}
