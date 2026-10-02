import type { MarketSignalV1 } from "@logix/contracts";
import { expect, test, type Page, type Request } from "@playwright/test";
import { OIDC_APP_URL } from "../src/e2eDevServer";
import { OidcIdentityProvider } from "./support/oidcIdentityProvider";

const USER = { subject: "e2e-user-7f3a", name: "认证测试员" };
const MARKET_SIGNALS = "/workspaces/market-signals";
const DEVELOPMENT_HEADERS = ["x-tenant-id", "x-operator-id", "x-roles"];

interface ApiCall {
  readonly method: string;
  readonly path: string;
  readonly bearer: boolean;
  readonly developmentHeaders: boolean;
}

type ApiReply = { status: number; body: unknown };

/** 安装 IdP 替身与 `/api` 桩，并收集所有请求/导航 URL 供“Token 不进 URL”断言。 */
async function setup(
  page: Page,
  reply: (request: Request, path: string) => ApiReply | null,
) {
  const idp = new OidcIdentityProvider(USER);
  await idp.install(page);
  const apiCalls: ApiCall[] = [];
  const urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));
  page.on("framenavigated", (frame) => urls.push(frame.url()));

  await page.route(
    (url) => url.origin === OIDC_APP_URL && url.pathname.startsWith("/api/"),
    async (route) => {
      const request = route.request();
      const headers = request.headers();
      const path = new URL(request.url()).pathname;
      apiCalls.push({
        method: request.method(),
        path,
        bearer: idp.isCurrentBearer(headers["authorization"]),
        developmentHeaders: DEVELOPMENT_HEADERS.some((name) => name in headers),
      });
      const result = reply(request, path) ?? {
        status: 404,
        body: { code: "NOT_FOUND" },
      };
      await route.fulfill({
        status: result.status,
        contentType: "application/json",
        body: JSON.stringify(result.body),
      });
    },
  );
  return { idp, apiCalls, urls };
}

async function expectNoTokenLeak(
  page: Page,
  idp: OidcIdentityProvider,
  urls: readonly string[],
) {
  expect(urls.some((url) => idp.leaksToken(url))).toBe(false);
  expect(await idp.tokenInStorage(page, "localStorage")).toBe(false);
  expect(idp.violations).toEqual([]);
}

function signedIn(page: Page) {
  return page
    .getByTestId("login-identity")
    .getByText(USER.name, { exact: true });
}

test("未登录访问受保护页先登录，回调回到原路径，读写只带 Bearer", async ({
  page,
}) => {
  const signalId = "11111111-1111-4111-8111-111111111111";
  const signals = new Map<string, MarketSignalV1>([
    [signalId, signal("美国站庭院收纳需求上升", signalId)],
  ]);
  const { idp, apiCalls, urls } = await setup(page, (request, path) => {
    if (
      path !== "/api/market-signals" &&
      !path.startsWith("/api/market-signals/")
    ) {
      return null;
    }
    const id = path.split("/")[3];
    if (!id && request.method() === "GET") {
      return {
        status: 200,
        body: {
          contractVersion: "market-signal-page.v1",
          items: [...signals.values()],
          pageSize: 100,
          nextCursor: null,
        },
      };
    }
    if (!id && request.method() === "POST") {
      const command = request.postDataJSON() as {
        requestId: string;
        title: string;
      };
      const created = signal(command.title, command.requestId);
      signals.set(created.signalId, created);
      return { status: 200, body: created };
    }
    const current = id ? signals.get(id) : undefined;
    return current
      ? { status: 200, body: { signal: current, evidence: [] } }
      : null;
  });

  const deepLink = `${MARKET_SIGNALS}?signalId=${signalId}`;
  await page.goto(deepLink);

  await expect(page).toHaveURL(`${OIDC_APP_URL}${deepLink}`);
  await expect(
    page.getByRole("heading", { name: "市场与经营信号", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "美国站庭院收纳需求上升 · 依据与判断" }),
  ).toBeVisible();
  await expect(signedIn(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "退出登录" })).toBeVisible();
  expect(idp.authorizeRequests).toBe(1);
  expect(idp.tokenRequests).toBe(1);

  await page.getByRole("button", { name: "登记信号" }).click();
  await page.getByLabel("信号标题 用于识别").fill("法国站户外用餐场景");
  const created = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/market-signals",
  );
  await page.getByRole("button", { name: "加入待判断" }).click();
  await created;
  await expect(
    page.getByRole("heading", { name: "法国站户外用餐场景 · 依据与判断" }),
  ).toBeVisible();

  const signalCalls = apiCalls.filter(({ path }) =>
    path.startsWith("/api/market-signals"),
  );
  expect(signalCalls.map(({ method }) => method)).toEqual(
    expect.arrayContaining(["GET", "POST"]),
  );
  expect(apiCalls.length).toBeGreaterThan(0);
  expect(apiCalls.every(({ bearer }) => bearer)).toBe(true);
  expect(apiCalls.some(({ developmentHeaders }) => developmentHeaders)).toBe(
    false,
  );
  await expectNoTokenLeak(page, idp, urls);
});

