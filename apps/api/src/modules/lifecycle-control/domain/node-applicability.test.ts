import { describe, expect, it } from "vitest";
import {
  decideSetNodeApplicability,
  defaultApplicability,
  isOptionalNode,
  nextApplicableNode,
} from "./node-applicability";

describe("node applicability", () => {
  it("只有中转和海铁是 optional", () => {
    expect(isOptionalNode("transshipment")).toBe(true);
    expect(isOptionalNode("rail_transfer")).toBe(true);
    expect(isOptionalNode("ocean_transit")).toBe(false);
    expect(defaultApplicability("transshipment")).toBe("optional_applicable");
    expect(defaultApplicability("ocean_transit")).toBe("required");
  });

  it("跳过 N/A 的中转，落到清关", () => {
    expect(
      nextApplicableNode("ocean_transit", (node) =>
        node === "transshipment"
          ? "optional_not_applicable"
          : defaultApplicability(node),
      ),
    ).toBe("customs_clearance");
  });

  it("未标 N/A 时下一节点仍是中转", () => {
    expect(nextApplicableNode("ocean_transit", defaultApplicability)).toBe(
      "transshipment",
    );
  });

  it("required 节点不得改适用性", () => {
    expect(
      decideSetNodeApplicability({
        nodeCode: "ocean_transit",
        nodeState: null,
        laterNodes: [],
      }),
    ).toMatchObject({ kind: "reject", code: "BUSINESS_STATE_VIOLATION" });
  });

  it("已完成的可选节点拒绝", () => {
    expect(
      decideSetNodeApplicability({
        nodeCode: "transshipment",
        nodeState: "completed",
        laterNodes: [],
      }),
    ).toMatchObject({ kind: "reject" });
  });

  it("后序已推进时拒绝", () => {
    expect(
      decideSetNodeApplicability({
        nodeCode: "transshipment",
        nodeState: "pending",
        laterNodes: [{ nodeCode: "customs_clearance", state: "completed" }],
      }),
    ).toMatchObject({ kind: "reject" });
  });

  it("未激活且后序未推进时允许", () => {
    expect(
      decideSetNodeApplicability({
        nodeCode: "transshipment",
        nodeState: "pending",
        laterNodes: [],
      }),
    ).toEqual({ kind: "apply" });
  });
});
