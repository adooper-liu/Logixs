import { describe, expect, it } from "vitest";
import {
  canClaimWorkOrder,
  isAssignedTo,
  toClaimSubmission,
} from "./claimReceiptContract";

describe("claimReceiptContract", () => {
  it("只允许未分派且可开工状态领取", () => {
    expect(
      canClaimWorkOrder({ state: "ready", assignmentState: "unassigned" }),
    ).toBe(true);
    expect(canClaimWorkOrder({ state: "ready", assignmentState: "pool" })).toBe(
      true,
    );
    expect(
      canClaimWorkOrder({ state: "ready", assignmentState: "automatic" }),
    ).toBe(false);
    expect(
      canClaimWorkOrder({ state: "completed", assignmentState: "unassigned" }),
    ).toBe(false);
    expect(
      canClaimWorkOrder({ state: "ready", assignmentState: "assigned" }),
    ).toBe(false);
  });

  it("只认当前操作者自己的领取", () => {
    expect(isAssignedTo("dev-operator", "dev-operator")).toBe(true);
    expect(isAssignedTo("other", "dev-operator")).toBe(false);
    expect(isAssignedTo(null, "dev-operator")).toBe(false);
  });

  it("领取落账显示已领取", () => {
    const view = toClaimSubmission({
      taskId: "t1",
      observedAt: "09:07:00",
      result: {
        workOrderId: "w1",
        workOrderState: "in_progress",
        assignmentState: "assigned",
        assigneeId: "dev-operator",
        taskId: "t1",
        taskState: "in_progress",
        applied: true,
        clientOperationId: "op-1",
        receptionState: "received",
        businessDecisionState: "accepted",
        commitState: "committed",
        rejectionReasonCode: null,
      },
    });
    expect(view).toMatchObject({
      stage: "committed",
      message: "已领取",
      clientOperationId: "op-1",
    });
  });
});
