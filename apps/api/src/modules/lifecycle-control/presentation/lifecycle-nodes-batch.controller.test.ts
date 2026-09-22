import { describe, expect, it, vi } from "vitest";
import { LifecycleNodesBatchController } from "./lifecycle-nodes-batch.controller";

describe("LifecycleNodesBatchController", () => {
  it("批量响应同样序列化每柜节点三轨", async () => {
    const estimatedAt = new Date("2026-09-22T01:02:03.000Z");
    const execute = vi.fn().mockResolvedValue({
      items: [
        {
          containerId: "container-1",
          flow: null,
          nodes: [
            {
              nodeInstanceId: "node-1",
              nodeCode: "destination_arrival",
              sequence: 8,
              state: "pending",
              applicability: "required",
              completedAt: null,
              blockedReasonRefs: [],
              isCurrent: false,
              times: { plannedAt: null, estimatedAt, actualAt: null },
            },
          ],
        },
      ],
      asOf: new Date("2026-09-21T02:00:00.000Z"),
      projectionVersion: 2,
    });
    const controller = new LifecycleNodesBatchController({ execute } as never);

    const result = await controller.list(
      { identity: { tenantId: "tenant-1" } },
      "container-1",
    );

    expect(execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      containerIds: "container-1",
    });
    expect(result.items[0]?.nodes[0]?.times).toEqual({
      plannedAt: null,
      estimatedAt: "2026-09-22T01:02:03.000Z",
      actualAt: null,
    });
  });
});
