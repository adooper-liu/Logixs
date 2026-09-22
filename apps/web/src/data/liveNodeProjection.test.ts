import { describe, expect, it } from "vitest";
import { toLiveNode } from "./liveNodeProjection";

const base = {
  nodeInstanceId: "n1",
  nodeCode: "cargo_ready",
  sequence: 1,
  state: "active",
  applicability: "required",
  completedAt: null,
  blockedReasonRefs: [],
  isCurrent: true,
  times: { plannedAt: null, estimatedAt: null, actualAt: null },
};

describe("toLiveNode", () => {
  it("用人话节点名和状态，不编造完成时间", () => {
    const view = toLiveNode(base);
    expect(view.name).toBe("备货");
    expect(view.stateLabel).toBe("进行中");
    expect(view.completedAt).toBeNull();
    expect(view.isCurrent).toBe(true);
  });

  it("三轨无数据时保持 null，不用占位值", () => {
    expect(toLiveNode(base).times).toEqual({
      plannedAt: null,
      estimatedAt: null,
      actualAt: null,
    });
  });

  it("未关闭阻断计数来自稳定阻断引用", () => {
    expect(
      toLiveNode({ ...base, blockedReasonRefs: ["b1", "b2"] }).blockedCount,
    ).toBe(2);
  });

  it("不适用节点不假装还在推进", () => {
    const view = toLiveNode({
      ...base,
      nodeInstanceId: "n2",
      nodeCode: "transshipment",
      sequence: 6,
      state: "pending",
      applicability: "optional_not_applicable",
      isCurrent: false,
    });
    expect(view.name).toBe("中转港");
    expect(view.stateLabel).toBe("不适用");
    expect(view.isNotApplicable).toBe(true);
    expect(view.times.actualAt).toBeNull();
  });
});
