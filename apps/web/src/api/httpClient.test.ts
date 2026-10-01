import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SessionUnavailableError,
  type AuthSession,
  type RequestCredentials,
} from "../auth/session";

const session = {
  credentials: vi.fn<() => Promise<RequestCredentials>>(),
  handleUnauthorized: vi.fn(async () => undefined),
  confirmAuthorized: vi.fn(),
};

vi.mock("../auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../auth/session")>()),
  getAuthSession: () => session as unknown as AuthSession,
}));

const { HttpRequestError, requestApi, requestJson } =
  await import("./httpClient");

const OIDC: RequestCredentials = { mode: "oidc", accessToken: "token-abc" };
const DEVELOPMENT: RequestCredentials = {
  mode: "development",
  tenantId: "tenant-dev",
  operatorId: "operator-dev",
  roles: ["operations_dispatcher", "review_supervisor"],
};

function response(status: number, body: unknown = {}) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => JSON.parse(text),
    text: async () => text,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  session.credentials.mockReset();
  session.handleUnauthorized.mockClear();
  session.confirmAuthorized.mockClear();
  fetchMock = vi.fn().mockResolvedValue(response(200, { ok: true }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function sentHeaders(): Record<string, string> {
  return fetchMock.mock.calls[0][1].headers as Record<string, string>;
}

describe("requestJson 身份注入", () => {
  it("OIDC 模式只发 Bearer，绝不发送开发身份头", async () => {
    session.credentials.mockResolvedValue(OIDC);

    await requestJson("/api/x", { fallback: "失败" });

    expect(sentHeaders()).toEqual({ Authorization: "Bearer token-abc" });
    expect(session.confirmAuthorized).toHaveBeenCalledTimes(1);
  });

  it("development 模式只发配置中的开发身份头，不带 Authorization", async () => {
    session.credentials.mockResolvedValue(DEVELOPMENT);

    await requestJson("/api/x", {
      method: "POST",
      body: { a: 1 },
      fallback: "失败",
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/x", {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-Id": "tenant-dev",
        "X-Operator-Id": "operator-dev",
        "X-Roles": "operations_dispatcher,review_supervisor",
      },
      body: JSON.stringify({ a: 1 }),
    });
    expect(session.confirmAuthorized).not.toHaveBeenCalled();
  });

  it.each([
    "Authorization",
    "authorization",
    "X-Tenant-Id",
    "x-roles",
    "X-Operator-Id",
  ])("调用方传入受保护头 %s 视为编程错误，不发请求", async (name) => {
    session.credentials.mockResolvedValue(OIDC);

    await expect(
      requestJson("/api/x", {
        fallback: "失败",
        headers: { [name]: "forged" },
      }),
    ).rejects.toThrow(`PROTECTED_HEADER_OVERRIDE: ${name}`);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("非身份附加头照常发送，且不能覆盖身份", async () => {
    session.credentials.mockResolvedValue(OIDC);

    await requestJson("/api/x", {
      fallback: "失败",
      headers: { "Idempotency-Key": "k-1" },
    });

    expect(sentHeaders()).toEqual({
      "Idempotency-Key": "k-1",
      Authorization: "Bearer token-abc",
    });
  });
});

describe("requestJson 同源 /api 边界", () => {
  it.each([
    ["外站绝对地址", "https://evil.example/api/x"],
    ["同源绝对地址也不放行", `${window.location.origin}/api/x`],
    ["协议相对", "//evil.example/api/x"],
    ["非 /api 前缀", "/admin/x"],
    ["前缀相似但不是 /api/", "/apix/x"],
    ["缺少前导斜杠", "api/x"],
    ["脚本协议", "javascript:alert(1)"],
    ["点段越界", "/api/../admin"],
    ["编码点段越界", "/api/%2e%2e/admin"],
    ["大小写编码点段", "/api/%2E%2E/admin"],
    ["编码斜杠夹带点段", "/api/..%2fadmin"],
    ["单点段", "/api/./x"],
    ["反斜杠", "/api\\..\\admin"],
    ["换行注入", "/api/x\n//evil.example"],
    ["制表符", "/api/\tx"],
    ["非法百分号编码", "/api/%E0%A4%A"],
  ])("%s %j：不取身份、不发请求", async (_label, url) => {
    session.credentials.mockResolvedValue(OIDC);

    await expect(requestJson(url, { fallback: "失败" })).rejects.toThrow(
      "API_URL_REJECTED",
    );
    expect(session.credentials).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("放行站内 /api 路径并保留查询与已编码的 ID", async () => {
    session.credentials.mockResolvedValue(OIDC);

    await requestJson("/api/market-signals/s%2F1?pageSize=100#ignored", {
      fallback: "失败",
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/market-signals/s%2F1?pageSize=100",
    );
    expect(fetchMock.mock.calls[0][1].redirect).toBe("error");
  });
});

describe("requestJson 失败分类", () => {
  it("OIDC 无有效会话：不发请求，触发一次会话恢复并报 unauthorized", async () => {
    session.credentials.mockRejectedValue(new SessionUnavailableError());

    const error = await requestJson("/api/x", { fallback: "加载失败" }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(HttpRequestError);
    expect(error).toMatchObject({ kind: "unauthorized", status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(session.handleUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("401 触发会话恢复且不确认授权", async () => {
    session.credentials.mockResolvedValue(OIDC);
    fetchMock.mockResolvedValue(response(401, { message: "Unauthorized" }));

    const error = await requestJson("/api/x", { fallback: "加载失败" }).catch(
      (e: unknown) => e,
    );

    expect(error).toMatchObject({
      kind: "unauthorized",
      status: 401,
      message: "加载失败（401）：Unauthorized",
    });
    expect(session.handleUnauthorized).toHaveBeenCalledTimes(1);
    expect(session.confirmAuthorized).not.toHaveBeenCalled();
  });

  it("403 是服务端授权拒绝：保留原因与 traceId，不重新登录", async () => {
    session.credentials.mockResolvedValue(OIDC);
    fetchMock.mockResolvedValue(
      response(403, {
        success: false,
        error: { code: "AUTHORIZATION_FORBIDDEN", message: "无权限" },
        traceId: "trace-403",
      }),
    );

    const error = await requestJson("/api/x", { fallback: "保存失败" }).catch(
      (e: unknown) => e,
    );

    expect(error).toMatchObject({
      kind: "forbidden",
      status: 403,
      traceId: "trace-403",
    });
    expect((error as Error).message).toContain("保存失败（403）");
    expect(session.handleUnauthorized).not.toHaveBeenCalled();
  });

  it("业务错误保持原文案格式", async () => {
    session.credentials.mockResolvedValue(DEVELOPMENT);
    fetchMock.mockResolvedValue(
      response(409, { message: "BUSINESS_STATE_VIOLATION: 已关闭" }),
    );

    await expect(
      requestJson("/api/x", { fallback: "暂时无法保存" }),
    ).rejects.toMatchObject({
      kind: "http",
      status: 409,
      message: "暂时无法保存（409）：BUSINESS_STATE_VIOLATION: 已关闭",
    });
  });

  it("网络失败与 HTTP 错误可区分", async () => {
    session.credentials.mockResolvedValue(DEVELOPMENT);
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(
      requestJson("/api/x", { fallback: "失败" }),
    ).rejects.toMatchObject({
      kind: "network",
      status: 0,
      message: "Failed to fetch",
    });
    expect(session.handleUnauthorized).not.toHaveBeenCalled();
  });
});

describe("requestApi 底层入口", () => {
  it("非 401 响应原样交回调用方，保留 404 等自定义分支", async () => {
    session.credentials.mockResolvedValue(OIDC);
    const notFound = response(404, { code: "RESOURCE_NOT_FOUND" });
    fetchMock.mockResolvedValue(notFound);

    await expect(requestApi("/api/x/1", { fallback: "失败" })).resolves.toBe(
      notFound,
    );
    expect(session.handleUnauthorized).not.toHaveBeenCalled();
    expect(session.confirmAuthorized).toHaveBeenCalledTimes(1);
  });

  it("原样发送 FormData，不擅自加 JSON Content-Type，并注入会话身份", async () => {
    session.credentials.mockResolvedValue(DEVELOPMENT);
    const form = new FormData();
    form.append("file", "x");

    await requestApi("/api/import-batches", {
      method: "POST",
      headers: { "Idempotency-Key": "import:sha256:1" },
      body: form,
      fallback: "上传失败",
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/import-batches", {
      method: "POST",
      redirect: "error",
      headers: {
        "Idempotency-Key": "import:sha256:1",
        "X-Tenant-Id": "tenant-dev",
        "X-Operator-Id": "operator-dev",
        "X-Roles": "operations_dispatcher,review_supervisor",
      },
      body: form,
    });
  });

  it("401 同样触发一次会话恢复并报 unauthorized", async () => {
    session.credentials.mockResolvedValue(OIDC);
    fetchMock.mockResolvedValue(response(401, ""));

    await expect(
      requestApi("/api/x", { fallback: "标准模板下载失败" }),
    ).rejects.toMatchObject({ kind: "unauthorized", status: 401 });
    expect(session.handleUnauthorized).toHaveBeenCalledTimes(1);
    expect(session.confirmAuthorized).not.toHaveBeenCalled();
  });

  it("越界 URL 与受保护头在取身份前即被拒绝", async () => {
    await expect(
      requestApi("https://evil.example/api/x", { fallback: "失败" }),
    ).rejects.toThrow("API_URL_REJECTED");
    await expect(
      requestApi("/api/x", {
        headers: { "X-Roles": "admin" },
        fallback: "失败",
      }),
    ).rejects.toThrow("PROTECTED_HEADER_OVERRIDE");
    expect(session.credentials).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("调用方主动取消时原样抛出 AbortError，不包装成网络故障", async () => {
    session.credentials.mockResolvedValue(DEVELOPMENT);
    const controller = new AbortController();
    const abort = new DOMException("aborted", "AbortError");
    fetchMock.mockImplementation(async () => {
      controller.abort();
      throw abort;
    });

    await expect(
      requestJson("/api/x", { fallback: "失败", signal: controller.signal }),
    ).rejects.toBe(abort);
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });
});
