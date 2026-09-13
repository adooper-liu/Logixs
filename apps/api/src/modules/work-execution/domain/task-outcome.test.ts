import { describe, expect, it } from "vitest";
import {
  decideTaskOutcome,
  firstSlicePolicySnapshotHash,
  policySnapshotHash,
  resultPolicyForNode,
} from "./task-outcome";

describe("resultPolicyForNode", () => {
  it("装箱申请 stuffed，出运申请 loaded，离港申请 departed，清关为 none", () => {
    expect(resultPolicyForNode("container_stuffing")).toEqual({
      mode: "emit_canonical_event",
      eventCode: "stuffed",
    });
    expect(resultPolicyForNode("shipment_dispatch")).toEqual({
      mode: "emit_canonical_event",
      eventCode: "loaded",
    });
    expect(resultPolicyForNode("origin_departure")).toEqual({
      mode: "emit_canonical_event",
      eventCode: "departed",
    });
    expect(resultPolicyForNode("ocean_transit")).toEqual({
      mode: "none",
      eventCode: null,
    });
    expect(resultPolicyForNode("customs_clearance")).toEqual({
      mode: "none",
      eventCode: null,
    });
  });
});

describe("decideTaskOutcome", () => {
  it("装箱任务首次完成后带 emit 政策", () => {
    const outcome = decideTaskOutcome({
      previousState: "pending",
      nextState: "completed",
      nodeCode: "container_stuffing",
      workOrders: [{ id: "w1", state: "completed" }],
    });

    expect(outcome).toEqual({
      previousState: "pending",
      nextState: "completed",
      resultPolicyMode: "emit_canonical_event",
      eventCode: "stuffed",
      policySnapshotHash: policySnapshotHash("emit_canonical_event"),
      requiredWorkOrderIds: ["w1"],
      completedWorkOrderIds: ["w1"],
    });
  });

  it("出运任务首次完成后带 loaded", () => {
    expect(
      decideTaskOutcome({
        previousState: "pending",
        nextState: "completed",
        nodeCode: "shipment_dispatch",
        workOrders: [{ id: "w1", state: "completed" }],
      }),
    ).toMatchObject({
      resultPolicyMode: "emit_canonical_event",
      eventCode: "loaded",
    });
  });

  it("离港任务首次完成后带 departed", () => {
    expect(
      decideTaskOutcome({
        previousState: "pending",
        nextState: "completed",
        nodeCode: "origin_departure",
        workOrders: [{ id: "w1", state: "completed" }],
      }),
    ).toMatchObject({
      resultPolicyMode: "emit_canonical_event",
      eventCode: "departed",
    });
  });

  it("清关任务完成后仍是 none，不带事件码", () => {
    expect(
      decideTaskOutcome({
        previousState: "pending",
        nextState: "completed",
        nodeCode: "customs_clearance",
        workOrders: [{ id: "w1", state: "completed" }],
      }),
    ).toMatchObject({
      resultPolicyMode: "none",
      eventCode: null,
      policySnapshotHash: firstSlicePolicySnapshotHash(),
    });
  });

  it("部分完成不记结果", () => {
    expect(
      decideTaskOutcome({
        previousState: "pending",
        nextState: "in_progress",
        nodeCode: "container_stuffing",
        workOrders: [
          { id: "w1", state: "completed" },
          { id: "w2", state: "ready" },
        ],
      }),
    ).toBeNull();
  });

  it("已完成重放不重复记结果", () => {
    expect(
      decideTaskOutcome({
        previousState: "completed",
        nextState: "completed",
        nodeCode: "container_stuffing",
        workOrders: [{ id: "w1", state: "completed" }],
      }),
    ).toBeNull();
  });
});
