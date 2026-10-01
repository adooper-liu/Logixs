import { describe, expect, it, vi } from "vitest";
import type { RouteLocationNormalized } from "vue-router";
import router from "../router";
import { AUTH_CALLBACK_PATH, AUTH_LOGOUT_CALLBACK_PATH } from "./config";
import { createAuthGuard } from "./routeGuard";
import type { AuthSession } from "./session";

function route(
  fullPath: string,
  meta: RouteLocationNormalized["meta"] = { title: "页面" },
): RouteLocationNormalized {
  return { fullPath, meta } as RouteLocationNormalized;
}

function fakeSession(authenticated: boolean) {
  return {
    initialize: vi.fn(async () => undefined),
    isAuthenticated: vi.fn(() => authenticated),
    signIn: vi.fn(async () => undefined),
  } as unknown as AuthSession & {
    initialize: ReturnType<typeof vi.fn>;
    signIn: ReturnType<typeof vi.fn>;
  };
}

describe("createAuthGuard", () => {
  it("协议回调路由免登录放行，不初始化会话也不重定向", async () => {
    const session = fakeSession(false);
    const guard = createAuthGuard(() => session);

    await expect(
      guard(
        route("/auth/callback?code=x", { title: "登录", authPublic: true }),
      ),
    ).resolves.toBe(true);
    expect(session.initialize).not.toHaveBeenCalled();
    expect(session.signIn).not.toHaveBeenCalled();
  });

  it("未登录访问受保护页：带原站内路径发起登录并中止导航", async () => {
    const session = fakeSession(false);
    const guard = createAuthGuard(() => session);

    await expect(guard(route("/market-signals?view=open#s-1"))).resolves.toBe(
      false,
    );
    expect(session.signIn).toHaveBeenCalledWith(
      "/market-signals?view=open#s-1",
    );
  });

  it("只判断是否已认证，不以演示角色或能力元数据放行或拒绝", async () => {
    const meta = {
      title: "看档",
      roles: ["manager" as const],
      requiredCapabilities: ["capability.not-held"],
    };
    const signedIn = fakeSession(true);
    await expect(
      createAuthGuard(() => signedIn)(route("/meso", meta)),
    ).resolves.toBe(true);

    const anonymous = fakeSession(false);
    await expect(
      createAuthGuard(() => anonymous)(route("/meso", meta)),
    ).resolves.toBe(false);
    expect(anonymous.signIn).toHaveBeenCalledWith("/meso");
  });
});

describe("router 认证协议路由", () => {
  it("只有登录与注销回调标记为免登录", () => {
    const publicPaths = router
      .getRoutes()
      .filter((record) => record.meta.authPublic)
      .map((record) => record.path)
      .sort();
    expect(publicPaths).toEqual(
      [AUTH_CALLBACK_PATH, AUTH_LOGOUT_CALLBACK_PATH].sort(),
    );
  });
});
