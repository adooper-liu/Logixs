import { afterEach, describe, expect, it, vi } from "vitest";
import { listCurrentNodes } from "./lifecycleCurrentNodes";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listCurrentNodes", () => {
  it("按货柜 ID 批量查询并带开发期身份", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [],
        asOf: "2026-09-13T00:00:00.000Z",
        projectionVersion: 0,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await listCurrentNodes(["c1", "c2"]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/lifecycle-current-nodes?containerIds=c1%2Cc2",
      {
        headers: {
          "X-Tenant-Id": "demo-real-sample-20260921",
          "X-Operator-Id": "dev-operator",
        },
      },
    );
  });
});
