import { afterEach, describe, expect, it, vi } from "vitest";
import { getContainer, getContainerCargo, listContainers } from "./containers";

const SESSION_HEADERS = {
  "X-Tenant-Id": "demo-real-sample-20260921",
  "X-Operator-Id": "dev-operator",
  "X-Roles": "operations_dispatcher",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listContainers", () => {
  it("默认不带查询参数", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 50 },
        asOf: "2026-09-13T00:00:00.000Z",
        projectionVersion: 0,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await listContainers();
    expect(fetchMock).toHaveBeenCalledWith("/api/containers", {
      method: "GET",
      redirect: "error",
      headers: SESSION_HEADERS,
    });
  });

  it("带页大小与游标", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 200 },
        asOf: "2026-09-13T00:00:00.000Z",
        projectionVersion: 0,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await listContainers({ pageSize: 200, cursor: "cur-1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/containers?pageSize=200&cursor=cur-1",
      { method: "GET", redirect: "error", headers: SESSION_HEADERS },
    );
  });
});

describe("getContainer", () => {
  it("按 id 读取并带开发期身份", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "c1",
        orderNumber: "SO-1",
        containerNumber: "MSKU1",
        currentStatus: "in_transit",
        updatedAt: "2026-09-13T00:00:00.000Z",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const row = await getContainer("c1");
    expect(fetchMock).toHaveBeenCalledWith("/api/containers/c1", {
      method: "GET",
      redirect: "error",
      headers: SESSION_HEADERS,
    });
    expect(row.orderNumber).toBe("SO-1");
  });

  it("404 映射为 RESOURCE_NOT_FOUND", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    );
    await expect(getContainer("missing")).rejects.toThrow("RESOURCE_NOT_FOUND");
  });
});

describe("getContainerCargo", () => {
  it("按货柜读取活动装载 SKU 投影", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        containerRecordId: "c1",
        allocationSetId: "a1",
        allocationSetVersion: 2,
        items: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getContainerCargo("c1");

    expect(fetchMock).toHaveBeenCalledWith("/api/containers/c1/cargo", {
      method: "GET",
      redirect: "error",
      headers: SESSION_HEADERS,
    });
  });
});
