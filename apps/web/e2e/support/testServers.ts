import {
  DEV_SERVER_PORT,
  OIDC_APP_URL,
  OIDC_DEV_SERVER_PORT,
  selectsOnlyProject,
} from "../../src/e2eDevServer";

/** 测试用 IdP 的 authority：`.invalid` 保留域不可解析，替身路由缺席时请求只会失败。 */
export const E2E_OIDC_AUTHORITY = "https://idp.e2e.invalid/realms/logix-e2e";
export const E2E_OIDC_CLIENT_ID = "logix-web-e2e";

type AuthEnvKey =
  | "VITE_AUTH_MODE"
  | "VITE_OIDC_AUTHORITY"
  | "VITE_OIDC_CLIENT_ID"
  | "VITE_OIDC_SCOPE"
  | "VITE_OIDC_REDIRECT_URI"
  | "VITE_OIDC_POST_LOGOUT_REDIRECT_URI"
  | "VITE_OIDC_SILENT_REDIRECT_URI"
  | "VITE_DEV_TENANT_ID"
  | "VITE_DEV_OPERATOR_ID"
  | "VITE_DEV_ROLES";

export interface E2eServerTarget {
  readonly name: string;
  readonly port: number;
  /** 认证键全量显式给出（不用的置空），本机 `.env*` 不得改变测试身份。 */
  readonly env: Readonly<Record<AuthEnvKey, string>>;
  readonly cacheDir?: string;
}

const NO_OIDC = {
  VITE_OIDC_AUTHORITY: "",
  VITE_OIDC_CLIENT_ID: "",
  VITE_OIDC_SCOPE: "",
  VITE_OIDC_REDIRECT_URI: "",
  VITE_OIDC_POST_LOGOUT_REDIRECT_URI: "",
  VITE_OIDC_SILENT_REDIRECT_URI: "",
} as const;

const NO_DEVELOPMENT = {
  VITE_DEV_TENANT_ID: "",
  VITE_DEV_OPERATOR_ID: "",
  VITE_DEV_ROLES: "",
} as const;

/** 业务 E2E 的显式开发身份：只存在于 Playwright 启动配置，不是生产源码默认值。 */
export const DEVELOPMENT_SERVER: E2eServerTarget = {
  name: "development",
  port: DEV_SERVER_PORT,
  env: {
    VITE_AUTH_MODE: "development",
    ...NO_OIDC,
    VITE_DEV_TENANT_ID: "demo-real-sample-20260921",
    VITE_DEV_OPERATOR_ID: "dev-operator",
    VITE_DEV_ROLES: "operations_dispatcher",
  },
};

export const OIDC_SERVER: E2eServerTarget = {
  name: "oidc",
  port: OIDC_DEV_SERVER_PORT,
  env: {
    VITE_AUTH_MODE: "oidc",
    VITE_OIDC_AUTHORITY: E2E_OIDC_AUTHORITY,
    VITE_OIDC_CLIENT_ID: E2E_OIDC_CLIENT_ID,
    VITE_OIDC_SCOPE: "openid profile",
    VITE_OIDC_REDIRECT_URI: `${OIDC_APP_URL}/auth/callback`,
    VITE_OIDC_POST_LOGOUT_REDIRECT_URI: `${OIDC_APP_URL}/auth/logout-callback`,
    VITE_OIDC_SILENT_REDIRECT_URI: "",
    ...NO_DEVELOPMENT,
  },
  // 两个 Vite 同进程并行预构建依赖，共用缓存目录会互相失效。
  cacheDir: "node_modules/.vite-e2e-oidc",
};

export const E2E_SERVERS = [DEVELOPMENT_SERVER, OIDC_SERVER] as const;

/** 唯一使用 {@link OIDC_SERVER} 的 Playwright 项目。 */
export const OIDC_PROJECT = "oidc-chromium";

/** Playwright 不把 `--project` 过滤交给 globalSetup；只有明确只跑认证项目时才省掉开发身份服务器。 */
export function serversForArgv(
  argv: readonly string[],
): readonly E2eServerTarget[] {
  return selectsOnlyProject(argv, OIDC_PROJECT) ? [OIDC_SERVER] : E2E_SERVERS;
}
