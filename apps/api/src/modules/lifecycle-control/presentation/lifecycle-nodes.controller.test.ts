import { describe, expect, it, vi } from "vitest";
import { LifecycleNodesController } from "./lifecycle-nodes.controller";

describe("LifecycleNodesController", () => {
  it("把节点三轨日期序列化为 ISO 8601 并保留空槽", async () => {
    const actualAt = new Date("2026-09-21T01:02:03.000Z");
    const execute = vi.fn().mockResolvedValue({
      flow: {
        id: "flow-1",
        state: "active",
        currentNodeCode: "cargo_ready",
        version: 1,
      },
      nodes: [
        {
          nodeInstanceId: "node-1",
          nodeCode: "cargo_ready",
          sequence: 1,
          state: "active",
          applicability: "required",
          completedAt: null,
          blockedReasonRefs: [],
          isCurrent: true,
          times: { plannedAt: null, estimatedAt: null, actualAt },
        },
      ],
      asOf: new Date("2026-09-21T02:00:00.000Z"),
      projectionVersion: 2,
    });
    const controller = new LifecycleNodesController({ execute } as never);

    const result = await controller.list("container-1", {
      identity: { tenantId: "tenant-1" },
    });

    expect(execute).toHaveBeenCalledWith({
      containerId: "container-1",
      tenantId: "tenant-1",
    });
    expect(result.nodes[0]?.times).toEqual({
      plannedAt: null,
      estimatedAt: null,
      actualAt: "2026-09-21T01:02:03.000Z",
    });
  });
});
