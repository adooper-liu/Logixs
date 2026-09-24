import { afterEach, describe, expect, it, vi } from "vitest";
import { listLifecycleEvents } from "./lifecycleEvents";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listLifecycleEvents", () => {
  it("按货柜列事件并带开发期身份", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [],
        pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 50 },
        asOf: "2026-09-13T00:00:00.000Z",
        projectionVersion: 0,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await listLifecycleEvents("c1", { pageSize: 50 });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/containers/c1/lifecycle-events?pageSize=50",
      {
        headers: {
          "X-Tenant-Id": "demo-real-sample-20260921",
          "X-Operator-Id": "dev-operator",
        },
      },
    );
  });

  it("404 映射为 RESOURCE_NOT_FOUND", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    );
    await expect(listLifecycleEvents("missing")).rejects.toThrow(
      "RESOURCE_NOT_FOUND",
    );
  });
});