test("回调拒绝外部 returnUrl，只回到站内首页", async ({ page }) => {
  const { idp, urls } = await setup(page, () => null);

  await page.goto(`${OIDC_APP_URL}//evil.example/steal`);

  await expect(signedIn(page)).toBeVisible();
  expect(new URL(page.url()).origin).toBe(OIDC_APP_URL);
  expect(new URL(page.url()).pathname.startsWith("//")).toBe(false);
  expect(idp.authorizeRequests).toBe(1);
  expect(urls.some((url) => new URL(url).hostname === "evil.example")).toBe(
    false,
  );
  await expectNoTokenLeak(page, idp, urls);
});

test("401 只重新登录一次，服务端仍拒绝时停在会话无效且不再跳转", async ({
  page,
}) => {
  const { idp, apiCalls, urls } = await setup(page, (_request, path) =>
    path.startsWith("/api/market-signals")
      ? { status: 401, body: { code: "UNAUTHENTICATED" } }
      : null,
  );

  await page.goto(MARKET_SIGNALS);

  await expect(
    page.getByTestId("login-identity").getByText("会话无效，请重新登录"),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(idp.authorizeRequests).toBe(2);
  const signalCalls = apiCalls.filter(({ path }) =>
    path.startsWith("/api/market-signals"),
  );
  expect(signalCalls).toHaveLength(14);
  expect(
    signalCalls.every(
      ({ method, path }) => method === "GET" && path === "/api/market-signals",
    ),
  ).toBe(true);
  expect(apiCalls.every(({ bearer }) => bearer)).toBe(true);
  await expect(page).toHaveURL(`${OIDC_APP_URL}${MARKET_SIGNALS}`);
  await expectNoTokenLeak(page, idp, urls);
});

test("403 保留拒绝原因，不重新登录", async ({ page }) => {
  const { idp, apiCalls, urls } = await setup(page, (_request, path) =>
    path.startsWith("/api/market-signals")
      ? {
          status: 403,
          body: { message: "无权查看经营信号", traceId: "trace-e2e-403" },
        }
      : null,
  );

  await page.goto(MARKET_SIGNALS);

  await expect(
    page.getByText("暂时无法加载经营信号（403）：无权查看经营信号"),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(signedIn(page)).toBeVisible();
  expect(idp.authorizeRequests).toBe(1);
  expect(apiCalls.every(({ bearer }) => bearer)).toBe(true);
  await expectNoTokenLeak(page, idp, urls);
});

test("注销走 IdP 并清除本标签页会话", async ({ page }) => {
  const { idp, urls } = await setup(page, () => null);
  await page.goto(MARKET_SIGNALS);
  await expect(signedIn(page)).toBeVisible();
  expect(await idp.tokenInStorage(page, "sessionStorage")).toBe(true);

  await page.getByRole("button", { name: "退出登录" }).click();

  await expect(page).toHaveURL(/\/auth\/logout-callback/);
  await expect(page.getByText("已退出登录。")).toBeVisible();
  await expect(
    page.getByTestId("login-identity").getByText("已退出登录"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "退出登录" })).toHaveCount(0);
  expect(idp.endSessionRequests).toBe(1);
  expect(await idp.tokenInStorage(page, "sessionStorage")).toBe(false);
  await expectNoTokenLeak(page, idp, urls);
});

function signal(title: string, signalId: string): MarketSignalV1 {
  return {
    signalId,
    title,
    marketCode: "US",
    channelCode: null,
    categoryRef: null,
    observedFactSummary: null,
    hypothesis: null,
    evidenceRefs: [],
    currentDestination: "needs_decision",
    ownerTeamCode: "market_intelligence",
    version: 1,
    pendingFieldCodes: ["channel_code"],
    createdAt: "2026-09-25T00:00:00.000Z",
    updatedAt: "2026-09-25T00:00:00.000Z",
  };
}
