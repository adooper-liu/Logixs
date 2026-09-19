import { describe, expect, it } from "vitest";
import { decideNodeEventApplication } from "./node-event-application";

function node(
  nodeCode: "cargo_ready" | "container_stuffing" | "shipment_dispatch",
  state: string,
  overrides: {
    applicability?: "required" | "optional_not_applicable";
    completedAt?: Date | null;
  } = {},
) {
  return {
    nodeCode,
    state,
    applicability: overrides.applicability ?? ("required" as const),
    completedAt: overrides.completedAt ?? null,
  };
}

describe("decideNodeEventApplication", () => {
  it("必经前序未完成时等待，不允许越站", () => {
    const decision = decideNodeEventApplication({
      targetNodeCode: "container_stuffing",
      occurredAt: new Date("2026-09-18T10:00:00Z"),
      nodes: [
        node("cargo_ready", "active"),
        node("container_stuffing", "pending"),
      ],
    });

    expect(decision).toMatchObject({
      kind: "pending_application",
      reasonCode: "LIFECYCLE_EVENT_PENDING_PREDECESSOR",
    });
  });

  it("明确不适用的可选前序可以跳过", () => {
    const decision = decideNodeEventApplication({
      targetNodeCode: "shipment_dispatch",
      occurredAt: new Date("2026-09-18T10:00:00Z"),
      nodes: [
        node("cargo_ready", "completed", {
          completedAt: new Date("2026-09-18T08:00:00Z"),
        }),
        node("container_stuffing", "pending", {
          applicability: "optional_not_applicable",
        }),
        node("shipment_dispatch", "pending"),
      ],
    });

    expect(decision.kind).toBe("apply");
  });

  it("目标节点被阻断时保留待应用，不允许过站", () => {
    const decision = decideNodeEventApplication({
      targetNodeCode: "container_stuffing",
      occurredAt: new Date("2026-09-18T10:00:00Z"),
      nodes: [
        node("cargo_ready", "completed", {
          completedAt: new Date("2026-09-18T08:00:00Z"),
        }),
        node("container_stuffing", "blocked"),
      ],
    });

    expect(decision).toEqual({
      kind: "pending_application",
      guardResults: ["TARGET_NODE_FOUND", "TARGET_NODE_APPLICABLE"],
      reasonCode: "LIFECYCLE_EVENT_PENDING_NODE_BLOCK",
    });
  });

  it("前序实际时间晚于目标事件时拒绝", () => {
    const decision = decideNodeEventApplication({
      targetNodeCode: "container_stuffing",
      occurredAt: new Date("2026-09-18T09:00:00Z"),
      nodes: [
        node("cargo_ready", "completed", {
          completedAt: new Date("2026-09-18T10:00:00Z"),
        }),
        node("container_stuffing", "active"),
      ],
    });

    expect(decision).toMatchObject({
      kind: "rejected",
      reasonCode: "LIFECYCLE_TIME_ORDER_CONFLICT",
    });
  });
});
