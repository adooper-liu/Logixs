import { describe, expect, it } from "vitest";
import { decideNodeSpecializedGuard } from "./node-specialized-guard";

describe("decideNodeSpecializedGuard", () => {
  it("箱号未迟绑定时保留 stuffed 待应用", () => {
    expect(
      decideNodeSpecializedGuard({
        targetNodeCode: "container_stuffing",
        eventCode: "stuffed",
        containerNumber: null,
      }),
    ).toEqual({
      kind: "pending_application",
      guardResults: [],
      reasonCode: "LIFECYCLE_EVENT_PENDING_CONTAINER_IDENTITY",
    });
  });

  it("箱号已绑定时允许 stuffed 继续执行通用过站事务", () => {
    expect(
      decideNodeSpecializedGuard({
        targetNodeCode: "container_stuffing",
        eventCode: "stuffed",
        containerNumber: " MSKU1234567 ",
      }),
    ).toEqual({
      kind: "apply",
      guardResults: ["CONTAINER_IDENTITY_BOUND"],
    });
  });

  it("不替其他节点臆造专项条件", () => {
    expect(
      decideNodeSpecializedGuard({
        targetNodeCode: "shipment_dispatch",
        eventCode: "loaded",
        containerNumber: null,
      }),
    ).toEqual({ kind: "apply", guardResults: [] });
  });
});
