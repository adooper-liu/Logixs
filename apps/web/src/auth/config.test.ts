import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AuthConfigError,
  parseAuthConfig,
  type AuthEnvironment,
  type AuthRuntime,
} from "./config";

const ORIGIN = "https://app.logix.example";
const PROD = { dev: false, origin: ORIGIN } as const;
const DEV = { dev: true, origin: "http://localhost:5173" } as const;

const OIDC_ENV: AuthEnvironment = {
  VITE_AUTH_MODE: "oidc",
  VITE_OIDC_AUTHORITY: "https://id.logix.example/realms/logix",
  VITE_OIDC_CLIENT_ID: "logix-web",
  VITE_OIDC_SCOPE: "openid profile logix-api",
  VITE_OIDC_REDIRECT_URI: `${ORIGIN}/auth/callback`,
  VITE_OIDC_POST_LOGOUT_REDIRECT_URI: `${ORIGIN}/auth/logout-callback`,
};

const DEV_ENV: AuthEnvironment = {
  VITE_AUTH_MODE: "development",
  VITE_DEV_TENANT_ID: "tenant-dev",
  VITE_DEV_OPERATOR_ID: "operator-dev",
  VITE_DEV_ROLES: "operations_dispatcher, review_supervisor",
};

function expectInvalid(
  env: AuthEnvironment,
  runtime: AuthRuntime = PROD,
  detail?: string,
) {
  let caught: unknown;
  try {
    parseAuthConfig(env, runtime);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(AuthConfigError);
  expect((caught as AuthConfigError).code).toBe("AUTH_CONFIG_INVALID");
  if (detail) expect((caught as Error).message).toContain(detail);
}

describe("authConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("开发身份只来自显式环境配置，按白名单逐键读取", async () => {
    vi.stubEnv("VITE_AUTH_MODE", "development");
    vi.stubEnv("VITE_DEV_TENANT_ID", "tenant-from-env");
    vi.stubEnv("VITE_DEV_OPERATOR_ID", "operator-from-env");
    vi.stubEnv("VITE_DEV_ROLES", "warehouse_operator");
    vi.resetModules();
    const { authConfig } = await import("./config");

    expect(authConfig()).toEqual({
      mode: "development",
      tenantId: "tenant-from-env",
      operatorId: "operator-from-env",
      roles: ["warehouse_operator"],
    });
  });

  it("未显式配置开发身份时失败关闭，不存在内置默认身份", async () => {
    vi.stubEnv("VITE_AUTH_MODE", "development");
    vi.stubEnv("VITE_DEV_TENANT_ID", "");
    vi.stubEnv("VITE_DEV_OPERATOR_ID", "");
    vi.stubEnv("VITE_DEV_ROLES", "");
    vi.resetModules();
    const { authConfig, AuthConfigError: Fresh } = await import("./config");

    expect(() => authConfig()).toThrow(Fresh);
  });
});

