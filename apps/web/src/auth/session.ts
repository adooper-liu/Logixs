import {
  UserManager,
  WebStorageStateStore,
  type UserManagerSettings,
} from "oidc-client-ts";
import { authConfig, type AuthConfig, type OidcAuthConfig } from "./config";
import { safeReturnUrl } from "./returnUrl";

export type SessionStatus =
  | "initializing"
  | "anonymous"
  | "authenticated"
  | "redirecting"
  | "signed_out"
  | "error";

export type SessionErrorCode =
  | "SESSION_INIT_FAILED"
  | "SIGNIN_REDIRECT_FAILED"
  | "SIGNIN_CALLBACK_FAILED"
  | "SIGNOUT_CALLBACK_FAILED"
  | "SESSION_REJECTED";

export interface SessionProfile {
  readonly subject: string;
  readonly displayName: string | null;
}

/** 对 UI 暴露的唯一会话视图：不含任何 Token 或原始 SDK 响应。 */
export interface SessionSnapshot {
  readonly status: SessionStatus;
  readonly profile: SessionProfile | null;
  readonly errorCode: SessionErrorCode | null;
}

export type RequestCredentials =
  | {
      readonly mode: "development";
      readonly tenantId: string;
      readonly operatorId: string;
      readonly roles: readonly string[];
    }
  | { readonly mode: "oidc"; readonly accessToken: string };

export interface OidcUser {
  readonly access_token: string;
  readonly expired?: boolean;
  readonly state?: unknown;
  readonly profile: {
    readonly sub: string;
    readonly name?: string;
    readonly preferred_username?: string;
  };
}

/** `oidc-client-ts` 的窄端口；测试注入替身，生产只由 {@link createOidcAdapter} 实现。 */
export interface OidcAdapter {
  getUser(): Promise<OidcUser | null>;
  signinRedirect(state: { returnUrl: string }): Promise<void>;
  signinRedirectCallback(): Promise<OidcUser>;
  signinSilentCallback(): Promise<void>;
  signoutRedirect(): Promise<void>;
  signoutRedirectCallback(): Promise<void>;
  removeUser(): Promise<void>;
  onUserChanged(listener: (user: OidcUser | null) => void): void;
}

export interface AuthSession {
  readonly mode: AuthConfig["mode"];
  snapshot(): SessionSnapshot;
  subscribe(listener: (snapshot: SessionSnapshot) => void): () => void;
  initialize(): Promise<void>;
  isAuthenticated(): boolean;
  /** 取当前请求唯一允许的身份材料；OIDC 无有效 Token 时抛 {@link SessionUnavailableError}。 */
  credentials(): Promise<RequestCredentials>;
  signIn(returnUrl: string): Promise<void>;
  completeSignIn(): Promise<string>;
  completeSilentRenew(): Promise<void>;
  signOut(): Promise<void>;
  completeSignOut(): Promise<void>;
  handleUnauthorized(returnUrl: string): Promise<void>;
  confirmAuthorized(): void;
}

export class SessionUnavailableError extends Error {
  constructor() {
    super("SESSION_UNAVAILABLE");
    this.name = "SessionUnavailableError";
  }
}

/** 标记“已为 401 发起过一次重新登录”；服务端仍拒绝时停止重定向，避免与 IdP 形成登录环。 */
export const RECOVERY_MARKER_KEY = "logix.auth.unauthorized-recovery";

