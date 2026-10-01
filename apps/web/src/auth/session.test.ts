import { describe, expect, it, vi } from "vitest";
import type { OidcAuthConfig } from "./config";
import {
  createAuthSession,
  oidcSettings,
  RECOVERY_MARKER_KEY,
  SessionUnavailableError,
  type OidcAdapter,
  type OidcUser,
} from "./session";

const ORIGIN = "https://app.logix.example";
const TOKEN = "eyJ.secret-access-token.sig";

const OIDC_CONFIG: OidcAuthConfig = {
  mode: "oidc",
  authority: "https://id.logix.example/realms/logix",
  clientId: "logix-web",
  scope: "openid profile",
  redirectUri: `${ORIGIN}/auth/callback`,
  postLogoutRedirectUri: `${ORIGIN}/auth/logout-callback`,
  silentRedirectUri: null,
};

function user(overrides: Partial<OidcUser> = {}): OidcUser {
  return {
    access_token: TOKEN,
    expired: false,
    profile: { sub: "user-1", name: "张三" },
    ...overrides,
  };
}

function fakeAdapter(current: OidcUser | null = null) {
  let listener: ((user: OidcUser | null) => void) | null = null;
  const adapter = {
    getUser: vi.fn(async () => current),
    signinRedirect: vi.fn(async () => undefined),
    signinRedirectCallback: vi.fn(async () =>
      user({ state: { returnUrl: "/market-signals?view=open" } }),
    ),
    signinSilentCallback: vi.fn(async () => undefined),
    signoutRedirect: vi.fn(async () => undefined),
    signoutRedirectCallback: vi.fn(async () => undefined),
    removeUser: vi.fn(async () => {
      current = null;
    }),
    onUserChanged: vi.fn((next: (user: OidcUser | null) => void) => {
      listener = next;
    }),
  } satisfies OidcAdapter;
  return { adapter, emit: (next: OidcUser | null) => listener?.(next) };
}

function oidcSession(current: OidcUser | null = null) {
  const { adapter, emit } = fakeAdapter(current);
  const storage = window.sessionStorage;
  storage.clear();
  const session = createAuthSession({
    config: OIDC_CONFIG,
    adapter,
    storage,
    origin: ORIGIN,
  });
  return { session, adapter, storage, emit };
}

describe("oidcSettings", () => {
  it("公共客户端 Authorization Code + PKCE，不带 client secret", () => {
    const settings = oidcSettings(OIDC_CONFIG, window.sessionStorage);
    expect(settings).toMatchObject({
      authority: OIDC_CONFIG.authority,
      client_id: "logix-web",
      redirect_uri: `${ORIGIN}/auth/callback`,
      post_logout_redirect_uri: `${ORIGIN}/auth/logout-callback`,
      response_type: "code",
      scope: "openid profile",
      disablePKCE: false,
      automaticSilentRenew: false,
    });
    expect(settings).not.toHaveProperty("client_secret");
    expect(settings).not.toHaveProperty("silent_redirect_uri");
  });

  it("协议状态与用户会话都只写入注入的 sessionStorage，不落 localStorage", async () => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    const settings = oidcSettings(OIDC_CONFIG, window.sessionStorage);

    await settings.stateStore!.set("state-1", "pkce-verifier");
    await settings.userStore!.set("user-1", "session");

    expect(window.sessionStorage.getItem("oidc.state-1")).toBe("pkce-verifier");
    expect(window.sessionStorage.getItem("oidc.user-1")).toBe("session");
    expect(window.localStorage.length).toBe(0);
  });

  it("仅配置 silent redirect URI 时开启自动续期", () => {
    const settings = oidcSettings(
      { ...OIDC_CONFIG, silentRedirectUri: `${ORIGIN}/auth/silent-callback` },
      window.sessionStorage,
    );
    expect(settings).toMatchObject({
      automaticSilentRenew: true,
      silent_redirect_uri: `${ORIGIN}/auth/silent-callback`,
    });
  });
});

