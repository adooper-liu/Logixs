import type { LifecycleNodeCode } from "@logix/contracts";
import lifecycleNodes from "@logix/contracts/lifecycle-nodes.json";
import { describe, expect, it } from "vitest";
import { completionModeOf } from "./node-completion-mode";

describe("completionModeOf", () => {
  it("14 站全部读取目录中的明确完成模式", () => {
    expect(lifecycleNodes).toHaveLength(14);
    for (const node of lifecycleNodes) {
      expect(completionModeOf(node.nodeCode)).toBe(node.completionMode);
    }
  });

  it("一期 14 站均为事实驱动", () => {
    expect(
      lifecycleNodes.map((node) => completionModeOf(node.nodeCode)),
    ).toEqual(Array.from({ length: 14 }, () => "fact_driven"));
  });

  it("目录外节点明确失败，不使用静默默认值", () => {
    expect(() => completionModeOf("unknown" as LifecycleNodeCode)).toThrow(
      "LIFECYCLE_NODE_COMPLETION_MODE_UNDEFINED:unknown",
    );
  });
});
