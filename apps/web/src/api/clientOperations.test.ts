import { afterEach, describe, expect, it, vi } from "vitest";
import { listClientOperations, listCompensations } from "./clientOperations";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listClientOperations", () => {
  it("带开发期身份与游标查询，并丢掉 requestHash", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            clientOperationId: "op-1",
            actionCode: "lifecycle.apply_event",
            receptionState: "received",
            businessDecisionState: "accepted",
            commitState: "committed",
            rejectionReasonCode: null,
            resultRefs: [],
            requestHash: "secret-hash",
            traceId: "trace-1",
            targetType: "container",
            targetId: "c1",
            createdAt: "2026-09-13T03:00:00.000Z",
          },
        ],
        pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 50 },
        asOf: "2026-09-13T03:00:00.000Z",
        projectionVersion: 0,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const page = await listClientOperations({ pageSize: 50, cursor: "c1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/client-operations?pageSize=50&cursor=c1",
      {
        headers: {
          "X-Tenant-Id": "dev-tenant",
          "X-Operator-Id": "dev-operator",
        },
      },
    );
    expect(page.items[0]).toMatchObject({
      clientOperationId: "op-1",
      targetId: "c1",
    });
    expect(page.items[0]).not.toHaveProperty("requestHash");
  });
});

describe("listCompensations", () => {
  it("按原操作查询补偿", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 50 },
        asOf: "2026-09-13T03:00:00.000Z",
        projectionVersion: 0,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await listCompensations("op-1", { pageSize: 50 });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/client-operations/op-1/compensations?pageSize=50",
      {
        headers: {
          "X-Tenant-Id": "dev-tenant",
          "X-Operator-Id": "dev-operator",
        },
      },
    );
  });
});
