import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession, RequestCredentials } from "../auth/session";

const credentials = vi.fn<() => Promise<RequestCredentials>>();

vi.mock("../auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../auth/session")>()),
  getAuthSession: () =>
    ({
      credentials,
      handleUnauthorized: vi.fn(async () => undefined),
      confirmAuthorized: vi.fn(),
    }) as unknown as AuthSession,
}));

const {
  createMarketSignal,
  decideMarketSignal,
  listMarketSignals,
  updateMarketSignal,
} = await import("./marketSignals");

const DEV_HEADERS = {
  "X-Tenant-Id": "tenant-dev",
  "X-Operator-Id": "operator-dev",
  "X-Roles": "operations_dispatcher",
};

let fetchMock: ReturnType<typeof vi.fn>;

function ok(body: unknown) {
  return {
    status: 200,
    ok: true,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

beforeEach(() => {
  credentials.mockResolvedValue({
    mode: "development",
    tenantId: "tenant-dev",
    operatorId: "operator-dev",
    roles: ["operations_dispatcher"],
  });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("marketSignals 经共享 Client", () => {
  it("GET 列表保持原 URL 并返回服务端分页", async () => {
    const page = { items: [], pageInfo: { nextCursor: null } };
    fetchMock.mockResolvedValue(ok(page));

    await expect(listMarketSignals()).resolves.toEqual(page);
    expect(fetchMock).toHaveBeenCalledWith("/api/market-signals?pageSize=100", {
      method: "GET",
      redirect: "error",
      headers: DEV_HEADERS,
    });
  });

  it("POST 登记保持 JSON 契约", async () => {
    const command = { title: "竞品降价" } as never;
    fetchMock.mockResolvedValue(ok({ id: "s-1" }));

    await expect(createMarketSignal(command)).resolves.toEqual({ id: "s-1" });
    expect(fetchMock).toHaveBeenCalledWith("/api/market-signals", {
      method: "POST",
      redirect: "error",
      headers: { ...DEV_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
  });

  it("PATCH 补充对 ID 编码并保持方法", async () => {
    fetchMock.mockResolvedValue(ok({ id: "s/1" }));

    await updateMarketSignal("s/1", { summary: "补充" } as never);

    expect(fetchMock).toHaveBeenCalledWith("/api/market-signals/s%2F1", {
      method: "PATCH",
      redirect: "error",
      headers: { ...DEV_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ summary: "补充" }),
    });
  });

  it("OIDC 会话下同一请求只带 Bearer", async () => {
    credentials.mockResolvedValue({ mode: "oidc", accessToken: "token-xyz" });
    fetchMock.mockResolvedValue(ok({ items: [] }));

    await listMarketSignals();

    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      Authorization: "Bearer token-xyz",
    });
  });

  it("失败文案与原实现一致", async () => {
    fetchMock.mockResolvedValue({
      status: 409,
      ok: false,
      json: async () => ({}),
      text: async () =>
        JSON.stringify({ message: "BUSINESS_STATE_VIOLATION: 已判断" }),
    });

    await expect(
      decideMarketSignal("s-1", { decision: "advance" } as never),
    ).rejects.toThrow(
      "暂时无法保存本次判断（409）：BUSINESS_STATE_VIOLATION: 已判断",
    );
  });
});
