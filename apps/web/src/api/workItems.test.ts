import { afterEach, describe, expect, it, vi } from "vitest";
import { listExternalWorkItems } from "./workItems";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listExternalWorkItems", () => {
  it("按货柜读取开放整改项并声明任务读取角色", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
        asOf: "2026-09-21T00:00:00.000Z",
        projectionVersion: 1,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await listExternalWorkItems({ containerId: "c1", pageSize: 100 });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/work-items?containerId=c1&pageSize=100",
      {
        headers: {
          "X-Tenant-Id": "demo-real-sample-20260921",
          "X-Operator-Id": "dev-operator",
          "X-Roles": "field_operator",
        },
      },
    );
  });
});
