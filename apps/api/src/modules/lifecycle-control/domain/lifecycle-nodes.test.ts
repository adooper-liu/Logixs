import { describe, expect, it } from "vitest";
import type { FlowWithNodes } from "./lifecycle.repository";
import { projectLifecycleNodes } from "./lifecycle-nodes";

const flow: FlowWithNodes = {
  flow: {
    id: "f1",
    containerId: "c1",
    state: "active",
    currentNodeCode: "shipment_dispatch",
    version: 2,
  },
  nodes: [
    {
      id: "n-dispatch",
      nodeCode: "shipment_dispatch",
      state: "active",
      completedAt: null,
      applicability: "required",
    },
    {
      id: "n-ready",
      nodeCode: "cargo_ready",
      state: "completed",
      completedAt: new Date("2026-09-01T00:00:00.000Z"),
      applicability: "required",
    },
    {
      id: "n-stuff",
      nodeCode: "container_stuffing",
      state: "completed",
      completedAt: new Date("2026-09-02T00:00:00.000Z"),
      applicability: "required",
    },
  ],
};

describe("projectLifecycleNodes", () => {
  it("无流程不编造节点", () => {
    expect(projectLifecycleNodes(null)).toEqual({ flow: null, nodes: [] });
  });

  it("只投影已落库节点并按目录顺序排列", () => {
    const view = projectLifecycleNodes(flow);
    expect(view.flow).toEqual({
      id: "f1",
      state: "active",
      currentNodeCode: "shipment_dispatch",
      version: 2,
    });
    expect(view.nodes.map((node) => node.nodeCode)).toEqual([
      "cargo_ready",
      "container_stuffing",
      "shipment_dispatch",
    ]);
    expect(view.nodes.map((node) => node.sequence)).toEqual([1, 2, 3]);
    expect(view.nodes.find((node) => node.isCurrent)?.nodeCode).toBe(
      "shipment_dispatch",
    );
    expect(view.nodes).toHaveLength(3);
  });

  it("投影未解除阻断的稳定引用", () => {
    const blocked = structuredClone(flow);
    const current = blocked.nodes.find(
      (node) => node.nodeCode === blocked.flow.currentNodeCode,
    )!;
    current.state = "blocked";
    current.blockedReasonRefs = ["block-1", "block-2"];

    expect(
      projectLifecycleNodes(blocked).nodes.find((node) => node.isCurrent)
        ?.blockedReasonRefs,
    ).toEqual(["block-1", "block-2"]);
  });
});
