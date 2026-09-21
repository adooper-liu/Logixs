import { describe, expect, it } from "vitest";
import type { CanonicalEventCode, LifecycleNodeCode } from "@logix/contracts";
import type { FlowWithNodes } from "./lifecycle.repository";
import { projectLifecycleNodes } from "./lifecycle-nodes";

function fact(
  nodeCode: LifecycleNodeCode,
  eventCode: CanonicalEventCode,
  timeKind: "planned" | "estimated" | "actual",
  occurredAt: string,
  overrides: Partial<{
    verificationState: "pending" | "verified" | "rejected";
    confidenceState: "unknown" | "provisional" | "confirmed" | "disputed";
    validity: "effective" | "superseded" | "revoked";
    authorityPolicyRef: string | null;
    applicationState:
      | "not_applicable"
      | "review_required"
      | "pending_application"
      | "applied"
      | "rejected";
  }> = {},
) {
  return {
    nodeCode,
    eventCode,
    timeKind,
    occurredAt: new Date(occurredAt),
    verificationState: overrides.verificationState ?? "verified",
    confidenceState: overrides.confidenceState ?? "confirmed",
    validity: overrides.validity ?? "effective",
    authorityPolicyRef:
      overrides.authorityPolicyRef ??
      (timeKind === "actual" ? "policy:v1" : null),
    applicationState:
      overrides.applicationState ??
      (timeKind === "actual" ? "applied" : "not_applicable"),
  } as const;
}

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

  it("三轨槽位常驻，无事实时显式留空", () => {
    const node = projectLifecycleNodes(flow).nodes[0];

    expect(node?.times).toEqual({
      plannedAt: null,
      estimatedAt: null,
      actualAt: null,
    });
  });

  it("同一节点的三种时间各归各轨", () => {
    const view = projectLifecycleNodes(flow, {
      facts: [
        fact("cargo_ready", "cargo_ready", "planned", "2026-09-01T01:00:00Z"),
        fact("cargo_ready", "cargo_ready", "estimated", "2026-09-01T02:00:00Z"),
        fact("cargo_ready", "cargo_ready", "actual", "2026-09-01T03:00:00Z"),
      ],
    });

    expect(view.nodes[0]?.times).toEqual({
      plannedAt: new Date("2026-09-01T01:00:00Z"),
      estimatedAt: new Date("2026-09-01T02:00:00Z"),
      actualAt: new Date("2026-09-01T03:00:00Z"),
    });
  });

  it("不适用节点与日期留空是两种呈现", () => {
    const notApplicable = structuredClone(flow);
    notApplicable.nodes[0]!.applicability = "optional_not_applicable";

    const node = projectLifecycleNodes(notApplicable).nodes.find(
      (candidate) => candidate.nodeCode === "shipment_dispatch",
    );

    expect(node?.applicability).toBe("optional_not_applicable");
    expect(node?.times.actualAt).toBeNull();
  });

  it("子里程碑、未确认及 review_required actual 不进入节点完成摘要", () => {
    const view = projectLifecycleNodes(flow, {
      facts: [
        fact("shipment_dispatch", "gate_in", "actual", "2026-09-03T01:00:00Z"),
        fact("shipment_dispatch", "loaded", "actual", "2026-09-03T02:00:00Z", {
          verificationState: "pending",
          confidenceState: "unknown",
        }),
        fact("shipment_dispatch", "loaded", "actual", "2026-09-03T04:00:00Z", {
          applicationState: "review_required",
        }),
      ],
    });

    expect(
      view.nodes.find((node) => node.nodeCode === "shipment_dispatch")?.times,
    ).toEqual({ plannedAt: null, estimatedAt: null, actualAt: null });
  });

  it("来源已采信但过站被拒绝的 actual 仍作为事实展示", () => {
    const occurredAt = new Date("2026-09-03T03:00:00Z");
    const view = projectLifecycleNodes(flow, {
      facts: [
        fact(
          "shipment_dispatch",
          "loaded",
          "actual",
          occurredAt.toISOString(),
          {
            applicationState: "rejected",
          },
        ),
      ],
    });

    expect(
      view.nodes.find((node) => node.nodeCode === "shipment_dispatch")?.times
        .actualAt,
    ).toEqual(occurredAt);
  });

  it("按事件完成目标投影跨节点事实，不把默认归属当唯一目标", () => {
    const arrivalFlow = structuredClone(flow);
    arrivalFlow.nodes = [
      {
        id: "n-ocean",
        nodeCode: "ocean_transit",
        state: "active",
        completedAt: null,
        applicability: "required",
      },
      {
        id: "n-arrival",
        nodeCode: "destination_arrival",
        state: "pending",
        completedAt: null,
        applicability: "required",
      },
    ];
    arrivalFlow.flow.currentNodeCode = "ocean_transit";
    const occurredAt = new Date("2026-09-09T03:00:00Z");

    const view = projectLifecycleNodes(arrivalFlow, {
      facts: [
        fact(
          "destination_arrival",
          "arrived",
          "actual",
          occurredAt.toISOString(),
        ),
      ],
    });

    expect(
      view.nodes.find((node) => node.nodeCode === "ocean_transit")?.times
        .actualAt,
    ).toEqual(occurredAt);
    expect(
      view.nodes.find((node) => node.nodeCode === "destination_arrival")?.times
        .actualAt,
    ).toEqual(occurredAt);
  });

  it("同槽存在多个完成候选时留空，不按时间猜测", () => {
    const deliveryFlow = structuredClone(flow);
    deliveryFlow.nodes = [
      {
        id: "n-delivery",
        nodeCode: "warehouse_delivery",
        state: "active",
        completedAt: null,
        applicability: "required",
      },
    ];
    deliveryFlow.flow.currentNodeCode = "warehouse_delivery";

    const view = projectLifecycleNodes(deliveryFlow, {
      facts: [
        fact(
          "warehouse_delivery",
          "delivered",
          "estimated",
          "2026-09-10T02:00:00Z",
        ),
        fact(
          "warehouse_delivery",
          "warehouse_arrival",
          "estimated",
          "2026-09-10T01:00:00Z",
        ),
      ],
    });

    expect(view.nodes[0]?.times.estimatedAt).toBeNull();
  });
});