describe("createAuthSession（oidc）", () => {
  it("无用户时为 anonymous；已有用户时只投影脱敏 profile，不含 Token", async () => {
    const anonymous = oidcSession();
    await anonymous.session.initialize();
    expect(anonymous.session.snapshot()).toEqual({
      status: "anonymous",
      profile: null,
      errorCode: null,
    });

    const signedIn = oidcSession(user());
    await signedIn.session.initialize();
    expect(signedIn.session.isAuthenticated()).toBe(true);
    expect(signedIn.session.snapshot().profile).toEqual({
      subject: "user-1",
      displayName: "张三",
    });
    expect(JSON.stringify(signedIn.session.snapshot())).not.toContain(TOKEN);
  });

  it("首次初始化失败进入可重试错误态，再次初始化成功恢复会话", async () => {
    const { session, adapter } = oidcSession(user());
    adapter.getUser.mockRejectedValueOnce(new Error("storage unavailable"));

    await expect(session.initialize()).rejects.toThrow("storage unavailable");
    expect(session.snapshot()).toEqual({
      status: "error",
      profile: null,
      errorCode: "SESSION_INIT_FAILED",
    });
    expect(session.isAuthenticated()).toBe(false);

    await expect(session.initialize()).resolves.toBeUndefined();
    expect(adapter.getUser).toHaveBeenCalledTimes(2);
    expect(session.snapshot()).toMatchObject({
      status: "authenticated",
      errorCode: null,
    });
    await expect(session.credentials()).resolves.toEqual({
      mode: "oidc",
      accessToken: TOKEN,
    });
  });

  it("首次失败后重试得到匿名会话时清除错误码", async () => {
    const { session, adapter } = oidcSession(null);
    adapter.getUser.mockRejectedValueOnce(new Error("transient"));

    await expect(session.initialize()).rejects.toThrow("transient");
    await session.initialize();

    expect(session.snapshot()).toEqual({
      status: "anonymous",
      profile: null,
      errorCode: null,
    });
  });

  it("成功初始化只读取一次会话", async () => {
    const { session, adapter } = oidcSession(user());
    await Promise.all([session.initialize(), session.initialize()]);
    await session.initialize();
    expect(adapter.getUser).toHaveBeenCalledTimes(1);
  });

  it("过期用户视为未登录，取身份材料失败且不发出任何 Token", async () => {
    const { session } = oidcSession(user({ expired: true }));
    await session.initialize();
    expect(session.isAuthenticated()).toBe(false);
    await expect(session.credentials()).rejects.toBeInstanceOf(
      SessionUnavailableError,
    );
  });

  it("credentials 只返回 Bearer 所需的 access token", async () => {
    const { session } = oidcSession(user());
    await expect(session.credentials()).resolves.toEqual({
      mode: "oidc",
      accessToken: TOKEN,
    });
  });

  it("登录重定向只携带净化后的站内 returnUrl", async () => {
    const { session, adapter } = oidcSession();
    await session.signIn("https://evil.example/steal");
    await session.signIn("/market-signals?view=open");
    expect(adapter.signinRedirect.mock.calls).toEqual([
      [{ returnUrl: "/" }],
      [{ returnUrl: "/market-signals?view=open" }],
    ]);
    expect(session.snapshot().status).toBe("redirecting");
  });

  it("回调只处理一次并返回站内 returnUrl", async () => {
    const { session, adapter } = oidcSession();
    const [first, second] = await Promise.all([
      session.completeSignIn(),
      session.completeSignIn(),
    ]);
    expect(first).toBe("/market-signals?view=open");
    expect(second).toBe(first);
    expect(adapter.signinRedirectCallback).toHaveBeenCalledTimes(1);
    expect(session.isAuthenticated()).toBe(true);
  });

  it("回调状态指向协议路径或外站时回落首页，避免回调递归", async () => {
    const { session, adapter } = oidcSession();
    adapter.signinRedirectCallback.mockResolvedValueOnce(
      user({ state: { returnUrl: "/auth/callback?code=x" } }),
    );
    await expect(session.completeSignIn()).resolves.toBe("/");
  });

  it("回调失败进入可重试错误态，不自动再次重定向", async () => {
    const { session, adapter } = oidcSession();
    adapter.signinRedirectCallback.mockRejectedValueOnce(
      new Error("state mismatch"),
    );
    await expect(session.completeSignIn()).rejects.toThrow("state mismatch");
    expect(session.snapshot()).toMatchObject({
      status: "error",
      errorCode: "SIGNIN_CALLBACK_FAILED",
    });
    expect(adapter.signinRedirect).not.toHaveBeenCalled();
  });

  it("并发 401 只触发一次会话失效与重新登录", async () => {
    const { session, adapter, storage } = oidcSession(user());
    await Promise.all([
      session.handleUnauthorized("/market-signals"),
      session.handleUnauthorized("/market-signals"),
      session.handleUnauthorized("/tasks"),
    ]);
    expect(adapter.removeUser).toHaveBeenCalledTimes(1);
    expect(adapter.signinRedirect).toHaveBeenCalledTimes(1);
    expect(adapter.signinRedirect).toHaveBeenCalledWith({
      returnUrl: "/market-signals",
    });
    expect(storage.getItem(RECOVERY_MARKER_KEY)).toBe("1");
  });

  it("重新登录后服务端仍 401：停止重定向并报 SESSION_REJECTED", async () => {
    const { session, adapter, storage } = oidcSession(user());
    storage.setItem(RECOVERY_MARKER_KEY, "1");

    await session.handleUnauthorized("/market-signals");

    expect(adapter.signinRedirect).not.toHaveBeenCalled();
    expect(session.snapshot()).toMatchObject({
      status: "error",
      errorCode: "SESSION_REJECTED",
    });
  });

  it("请求被服务端接受后清除恢复标记，下次失效可再恢复一次", () => {
    const { session, storage } = oidcSession(user());
    storage.setItem(RECOVERY_MARKER_KEY, "1");
    session.confirmAuthorized();
    expect(storage.getItem(RECOVERY_MARKER_KEY)).toBeNull();
  });

  it("SDK 报告 Token 过期时会话回到 anonymous", async () => {
    const { session, emit } = oidcSession(user());
    await session.initialize();
    const seen: string[] = [];
    session.subscribe((snapshot) => seen.push(snapshot.status));
    emit(null);
    expect(session.snapshot().status).toBe("anonymous");
    expect(seen).toEqual(["anonymous"]);
  });

  it("注销走 IdP；注销回调清理本标签页会话", async () => {
    const { session, adapter, storage } = oidcSession(user());
    storage.setItem(RECOVERY_MARKER_KEY, "1");
    await session.signOut();
    expect(adapter.signoutRedirect).toHaveBeenCalledTimes(1);

    await session.completeSignOut();
    expect(adapter.signoutRedirectCallback).toHaveBeenCalledTimes(1);
    expect(adapter.removeUser).toHaveBeenCalled();
    expect(storage.getItem(RECOVERY_MARKER_KEY)).toBeNull();
    expect(session.snapshot()).toEqual({
      status: "signed_out",
      profile: null,
      errorCode: null,
    });
  });

  it("注销跳转失败时按剩余会话回写状态，不停留在跳转中", async () => {
    const kept = oidcSession(user());
    await kept.session.initialize();
    kept.adapter.signoutRedirect.mockRejectedValueOnce(new Error("offline"));
    await expect(kept.session.signOut()).rejects.toThrow("offline");
    expect(kept.session.snapshot().status).toBe("authenticated");

    const cleared = oidcSession(user());
    await cleared.session.initialize();
    cleared.adapter.signoutRedirect.mockImplementationOnce(async () => {
      await cleared.adapter.removeUser();
      throw new Error("no end_session_endpoint");
    });
    await expect(cleared.session.signOut()).rejects.toThrow();
    expect(cleared.session.snapshot()).toMatchObject({
      status: "anonymous",
      profile: null,
    });
  });
});

describe("createAuthSession（development）", () => {
  const session = () =>
    createAuthSession({
      config: {
        mode: "development",
        tenantId: "tenant-dev",
        operatorId: "operator-dev",
        roles: ["operations_dispatcher"],
      },
      adapter: null,
      storage: window.sessionStorage,
      origin: ORIGIN,
    });

  it("只提供配置中的开发身份，不重定向 IdP", async () => {
    const dev = session();
    await dev.initialize();
    expect(dev.isAuthenticated()).toBe(true);
    await expect(dev.credentials()).resolves.toEqual({
      mode: "development",
      tenantId: "tenant-dev",
      operatorId: "operator-dev",
      roles: ["operations_dispatcher"],
    });
    await expect(dev.signIn("/tasks")).resolves.toBeUndefined();
    await expect(dev.handleUnauthorized("/tasks")).resolves.toBeUndefined();
    expect(dev.isAuthenticated()).toBe(true);
  });

  it("OIDC 模式缺少 SDK Adapter 时拒绝创建", () => {
    expect(() =>
      createAuthSession({
        config: OIDC_CONFIG,
        adapter: null,
        storage: window.sessionStorage,
        origin: ORIGIN,
      }),
    ).toThrow("AUTH_ADAPTER_MISSING");
  });
});
