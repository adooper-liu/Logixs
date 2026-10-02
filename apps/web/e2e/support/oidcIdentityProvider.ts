import { createHash, randomBytes } from "node:crypto";
import type { Page, Route } from "@playwright/test";
import { OIDC_APP_URL } from "../../src/e2eDevServer";
import { E2E_OIDC_AUTHORITY, E2E_OIDC_CLIENT_ID } from "./testServers";

const REDIRECT_URI = `${OIDC_APP_URL}/auth/callback`;
const POST_LOGOUT_REDIRECT_URI = `${OIDC_APP_URL}/auth/logout-callback`;
const ENDPOINTS = {
  authorize: `${E2E_OIDC_AUTHORITY}/protocol/openid-connect/auth`,
  token: `${E2E_OIDC_AUTHORITY}/protocol/openid-connect/token`,
  endSession: `${E2E_OIDC_AUTHORITY}/protocol/openid-connect/logout`,
  jwks: `${E2E_OIDC_AUTHORITY}/protocol/openid-connect/certs`,
};
const CORS = {
  "access-control-allow-origin": OIDC_APP_URL,
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, accept, authorization",
};

interface PendingCode {
  readonly codeChallenge: string;
  readonly nonce: string | null;
}

/**
 * 浏览器内 IdP 替身：只拦截 Playwright 页面发往测试 authority 的协议请求，按 Authorization Code +
 * PKCE 返回结果，并校验 client_id、回调地址、PKCE 与无 client secret。
 * Token 每次随机生成、只留在本进程内存；对外只暴露比较函数，断言与日志不出现 Token 原文。
 */
export class OidcIdentityProvider {
  authorizeRequests = 0;
  tokenRequests = 0;
  endSessionRequests = 0;
  /** 协议违规的描述；不含 Token、code 或 verifier。 */
  readonly violations: string[] = [];
  private readonly codes = new Map<string, PendingCode>();
  private readonly issued: string[] = [];

  constructor(
    private readonly user: { readonly subject: string; readonly name: string },
  ) {}

  async install(page: Page): Promise<void> {
    await page.route(
      (url) => url.href.startsWith(`${E2E_OIDC_AUTHORITY}/`),
      (route) => this.handle(route),
    );
  }

  /** 是否恰好是当前有效 Token 的 Bearer 头；返回布尔值，避免 Token 进入断言文本。 */
  isCurrentBearer(header: string | undefined): boolean {
    const current = this.issued.at(-1);
    return current !== undefined && header === `Bearer ${current}`;
  }

  /** 文本中是否出现任何已签发 Token。 */
  leaksToken(text: string): boolean {
    return this.issued.some((token) => text.includes(token));
  }

  /** 在页面里检查存储，Token 只作为参数传入，返回值只有布尔。 */
  async tokenInStorage(
    page: Page,
    storage: "localStorage" | "sessionStorage",
  ): Promise<boolean> {
    return page.evaluate(
      ({ tokens, storage }) =>
        Object.values(window[storage]).some((value) =>
          tokens.some((token) => value.includes(token)),
        ),
      { tokens: this.issued, storage },
    );
  }

