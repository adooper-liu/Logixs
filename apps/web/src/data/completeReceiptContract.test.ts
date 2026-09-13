import { describe, expect, it } from "vitest";
import type { CompleteWorkOrderResult } from "../api/nodeTasks";
import {
  canCompleteWorkOrder,
  extractErrorCode,
  parseEvidenceInput,
  toCompleteSubmission,
  toFailedSubmission,
  toSendingSubmission,
} from "./completeReceiptContract";

function committed(
  overrides: Partial<CompleteWorkOrderResult> = {},
): CompleteWorkOrderResult {
  return {
    workOrderId: "w1",
    workOrderState: "completed",
    taskId: "t1",
    taskState: "completed",
    applied: true,
    outcomeRecorded: true,
    lifecycleApply: "not_applicable",
    lifecycleEventCode: null,
    lifecycleDetail: null,
    activatedNodeCode: null,
    activatedNodeTaskId: null,
    clientOperationId: "op-1",
    receptionState: "received",
    businessDecisionState: "accepted",
    commitState: "committed",
    rejectionReasonCode: null,
    ...overrides,
  };
}

describe("completeReceiptContract", () => {
  it("只允许可完成工单状态点完成", () => {
    expect(canCompleteWorkOrder("ready")).toBe(true);
    expect(canCompleteWorkOrder("in_progress")).toBe(true);
    expect(canCompleteWorkOrder("completed")).toBe(false);
    expect(canCompleteWorkOrder("cancelled")).toBe(false);
  });

  it("解析证据输入并去重", () => {
    expect(parseEvidenceInput("  a , a  b\nc ")).toEqual(["a", "b", "c"]);
  });

  it("同事务成功直接显示已落账并保留三段时间", () => {
    const view = toCompleteSubmission({
      taskId: "t1",
      observedAt: "09:07:00",
      result: committed({ lifecycleEventCode: "stuffed" }),
    });
    expect(view.stage).toBe("committed");
    expect(view.message).toBe("已落账");
    expect(view.receivedAt).toBe("09:07:00");
    expect(view.acceptedAt).toBe("09:07:00");
    expect(view.committedAt).toBe("09:07:00");
    expect(view.resultEventCode).toBe("stuffed");
    expect(view.clientOperationId).toBe("op-1");
  });

  it("业务拒绝不标完成、不可用原编号重试", () => {
    const view = toCompleteSubmission({
      taskId: "t1",
      observedAt: "09:07:00",
      result: committed({
        commitState: "pending",
        businessDecisionState: "rejected",
        rejectionReasonCode: "EVIDENCE_REQUIRED",
      }),
    });
    expect(view.stage).toBe("rejected");
    expect(view.errorCode).toBe("EVIDENCE_REQUIRED");
    expect(view.canRetry).toBe(false);
    expect(view.committedAt).toBeUndefined();
  });

  it("网络失败可原编号重试，业务码不可", () => {
    expect(
      toFailedSubmission({
        taskId: "t1",
        message: "Failed to fetch",
      }).canRetry,
    ).toBe(true);
    expect(
      toFailedSubmission({
        taskId: "t1",
        message: "完成工单失败（409）：EVIDENCE_REQUIRED: 缺少合格证据",
      }),
    ).toMatchObject({
      stage: "rejected",
      errorCode: "EVIDENCE_REQUIRED",
      canRetry: false,
    });
    expect(extractErrorCode("完成工单失败（500）")).toBe("REQUEST_FAILED");
  });

  it("发送中只占第一段", () => {
    expect(toSendingSubmission("t1")).toMatchObject({
      taskId: "t1",
      stage: "sending",
    });
  });
});
