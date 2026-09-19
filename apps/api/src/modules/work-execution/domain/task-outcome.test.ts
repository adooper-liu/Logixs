import { describe, expect, it } from "vitest";
import {
  decideTaskOutcome,
  firstSlicePolicySnapshotHash,
  policySnapshotHash,
  resultPolicyForNode,
} from "./task-outcome";

describe("resultPolicyForNode", () => {
  it("所有节点工单完成都不直接申请规范事件", () => {
    expect(resultPolicyForNode("container_stuffing")).toEqual({
      mode: "none",
      eventCode: null,
    });
    expect(resultPolicyForNode("shipment_dispatch")).toEqual({
      mode: "none",
      eventCode: null,
    });
    expect(resultPolicyForNode("origin_departure")).toEqual({
      mode: "none",
      eventCode: null,
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
  it("装箱任务首次完成只记录工作结果，不带规范事件", () => {
    const outcome = decideTaskOutcome({
      previousState: "pending",
      nextState: "completed",
      nodeCode: "container_stuffing",
      workOrders: [{ id: "w1", state: "completed" }],
    });

    expect(outcome).toEqual({
      previousState: "pending",
      nextState: "completed",
      resultPolicyMode: "none",
      eventCode: null,
      policySnapshotHash: policySnapshotHash("none"),
      requiredWorkOrderIds: ["w1"],
      completedWorkOrderIds: ["w1"],
    });
  });

  it("出运任务首次完成不带 loaded", () => {
    expect(
      decideTaskOutcome({
        previousState: "pending",
        nextState: "completed",
        nodeCode: "shipment_dispatch",
        workOrders: [{ id: "w1", state: "completed" }],
      }),
    ).toMatchObject({
      resultPolicyMode: "none",
      eventCode: null,
    });
  });

  it("离港任务首次完成不带 departed", () => {
    expect(
      decideTaskOutcome({
        previousState: "pending",
        nextState: "completed",
        nodeCode: "origin_departure",
        workOrders: [{ id: "w1", state: "completed" }],
      }),
    ).toMatchObject({
      resultPolicyMode: "none",
      eventCode: null,
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