describe("parseAuthConfig", () => {
  it("生产构建拒绝 development 模式，不回退开发身份", () => {
    expectInvalid(DEV_ENV, PROD, "生产构建只允许 oidc");
  });

  it("缺少或未知 VITE_AUTH_MODE 时失败关闭", () => {
    expectInvalid({}, PROD, "缺少 VITE_AUTH_MODE");
    expectInvalid({}, DEV, "缺少 VITE_AUTH_MODE");
    expectInvalid({ VITE_AUTH_MODE: "implicit" }, DEV, "不支持 implicit");
  });

  it("DEV 下显式 development 只取类型化配置身份", () => {
    expect(parseAuthConfig(DEV_ENV, DEV)).toEqual({
      mode: "development",
      tenantId: "tenant-dev",
      operatorId: "operator-dev",
      roles: ["operations_dispatcher", "review_supervisor"],
    });
  });

  it.each([
    "VITE_DEV_TENANT_ID",
    "VITE_DEV_OPERATOR_ID",
    "VITE_DEV_ROLES",
  ] as const)("development 缺 %s 失败", (key) => {
    expectInvalid({ ...DEV_ENV, [key]: " " }, DEV, key);
  });

  it("完整 OIDC 配置解析为公共客户端设置，silent renew 未配置即关闭", () => {
    expect(parseAuthConfig(OIDC_ENV, PROD)).toEqual({
      mode: "oidc",
      authority: "https://id.logix.example/realms/logix",
      clientId: "logix-web",
      scope: "openid profile logix-api",
      redirectUri: `${ORIGIN}/auth/callback`,
      postLogoutRedirectUri: `${ORIGIN}/auth/logout-callback`,
      silentRedirectUri: null,
    });
  });

  it.each([
    "VITE_OIDC_AUTHORITY",
    "VITE_OIDC_CLIENT_ID",
    "VITE_OIDC_SCOPE",
    "VITE_OIDC_REDIRECT_URI",
    "VITE_OIDC_POST_LOGOUT_REDIRECT_URI",
  ] as const)("OIDC 缺 %s 失败", (key) => {
    expectInvalid({ ...OIDC_ENV, [key]: "" }, PROD, key);
  });

  it("scope 必须包含 openid 这个完整词", () => {
    expectInvalid(
      { ...OIDC_ENV, VITE_OIDC_SCOPE: "profile openidx logix-api" },
      PROD,
      "openid",
    );
  });

  it("生产 authority 必须 HTTPS；仅 DEV 回环地址放行 http", () => {
    expectInvalid(
      { ...OIDC_ENV, VITE_OIDC_AUTHORITY: "http://id.logix.example/realms/x" },
      PROD,
      "HTTPS",
    );
    expectInvalid(
      { ...OIDC_ENV, VITE_OIDC_AUTHORITY: "http://localhost:8080/realms/x" },
      PROD,
      "HTTPS",
    );
    const local = parseAuthConfig(
      {
        ...OIDC_ENV,
        VITE_OIDC_AUTHORITY: "http://localhost:8080/realms/logix",
        VITE_OIDC_REDIRECT_URI: "http://localhost:5173/auth/callback",
        VITE_OIDC_POST_LOGOUT_REDIRECT_URI:
          "http://localhost:5173/auth/logout-callback",
      },
      DEV,
    );
    expect(local.mode).toBe("oidc");
  });

  it("回调 URI 必须回到本应用对应的协议路径", () => {
    expectInvalid(
      {
        ...OIDC_ENV,
        VITE_OIDC_REDIRECT_URI: "https://evil.example/auth/callback",
      },
      PROD,
      "VITE_OIDC_REDIRECT_URI",
    );
    expectInvalid(
      { ...OIDC_ENV, VITE_OIDC_REDIRECT_URI: `${ORIGIN}/tasks` },
      PROD,
      "VITE_OIDC_REDIRECT_URI",
    );
    expectInvalid(
      {
        ...OIDC_ENV,
        VITE_OIDC_POST_LOGOUT_REDIRECT_URI: `${ORIGIN}/auth/logout-callback?next=x`,
      },
      PROD,
      "VITE_OIDC_POST_LOGOUT_REDIRECT_URI",
    );
    expectInvalid(
      { ...OIDC_ENV, VITE_OIDC_REDIRECT_URI: "/auth/callback" },
      PROD,
      "绝对 URL",
    );
  });

  it("silent renew 仅在显式配置后启用，且同样限定回调路径", () => {
    const config = parseAuthConfig(
      {
        ...OIDC_ENV,
        VITE_OIDC_SILENT_REDIRECT_URI: `${ORIGIN}/auth/silent-callback`,
      },
      PROD,
    );
    expect(config).toMatchObject({
      silentRedirectUri: `${ORIGIN}/auth/silent-callback`,
    });
    expectInvalid(
      { ...OIDC_ENV, VITE_OIDC_SILENT_REDIRECT_URI: `${ORIGIN}/silent` },
      PROD,
      "VITE_OIDC_SILENT_REDIRECT_URI",
    );
  });
});
