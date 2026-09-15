import { describe, expect, it } from "vitest";
import { toLiveNode } from "./liveNodeProjection";

describe("toLiveNode", () => {
  it("用人话节点名和状态，不编造完成时间", () => {
    const view = toLiveNode({
      nodeInstanceId: "n1",
      nodeCode: "cargo_ready",
      sequence: 1,
      state: "active",
      applicability: "required",
      completedAt: null,
      isCurrent: true,
    });
    expect(view.name).toBe("备货");
    expect(view.stateLabel).toBe("进行中");
    expect(view.completedAt).toBeNull();
    expect(view.isCurrent).toBe(true);
  });

  it("不适用节点不假装还在推进", () => {
    const view = toLiveNode({
      nodeInstanceId: "n2",
      nodeCode: "transshipment",
      sequence: 6,
      state: "pending",
      applicability: "optional_not_applicable",
      completedAt: null,
      isCurrent: false,
    });
    expect(view.name).toBe("中转港");
    expect(view.stateLabel).toBe("不适用");
  });
});
