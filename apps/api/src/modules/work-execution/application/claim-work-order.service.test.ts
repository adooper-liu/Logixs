import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { hashClaimRequest } from "../domain/client-operation";
import { WORK_CLIENT_OPERATION_REPOSITORY } from "../domain/client-operation.repository";
import type { NodeTaskWithWorkOrders } from "../domain/work-execution.repository";
import { WORK_EXECUTION_REPOSITORY } from "../domain/work-execution.repository";
import { ClaimWorkOrderService } from "./claim-work-order.service";

const ASSERT_CONTAINER_TENANT = Symbol.for("logix.AssertContainerTenant");

function readyBundle(
  overrides: Partial<NodeTaskWithWorkOrders["workOrders"][number]> = {},
): NodeTaskWithWorkOrders {
  return {
    task: {
      id: "t1",
      tenantId: "t1",
      flowInstanceId: "f1",
      nodeInstanceId: "n1",
      nodeCode: "customs_clearance",
      containerId: "c1",
      taskDefinitionKey: "node-customs_clearance",
      state: "pending",
      applicability: "required",
      readinessState: "ready",
      completionEligibility: "awaiting_evidence",
      conditionFactRefs: [],
      version: 0,
      createdAt: new Date("2026-09-13T10:00:00Z"),
    },
    workOrders: [
      {
        id: "w1",
        nodeTaskId: "t1",
        workOrderDefinitionKey: "wo-customs_clearance",
        state: "ready",
        applicability: "required",
        assignmentState: "unassigned",
        assigneeId: null,
        dueAt: null,
        completedAt: null,
        version: 0,
        createdAt: new Date("2026-09-13T10:00:00Z"),
        ...overrides,
      },
    ],
    outcome: null,
  };
}

function command() {
  return {
    workOrderId: "w1",
    tenantId: "t1",
    actorId: "op-1",
  };
}

async function buildService(
  repository: Record<string, ReturnType<typeof vi.fn>>,
  operations?: Record<string, ReturnType<typeof vi.fn>>,
  assertContainerTenant = vi.fn().mockResolvedValue(undefined),
) {
  const clientOperations = operations ?? {
    findByIdempotency: vi.fn().mockResolvedValue(null),
    insert: vi.fn().mockResolvedValue(undefined),
  };
  const module = await Test.createTestingModule({
    providers: [
      ClaimWorkOrderService,
      { provide: WORK_EXECUTION_REPOSITORY, useValue: repository },
      {
        provide: WORK_CLIENT_OPERATION_REPOSITORY,
        useValue: clientOperations,
      },
      {
        provide: ASSERT_CONTAINER_TENANT,
        useValue: { execute: assertContainerTenant },
      },
    ],
  }).compile();
  return {
    service: module.get(ClaimWorkOrderService),
    operations: clientOperations,
    assertContainerTenant,
  };
}

function containerlessBundle(): NodeTaskWithWorkOrders {
  const bundle = readyBundle();
  return { ...bundle, task: { ...bundle.task, containerId: null } };
}

