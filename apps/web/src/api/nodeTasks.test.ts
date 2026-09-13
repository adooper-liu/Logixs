import { afterEach, describe, expect, it, vi } from "vitest";
import { completeWorkOrder, listNodeTasks } from "./nodeTasks";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listNodeTasks", () => {
  it("带开发期身份与货柜过滤", async () => {
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
    await listNodeTasks({ containerId: "c1", pageSize: 50, cursor: "cur-1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/node-tasks?containerId=c1&pageSize=50&cursor=cur-1",
      {
        headers: {
          "X-Tenant-Id": "dev-tenant",
          "X-Operator-Id": "dev-operator",
        },
      },
    );
  });

  it("不带货柜时按租户列", async () => {
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
    await listNodeTasks({ pageSize: 50 });
    expect(fetchMock).toHaveBeenCalledWith("/api/node-tasks?pageSize=50", {
      headers: {
        "X-Tenant-Id": "dev-tenant",
        "X-Operator-Id": "dev-operator",
      },
    });
  });
});

describe("completeWorkOrder", () => {
  it("提交证据引用和幂等键，不带载荷正文", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        workOrderId: "w1",
        workOrderState: "completed",
        taskId: "t1",
        taskState: "completed",
        applied: true,
        outcomeRecorded: true,
        lifecycleApply: "not_applicable",
        lifecycleEventCode: null,
        lifecycleDetail: null,
        activatedNodeCode: null,
        activatedNodeTaskId: null,
        clientOperationId: "op-1",
        receptionState: "received",
        businessDecisionState: "accepted",
        commitState: "committed",
        rejectionReasonCode: null,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await completeWorkOrder("w1", {
      evidenceRefs: ["11111111-1111-4111-8111-111111111111"],
      idempotencyKey: "complete-1",
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/work-orders/w1/complete");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      evidenceRefs: ["11111111-1111-4111-8111-111111111111"],
      idempotencyKey: "complete-1",
    });
    expect(String(init.body)).not.toContain("payload");
    expect(String(init.body)).not.toContain("service-key");
  });
});