  private async handle(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const endpoint = `${url.origin}${url.pathname}`;
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    if (url.pathname.endsWith("/.well-known/openid-configuration")) {
      await this.json(route, {
        issuer: E2E_OIDC_AUTHORITY,
        authorization_endpoint: ENDPOINTS.authorize,
        token_endpoint: ENDPOINTS.token,
        end_session_endpoint: ENDPOINTS.endSession,
        jwks_uri: ENDPOINTS.jwks,
        response_types_supported: ["code"],
        code_challenge_methods_supported: ["S256"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
      });
      return;
    }
    if (endpoint === ENDPOINTS.authorize) return this.authorize(route, url);
    if (endpoint === ENDPOINTS.token) return this.token(route);
    if (endpoint === ENDPOINTS.endSession) return this.endSession(route, url);
    this.violations.push(`unexpected endpoint ${url.pathname}`);
    await route.fulfill({ status: 404, headers: CORS });
  }

  private async authorize(route: Route, url: URL): Promise<void> {
    this.authorizeRequests += 1;
    const params = url.searchParams;
    const state = params.get("state");
    const codeChallenge = params.get("code_challenge");
    const problems = [
      params.get("client_id") !== E2E_OIDC_CLIENT_ID && "client_id",
      params.get("redirect_uri") !== REDIRECT_URI && "redirect_uri",
      params.get("response_type") !== "code" && "response_type",
      params.get("code_challenge_method") !== "S256" && "pkce_method",
      !codeChallenge && "pkce_challenge",
      !state && "state",
      !params.get("scope")?.split(" ").includes("openid") && "scope",
    ].filter(Boolean);
    if (problems.length > 0 || !state || !codeChallenge) {
      this.violations.push(`authorize: ${problems.join(",")}`);
      await route.fulfill({ status: 400, body: "invalid_request" });
      return;
    }
    const code = randomBytes(16).toString("base64url");
    this.codes.set(code, { codeChallenge, nonce: params.get("nonce") });
    const callback = new URL(REDIRECT_URI);
    callback.searchParams.set("code", code);
    callback.searchParams.set("state", state);
    await route.fulfill({
      status: 302,
      headers: { location: callback.toString() },
    });
  }

  private async token(route: Route): Promise<void> {
    this.tokenRequests += 1;
    const form = new URLSearchParams(route.request().postData() ?? "");
    const code = form.get("code") ?? "";
    const pending = this.codes.get(code);
    this.codes.delete(code);
    const verifier = form.get("code_verifier") ?? "";
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const problems = [
      form.get("grant_type") !== "authorization_code" && "grant_type",
      form.get("client_id") !== E2E_OIDC_CLIENT_ID && "client_id",
      form.get("redirect_uri") !== REDIRECT_URI && "redirect_uri",
      form.has("client_secret") && "client_secret",
      route.request().headers()["authorization"] !== undefined &&
        "client_authentication",
      !pending && "code",
      pending && pending.codeChallenge !== challenge && "pkce_verifier",
    ].filter(Boolean);
    if (problems.length > 0 || !pending) {
      this.violations.push(`token: ${problems.join(",")}`);
      await this.json(route, { error: "invalid_grant" }, 400);
      return;
    }
    const accessToken = randomBytes(24).toString("base64url");
    this.issued.push(accessToken);
    const now = Math.floor(Date.now() / 1000);
    await this.json(route, {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 300,
      scope: "openid profile",
      id_token: unsignedJwt({
        iss: E2E_OIDC_AUTHORITY,
        aud: E2E_OIDC_CLIENT_ID,
        sub: this.user.subject,
        name: this.user.name,
        iat: now,
        exp: now + 300,
        ...(pending.nonce ? { nonce: pending.nonce } : {}),
      }),
    });
  }

  private async endSession(route: Route, url: URL): Promise<void> {
    this.endSessionRequests += 1;
    const target = url.searchParams.get("post_logout_redirect_uri");
    if (target !== POST_LOGOUT_REDIRECT_URI) {
      this.violations.push("end_session: post_logout_redirect_uri");
      await route.fulfill({ status: 400, body: "invalid_request" });
      return;
    }
    const callback = new URL(target);
    const state = url.searchParams.get("state");
    if (state) callback.searchParams.set("state", state);
    await route.fulfill({
      status: 302,
      headers: { location: callback.toString() },
    });
  }

  private async json(route: Route, body: unknown, status = 200): Promise<void> {
    await route.fulfill({
      status,
      headers: CORS,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  }
}

/** SDK 只解码 id_token 声明、不验签（验签属于服务端）；替身因此不需要任何私钥。 */
function unsignedJwt(claims: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(claims)}.e2e`;
}