describe("ClaimWorkOrderService", () => {
  it("ready 未分派领取后 assigned + in_progress，并记下领取人", async () => {
    const bundle = readyBundle();
    const repository = {
      findWorkOrderInTenant: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskInTenant: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderClaim: vi.fn().mockResolvedValue({ kind: "applied" }),
    };
    const { service } = await buildService(repository);

    const result = await service.execute(command());

    expect(result).toMatchObject({
      workOrderId: "w1",
      workOrderState: "in_progress",
      assignmentState: "assigned",
      assigneeId: "op-1",
      taskState: "in_progress",
      applied: true,
      receptionState: "received",
      businessDecisionState: "accepted",
      commitState: "committed",
    });
    expect(repository.applyWorkOrderClaim).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        workOrderId: "w1",
        taskId: "t1",
        workOrderState: "in_progress",
        assignmentState: "assigned",
        assigneeId: "op-1",
        taskState: "in_progress",
        clientOperation: expect.objectContaining({
          actionCode: "work_execution.claim_work_order",
          commitState: "committed",
        }),
      }),
    );
  });

  it("自己已领不改库，写 committed 回执", async () => {
    const bundle = readyBundle({
      state: "in_progress",
      assignmentState: "assigned",
      assigneeId: "op-1",
    });
    const repository = {
      findWorkOrderInTenant: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskInTenant: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderClaim: vi.fn(),
    };
    const { service, operations } = await buildService(repository);

    const result = await service.execute(command());

    expect(result.applied).toBe(false);
    expect(result.assigneeId).toBe("op-1");
    expect(result.commitState).toBe("committed");
    expect(repository.applyWorkOrderClaim).not.toHaveBeenCalled();
    expect(operations.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actionCode: "work_execution.claim_work_order",
        commitState: "committed",
      }),
    );
  });

  it("他人已领拒绝", async () => {
    const bundle = readyBundle({
      state: "in_progress",
      assignmentState: "assigned",
      assigneeId: "op-2",
    });
    const repository = {
      findWorkOrderInTenant: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskInTenant: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderClaim: vi.fn(),
    };
    const { service, operations } = await buildService(repository);

    await expect(service.execute(command())).rejects.toThrow(
      "BUSINESS_STATE_VIOLATION",
    );
    expect(repository.applyWorkOrderClaim).not.toHaveBeenCalled();
    expect(operations.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        businessDecisionState: "rejected",
        rejectionReasonCode: "BUSINESS_STATE_VIOLATION",
      }),
    );
  });

  it("条件更新失败且他人已领则拒绝", async () => {
    const bundle = readyBundle();
    const taken = {
      ...bundle.workOrders[0],
      state: "in_progress" as const,
      assignmentState: "assigned" as const,
      assigneeId: "op-2",
    };
    const repository = {
      findWorkOrderInTenant: vi
        .fn()
        .mockResolvedValueOnce(bundle.workOrders[0])
        .mockResolvedValueOnce(taken),
      findTaskInTenant: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderClaim: vi
        .fn()
        .mockResolvedValue({ kind: "state_conflict" }),
    };
    const { service } = await buildService(repository);

    await expect(service.execute(command())).rejects.toThrow(
      "工单已被他人领取",
    );
  });

  it("事务内租户或父链不命中表现为不存在，不重读也不落操作回执", async () => {
    const bundle = readyBundle();
    const repository = {
      findWorkOrderInTenant: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskInTenant: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderClaim: vi
        .fn()
        .mockResolvedValue({ kind: "scope_mismatch" }),
    };
    const { service, operations } = await buildService(repository);

    const error = await service.execute(command()).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundException);
    expect(repository.findWorkOrderInTenant).toHaveBeenCalledTimes(1);
    expect(operations.insert).not.toHaveBeenCalled();
  });

  it("同键同哈希复用，不重复领取", async () => {
    const bundle = readyBundle({
      state: "in_progress",
      assignmentState: "assigned",
      assigneeId: "op-1",
    });
    const repository = {
      findWorkOrderInTenant: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskInTenant: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderClaim: vi.fn(),
    };
    const { service, operations } = await buildService(repository, {
      findByIdempotency: vi.fn().mockResolvedValue({
        id: "op-existing",
        tenantId: "t1",
        actorType: "user",
        actorId: "op-1",
        actionCode: "work_execution.claim_work_order",
        actionVersion: 1,
        targetType: "work_order",
        targetId: "w1",
        targetOwnerModule: "work-execution",
        correlationId: "corr",
        causationId: null,
        traceId: "trace",
        idempotencyKey: "work-order:w1:claim",
        requestHash: hashClaimRequest({ workOrderId: "w1" }),
        receptionState: "received",
        businessDecisionState: "accepted",
        commitState: "committed",
        resultRefs: [],
        rejectionReasonCode: null,
        attemptCount: 1,
        receivedAt: new Date(),
        decidedAt: new Date(),
        committedAt: new Date(),
      }),
      insert: vi.fn(),
    });

    const result = await service.execute(command());
    expect(result.applied).toBe(false);
    expect(result.clientOperationId).toBe("op-existing");
    expect(result.assigneeId).toBe("op-1");
    expect(repository.applyWorkOrderClaim).not.toHaveBeenCalled();
    expect(operations.insert).not.toHaveBeenCalled();
  });

  it("同键异哈希冲突", async () => {
    const repository = {
      findWorkOrderInTenant: vi.fn(),
      findTaskInTenant: vi.fn(),
      applyWorkOrderClaim: vi.fn(),
    };
    const { service } = await buildService(repository, {
      findByIdempotency: vi.fn().mockResolvedValue({
        id: "op-existing",
        requestHash: "c".repeat(64),
        targetId: "w1",
      }),
      insert: vi.fn(),
    });
    await expect(service.execute(command())).rejects.toThrow(
      "IDEMPOTENCY_CONFLICT",
    );
    expect(repository.applyWorkOrderClaim).not.toHaveBeenCalled();
  });

  it("同租户无柜任务可领取，读取从 Repository 起限定租户", async () => {
    const bundle = containerlessBundle();
    const repository = {
      findWorkOrderInTenant: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskInTenant: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderClaim: vi.fn().mockResolvedValue({ kind: "applied" }),
    };
    const { service, assertContainerTenant } = await buildService(repository);

    const result = await service.execute(command());

    expect(result).toMatchObject({ applied: true, taskState: "in_progress" });
    expect(repository.findWorkOrderInTenant).toHaveBeenCalledWith({
      workOrderId: "w1",
      tenantId: "t1",
    });
    expect(repository.findTaskInTenant).toHaveBeenCalledWith({
      taskId: "t1",
      tenantId: "t1",
    });
    expect(assertContainerTenant).not.toHaveBeenCalled();
  });

  it("跨租户无柜工单表现为不存在，零业务写入与零操作回执", async () => {
    const repository = {
      findWorkOrderInTenant: vi.fn().mockResolvedValue(null),
      findTaskInTenant: vi.fn(),
      applyWorkOrderClaim: vi.fn(),
    };
    const { service, operations } = await buildService(repository);

    const error = await service.execute(command()).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).message).toBe("RESOURCE_NOT_FOUND");
    expect(repository.findTaskInTenant).not.toHaveBeenCalled();
    expect(repository.applyWorkOrderClaim).not.toHaveBeenCalled();
    expect(operations.insert).not.toHaveBeenCalled();
  });

  it("任务在当前租户不可见时同样表现为不存在且不写入", async () => {
    const bundle = containerlessBundle();
    const repository = {
      findWorkOrderInTenant: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskInTenant: vi.fn().mockResolvedValue(null),
      applyWorkOrderClaim: vi.fn(),
    };
    const { service, operations } = await buildService(repository);

    await expect(service.execute(command())).rejects.toThrow(NotFoundException);
    expect(repository.applyWorkOrderClaim).not.toHaveBeenCalled();
    expect(operations.insert).not.toHaveBeenCalled();
  });

  it("带柜任务保留父货柜租户断言", async () => {
    const bundle = readyBundle();
    const repository = {
      findWorkOrderInTenant: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskInTenant: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderClaim: vi.fn().mockResolvedValue({ kind: "applied" }),
    };
    const { service, assertContainerTenant } = await buildService(repository);

    await service.execute(command());

    expect(assertContainerTenant).toHaveBeenCalledWith({
      containerId: "c1",
      tenantId: "t1",
    });
  });

  it("幂等重放读取同样限定租户，不可见时不回显对象", async () => {
    const repository = {
      findWorkOrderInTenant: vi.fn().mockResolvedValue(null),
      findTaskInTenant: vi.fn(),
      applyWorkOrderClaim: vi.fn(),
    };
    const { service, operations } = await buildService(repository, {
      findByIdempotency: vi.fn().mockResolvedValue({
        id: "op-existing",
        requestHash: hashClaimRequest({ workOrderId: "w1" }),
        targetId: "w1",
      }),
      insert: vi.fn(),
    });

    await expect(service.execute(command())).rejects.toThrow(
      "RESOURCE_NOT_FOUND",
    );
    expect(repository.findWorkOrderInTenant).toHaveBeenCalledWith({
      workOrderId: "w1",
      tenantId: "t1",
    });
    expect(repository.applyWorkOrderClaim).not.toHaveBeenCalled();
    expect(operations.insert).not.toHaveBeenCalled();
  });
});
