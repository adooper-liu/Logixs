import { describe, expect, it } from "vitest";
import type { ClientOperationItem } from "../api/clientOperations";
import {
  assertOperationRowSafe,
  attachLatestSync,
  toCompensationRow,
  toContainerSyncStatus,
  toOperationRow,
} from "./clientOperationQueueContract";
import { toLiveContainer } from "./liveWorkspaceProjection";

function operation(
  overrides: Partial<ClientOperationItem> = {},
): ClientOperationItem {
  return {
    clientOperationId: "op-1",
    actionCode: "work_execution.complete_work_order",
    receptionState: "received",
    businessDecisionState: "accepted",
    commitState: "committed",
    rejectionReasonCode: null,
    resultRefs: [],
    traceId: "trace-1",
    targetType: "container",
    targetId: "c1",
    createdAt: "2026-09-13T03:00:00.000Z",
    ...overrides,
  };
}

describe("clientOperationQueueContract", () => {
  it("三阶段分列且不带 requestHash", () => {
    const row = toOperationRow({
      clientOperationId: "op-1",
      actionCode: "work_execution.complete_work_order",
      receptionState: "received",
      businessDecisionState: "accepted",
      commitState: "committed",
      rejectionReasonCode: null,
      resultRefs: [],
      traceId: "trace-1",
      targetType: "container",
      targetId: "c1",
      createdAt: "2026-09-13T03:00:00.000Z",
    });
    expect(row.actionLabel).toBe("完成工单");
    expect(
      toOperationRow({
        ...operation(),
        actionCode: "work_execution.claim_work_order",
      }).actionLabel,
    ).toBe("领取");
    expect(row.receptionLabel).toBe("已接收");
    expect(row.decisionLabel).toBe("已确认");
    expect(row.commitLabel).toBe("已入账");
    expect(row).not.toHaveProperty("requestHash");
    expect(() => assertOperationRowSafe(row)).not.toThrow();
  });

  it("补偿状态用登记文案", () => {
    const row = toCompensationRow({
      compensationId: "cmp-1",
      originalClientOperationId: "op-1",
      compensationActionCode: "lifecycle.compensate_apply_event",
      state: "pending",
      reasonCode: "manual_compensate",
      requestedBy: "actor-1",
      resultRefs: [],
      createdAt: "2026-09-13T03:00:00.000Z",
      updatedAt: "2026-09-13T03:00:00.000Z",
      traceId: "trace-1",
    });
    expect(row.actionLabel).toBe("需修正");
    expect(row.stateLabel).toBe("待处理");
  });

  it("落账列只回答记没记下，不合成假总状态", () => {
    expect(toContainerSyncStatus(operation()).label).toBe("已入账");
    expect(
      toContainerSyncStatus(
        operation({ commitState: "pending", receptionState: "received" }),
      ).label,
    ).toBe("已接收，待入账");
    expect(
      toContainerSyncStatus(
        operation({
          commitState: "pending",
          businessDecisionState: "rejected",
        }),
      ).label,
    ).toBe("已拒绝");
    expect(
      toContainerSyncStatus(operation({ commitState: "commit_failed" })).label,
    ).toBe("入账失败");
  });

  it("只把列表里最新一条挂到对应货柜", () => {
    const rows = attachLatestSync(
      [
        toLiveContainer({
          id: "c1",
          orderNumber: "PO-1",
          containerNumber: "MSCU1",
          currentStatus: "in_transit",
          updatedAt: "2026-09-13T03:00:00.000Z",
        }),
        toLiveContainer({
          id: "c2",
          orderNumber: "PO-2",
          containerNumber: "MSCU2",
          currentStatus: "shipped",
          updatedAt: "2026-09-13T03:00:00.000Z",
        }),
      ],
      [
        operation({
          clientOperationId: "newer",
          commitState: "pending",
          receptionState: "received",
        }),
        operation({
          clientOperationId: "older",
          commitState: "committed",
        }),
        operation({
          clientOperationId: "other-ref",
          targetType: "work_order",
          targetId: "w1",
          resultRefs: [{ entityType: "container", entityId: "c2" }],
          commitState: "commit_failed",
        }),
      ],
    );
    expect(rows[0]?.syncStatus.label).toBe("已接收，待入账");
    expect(rows[1]?.syncStatus.label).toBe("入账失败");
    expect(
      attachLatestSync(
        [
          toLiveContainer({
            id: "c1",
            orderNumber: "PO-1",
            containerNumber: "MSCU1",
            currentStatus: "in_transit",
            updatedAt: "2026-09-13T03:00:00.000Z",
          }),
        ],
        [],
      )[0]?.syncStatus.code,
    ).toBe("idle");
  });

  it("工单完成没有柜引用时，用已拉到的任务挂回去", () => {
    const rows = attachLatestSync(
      [
        toLiveContainer({
          id: "c1",
          orderNumber: "PO-1",
          containerNumber: "MSCU1",
          currentStatus: "in_transit",
          updatedAt: "2026-09-13T03:00:00.000Z",
        }),
      ],
      [
        operation({
          targetType: "work_order",
          targetId: "w1",
          resultRefs: [
            { entityType: "work_order", entityId: "w1" },
            { entityType: "node_task", entityId: "t1" },
          ],
        }),
      ],
      [{ containerId: "c1", taskId: "t1", workOrderIds: ["w1"] }],
    );
    expect(rows[0]?.syncStatus.label).toBe("已入账");
    expect(
      attachLatestSync(
        [
          toLiveContainer({
            id: "c1",
            orderNumber: "PO-1",
            containerNumber: "MSCU1",
            currentStatus: "in_transit",
            updatedAt: "2026-09-13T03:00:00.000Z",
          }),
        ],
        [
          operation({
            targetType: "work_order",
            targetId: "w1",
            resultRefs: [
              { entityType: "work_order", entityId: "w1" },
              { entityType: "node_task", entityId: "t1" },
            ],
          }),
        ],
      )[0]?.syncStatus.code,
    ).toBe("idle");
  });
});
