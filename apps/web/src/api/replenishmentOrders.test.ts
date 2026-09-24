import { afterEach, describe, expect, it, vi } from "vitest";
import { listReplenishmentOrders } from "./replenishmentOrders";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listReplenishmentOrders", () => {
  it("uses the tenant-scoped paginated endpoint", async () => {
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

    await listReplenishmentOrders({ pageSize: 100, cursor: "cursor-1" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/replenishment-orders?pageSize=100&cursor=cursor-1",
      {
        headers: {
          "X-Tenant-Id": "demo-real-sample-20260921",
          "X-Operator-Id": "dev-operator",
          "X-Roles": "operations_dispatcher",
        },
      },
    );
  });

  it("reports a failed response instead of returning an empty page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    );

    await expect(listReplenishmentOrders()).rejects.toThrow(
      "GET /api/replenishment-orders failed: 503",
    );
  });
});