export function createAuthSession(input: {
  config: AuthConfig;
  adapter: OidcAdapter | null;
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  origin: string;
}): AuthSession {
  const { config, storage, origin } = input;
  const adapter = config.mode === "oidc" ? requireAdapter(input.adapter) : null;
  const listeners = new Set<(snapshot: SessionSnapshot) => void>();
  let state: SessionSnapshot = Object.freeze({
    status: "initializing",
    profile: null,
    errorCode: null,
  });
  let initializing: Promise<void> | null = null;
  let completingSignIn: Promise<string> | null = null;
  let recovering = false;

  function publish(next: Partial<SessionSnapshot>) {
    state = Object.freeze({ ...state, ...next });
    for (const listener of listeners) listener(state);
  }

  function applyUser(user: OidcUser | null) {
    if (user && !user.expired) {
      publish({
        status: "authenticated",
        profile: toProfile(user),
        errorCode: null,
      });
    } else if (state.status === "authenticated") {
      publish({ status: "anonymous", profile: null });
    }
  }

  adapter?.onUserChanged(applyUser);

  async function signIn(returnUrl: string) {
    if (!adapter) return;
    publish({ status: "redirecting", errorCode: null });
    try {
      await adapter.signinRedirect({
        returnUrl: safeReturnUrl(returnUrl, origin),
      });
    } catch (error) {
      publish({ status: "error", errorCode: "SIGNIN_REDIRECT_FAILED" });
      throw error;
    }
  }

  function initialize() {
    initializing ??= (async () => {
      if (config.mode === "development") {
        publish({
          status: "authenticated",
          profile: { subject: config.operatorId, displayName: null },
        });
        return;
      }
      const user = await adapter!.getUser();
      if (user && !user.expired) applyUser(user);
      else publish({ status: "anonymous", profile: null, errorCode: null });
    })().catch((error: unknown) => {
      // 失败不得被记忆：清空后下一次导航或请求可重新读取会话。
      initializing = null;
      publish({
        status: "error",
        profile: null,
        errorCode: "SESSION_INIT_FAILED",
      });
      throw error;
    });
    return initializing;
  }

  return {
    mode: config.mode,
    snapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    initialize,
    isAuthenticated: () => state.status === "authenticated",
    async credentials() {
      if (config.mode === "development") {
        return {
          mode: "development",
          tenantId: config.tenantId,
          operatorId: config.operatorId,
          roles: config.roles,
        };
      }
      await initialize();
      const user = await adapter!.getUser();
      if (!user || user.expired || !user.access_token) {
        throw new SessionUnavailableError();
      }
      return { mode: "oidc", accessToken: user.access_token };
    },
    signIn,
    completeSignIn() {
      completingSignIn ??= (async () => {
        try {
          const user = await adapter!.signinRedirectCallback();
          applyUser(user);
          const returnState = user.state as { returnUrl?: unknown } | undefined;
          return safeReturnUrl(returnState?.returnUrl, origin);
        } catch (error) {
          publish({
            status: "error",
            profile: null,
            errorCode: "SIGNIN_CALLBACK_FAILED",
          });
          throw error;
        }
      })();
      return completingSignIn;
    },
    async completeSilentRenew() {
      await adapter?.signinSilentCallback();
    },
    async signOut() {
      if (!adapter) return;
      publish({ status: "redirecting" });
      try {
        await adapter.signoutRedirect();
      } catch (error) {
        // SDK 在取 end_session 前已清本地用户；失败时按真实剩余会话回写，不停留在跳转中。
        const user = await adapter.getUser().catch(() => null);
        if (user && !user.expired) applyUser(user);
        else publish({ status: "anonymous", profile: null });
        throw error;
      }
    },
    async completeSignOut() {
      if (!adapter) return;
      try {
        await adapter.signoutRedirectCallback();
      } catch (error) {
        await adapter.removeUser();
        publish({
          status: "error",
          profile: null,
          errorCode: "SIGNOUT_CALLBACK_FAILED",
        });
        throw error;
      }
      await adapter.removeUser();
      storage.removeItem(RECOVERY_MARKER_KEY);
      publish({ status: "signed_out", profile: null, errorCode: null });
    },
    async handleUnauthorized(returnUrl) {
      if (!adapter || recovering) return;
      recovering = true;
      await adapter.removeUser();
      if (storage.getItem(RECOVERY_MARKER_KEY)) {
        publish({
          status: "error",
          profile: null,
          errorCode: "SESSION_REJECTED",
        });
        return;
      }
      storage.setItem(RECOVERY_MARKER_KEY, "1");
      await signIn(returnUrl);
    },
    confirmAuthorized() {
      if (storage.getItem(RECOVERY_MARKER_KEY)) {
        storage.removeItem(RECOVERY_MARKER_KEY);
      }
    },
  };
}

/** 公共客户端 Authorization Code + PKCE；协议状态与用户会话都只落当前标签页 sessionStorage。 */
export function oidcSettings(
  config: OidcAuthConfig,
  storage: Storage,
): UserManagerSettings {
  return {
    authority: config.authority,
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    post_logout_redirect_uri: config.postLogoutRedirectUri,
    response_type: "code",
    scope: config.scope,
    disablePKCE: false,
    // SDK 的 stateStore 默认是 localStorage，必须显式收窄到本标签页。
    stateStore: new WebStorageStateStore({ store: storage }),
    userStore: new WebStorageStateStore({ store: storage }),
    loadUserInfo: false,
    monitorSession: false,
    automaticSilentRenew: config.silentRedirectUri !== null,
    ...(config.silentRedirectUri
      ? { silent_redirect_uri: config.silentRedirectUri }
      : {}),
  };
}

export function createOidcAdapter(
  config: OidcAuthConfig,
  storage: Storage,
): OidcAdapter {
  const manager = new UserManager(oidcSettings(config, storage));
  return {
    getUser: () => manager.getUser(),
    signinRedirect: (state) => manager.signinRedirect({ state }),
    signinRedirectCallback: () => manager.signinRedirectCallback(),
    signinSilentCallback: async () => {
      await manager.signinSilentCallback();
    },
    signoutRedirect: () => manager.signoutRedirect(),
    signoutRedirectCallback: async () => {
      await manager.signoutRedirectCallback();
    },
    removeUser: () => manager.removeUser(),
    onUserChanged(listener) {
      manager.events.addUserLoaded((user) => listener(user));
      manager.events.addUserUnloaded(() => listener(null));
      manager.events.addAccessTokenExpired(() => listener(null));
    },
  };
}

function requireAdapter(adapter: OidcAdapter | null): OidcAdapter {
  if (!adapter) throw new Error("AUTH_ADAPTER_MISSING");
  return adapter;
}

function toProfile(user: OidcUser): SessionProfile {
  return {
    subject: user.profile.sub,
    displayName:
      user.profile.name?.trim() ||
      user.profile.preferred_username?.trim() ||
      null,
  };
}

let instance: AuthSession | null = null;

/** 应用级唯一会话；首次访问时解析配置并创建 SDK 实例，测试通过模块替身替换。 */
export function getAuthSession(): AuthSession {
  if (!instance) {
    const config = authConfig();
    const storage = window.sessionStorage;
    instance = createAuthSession({
      config,
      adapter:
        config.mode === "oidc" ? createOidcAdapter(config, storage) : null,
      storage,
      origin: window.location.origin,
    });
  }
  return instance;
}
