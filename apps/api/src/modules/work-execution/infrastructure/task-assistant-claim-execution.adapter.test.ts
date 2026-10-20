import { describe, expect, it, vi } from "vitest";
import { hashClaimRequest } from "../domain/client-operation";
import { TaskAssistantClaimExecutionAdapter } from "./task-assistant-claim-execution.adapter";

const taskId = "10000000-0000-4000-8000-000000000001";
const workOrderId = "20000000-0000-4000-8000-000000000001";
const operationId = "30000000-0000-4000-8000-000000000001";

describe("TaskAssistantClaimExecutionAdapter trace receipt", () => {
  it("returns the persisted ClientOperation trace for claim and replay", async () => {
    const operation = {
      id: operationId,
      targetId: workOrderId,
      requestHash: hashClaimRequest({ workOrderId }),
      traceId: "official-operation-trace",
      receptionState: "received",
      businessDecisionState: "accepted",
      commitState: "committed",
      rejectionReasonCode: null,
    };
    const repository = {
      findWorkOrderInTenant: vi.fn().mockResolvedValue({
        id: workOrderId,
        nodeTaskId: taskId,
        state: "in_progress",
        assignmentState: "assigned",
        assigneeId: "actor-a",
      }),
      findTaskInTenant: vi.fn().mockResolvedValue({
        task: { id: taskId, state: "in_progress" },
      }),
    };
    const operations = {
      findByIdempotency: vi.fn().mockResolvedValue(operation),
    };
    const claimWorkOrder = {
      execute: vi.fn().mockResolvedValue({
        workOrderId,
        workOrderState: "in_progress",
        assignmentState: "assigned",
        assigneeId: "actor-a",
        taskId,
        taskState: "in_progress",
        applied: true,
        clientOperationId: operationId,
        receptionState: "received",
        businessDecisionState: "accepted",
        commitState: "committed",
        rejectionReasonCode: null,
      }),
    };
    const adapter = new TaskAssistantClaimExecutionAdapter(
      repository as never,
      operations as never,
      claimWorkOrder as never,
    );
    const input = {
      tenantId: "tenant-a",
      actorId: "actor-a",
      workOrderId,
      idempotencyKey: "confirm-1",
      traceId: "new-request-trace",
    };

    await expect(adapter.claim(input)).resolves.toMatchObject({
      clientOperationId: operationId,
      traceId: "official-operation-trace",
    });
    await expect(adapter.findClaimReceipt(input)).resolves.toMatchObject({
      clientOperationId: operationId,
      traceId: "official-operation-trace",
    });
  });
});
