import { describe, expect, it } from "vitest";
import { nextLifecycleNode } from "./node-status";

describe("nextLifecycleNode", () => {
  it("装箱之后是出运", () => {
    expect(nextLifecycleNode("container_stuffing")).toBe("shipment_dispatch");
  });

  it("离港之后是海运在途", () => {
    expect(nextLifecycleNode("origin_departure")).toBe("ocean_transit");
  });

  it("还箱之后没有下一节点", () => {
    expect(nextLifecycleNode("empty_return")).toBeNull();
  });
});
