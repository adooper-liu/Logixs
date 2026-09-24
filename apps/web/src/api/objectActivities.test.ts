import { afterEach, describe, expect, it, vi } from "vitest";
import { listObjectActivities } from "./objectActivities";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listObjectActivities", () => {
  it("编码对象 id、透传快照游标并带开发期角色", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [],
        nextActions: [],
        pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 25 },
        asOf: "2026-09-18T00:00:00.000Z",
        projectionVersion: 1,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await listObjectActivities("container/一", {
      pageSize: 25,
      cursor: "snapshot+1",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/containers/container%2F%E4%B8%80/activities?pageSize=25&cursor=snapshot%2B1",
      {
        headers: {
          "X-Tenant-Id": "demo-real-sample-20260921",
          "X-Operator-Id": "dev-operator",
          "X-Roles": "operations_dispatcher",
        },
      },
    );
  });

  it("把无权或不存在统一收敛为 RESOURCE_NOT_FOUND", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    );
    await expect(listObjectActivities("missing")).rejects.toThrow(
      "RESOURCE_NOT_FOUND",
    );
  });
});
