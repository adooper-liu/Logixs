import { effectScope, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NodeTaskDetail } from "../api/nodeTasks";
import { useCargoReadyTaskOperation } from "./useCargoReadyTaskOperation";

const claimWorkOrder = vi.fn();
const completeWorkOrder = vi.fn();

vi.mock("../api/nodeTasks", () => ({
  claimWorkOrder: (...args: unknown[]) => claimWorkOrder(...args),
  completeWorkOrder: (...args: unknown[]) => completeWorkOrder(...args),
}));

describe("useCargoReadyTaskOperation", () => {
  beforeEach(() => {
    claimWorkOrder.mockReset();
    completeWorkOrder.mockReset();
  });

  it("claims the backend-provided work order and reloads committed facts", async () => {
    claimWorkOrder.mockResolvedValue(claimResult());
    const reload = vi.fn().mockResolvedValue(undefined);
    const scope = effectScope();
    const operation = scope.run(() =>
      useCargoReadyTaskOperation(
        ref(task("work_execution.claim_work_order")),
        reload,
      ),
    )!;

    await operation.execute();

    expect(claimWorkOrder).toHaveBeenCalledWith(
      "work-order-1",
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );
    expect(operation.submission.value?.stage).toBe("committed");
    expect(reload).toHaveBeenCalledOnce();
    scope.stop();
  });

  it("reuses the original idempotency key after a recoverable failure", async () => {
    claimWorkOrder
      .mockRejectedValueOnce(new Error("网络暂时不可用"))
      .mockResolvedValueOnce(claimResult());
    const scope = effectScope();
    const operation = scope.run(() =>
      useCargoReadyTaskOperation(
        ref(task("work_execution.claim_work_order")),
        vi.fn().mockResolvedValue(undefined),
      ),
    )!;

    await operation.execute();
    const firstKey = claimWorkOrder.mock.calls[0]?.[1].idempotencyKey;
    expect(operation.submission.value?.canRetry).toBe(true);

    await operation.retry();

    expect(claimWorkOrder.mock.calls[1]?.[1].idempotencyKey).toBe(firstKey);
    scope.stop();
  });

  it("completes cargo-ready work without collecting unsupported free text", async () => {
    completeWorkOrder.mockResolvedValue(completeResult());
    const scope = effectScope();
    const operation = scope.run(() =>
      useCargoReadyTaskOperation(
        ref(task("work_execution.complete_work_order")),
        vi.fn().mockResolvedValue(undefined),
      ),
    )!;
    await operation.execute();

    expect(completeWorkOrder).toHaveBeenCalledWith(
      "work-order-1",
      expect.objectContaining({ evidenceRefs: [] }),
    );
    scope.stop();
  });
});

function task(actionCode: string): NodeTaskDetail {
  return {
    id: "task-1",
    flowInstanceId: "flow-1",
    nodeInstanceId: "node-1",
    nodeCode: "cargo_ready",
    containerId: "container-1",
    taskDefinitionKey: "node-cargo_ready",
    state: "pending",
    applicability: "required",
    readinessState: "ready",
    completionEligibility: "eligible",
    conditionFactRefs: [],
    workOrders: [],
    outcome: null,
    nextAction: {
      actionCode,
      workOrderId: "work-order-1",
      workOrderDefinitionKey: "wo-cargo_ready",
      assignmentState: "pool",
      assigneeId: null,
      dueAt: null,
    },
  };
}

function claimResult() {
  return {
    workOrderId: "work-order-1",
    workOrderState: "in_progress",
    assignmentState: "assigned",
    assigneeId: "dev-operator",
    taskId: "task-1",
    taskState: "in_progress",
    applied: true,
    clientOperationId: "operation-1",
    receptionState: "received",
    businessDecisionState: "accepted",
    commitState: "committed",
    rejectionReasonCode: null,
  };
}

function completeResult() {
  return {
    workOrderId: "work-order-1",
    workOrderState: "completed",
    taskId: "task-1",
    taskState: "completed",
    applied: true,
    outcomeRecorded: true,
    lifecycleApply: "not_requested",
    lifecycleEventCode: null,
    lifecycleDetail: null,
    activatedNodeCode: null,
    activatedNodeTaskId: null,
    clientOperationId: "operation-2",
    receptionState: "received",
    businessDecisionState: "accepted",
    commitState: "committed",
    rejectionReasonCode: null,
  };
}
