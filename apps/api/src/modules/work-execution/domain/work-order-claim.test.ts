import { describe, expect, it } from "vitest";
import { decideWorkOrderClaim } from "./work-order-claim";

describe("decideWorkOrderClaim", () => {
  it("ready 未分派可以领取", () => {
    expect(
      decideWorkOrderClaim({
        state: "ready",
        assignmentState: "unassigned",
        assigneeId: null,
        actorId: "op-1",
      }),
    ).toEqual({
      kind: "apply",
      nextState: "in_progress",
      assignmentState: "assigned",
    });
  });

  it("pool 可以领取", () => {
    expect(
      decideWorkOrderClaim({
        state: "ready",
        assignmentState: "pool",
        assigneeId: null,
        actorId: "op-1",
      }).kind,
    ).toBe("apply");
  });

  it("自己已领则重放", () => {
    expect(
      decideWorkOrderClaim({
        state: "in_progress",
        assignmentState: "assigned",
        assigneeId: "op-1",
        actorId: "op-1",
      }),
    ).toEqual({ kind: "already_done" });
  });

  it("他人已领拒绝", () => {
    const decision = decideWorkOrderClaim({
      state: "in_progress",
      assignmentState: "assigned",
      assigneeId: "op-2",
      actorId: "op-1",
    });
    expect(decision).toMatchObject({
      kind: "reject",
      code: "BUSINESS_STATE_VIOLATION",
    });
  });

  it("自动工单不能领", () => {
    const decision = decideWorkOrderClaim({
      state: "ready",
      assignmentState: "automatic",
      assigneeId: null,
      actorId: "op-1",
    });
    expect(decision).toMatchObject({
      kind: "reject",
      code: "BUSINESS_STATE_VIOLATION",
    });
  });

  it("已完成不能领", () => {
    const decision = decideWorkOrderClaim({
      state: "completed",
      assignmentState: "unassigned",
      assigneeId: null,
      actorId: "op-1",
    });
    expect(decision.kind).toBe("reject");
  });
});
