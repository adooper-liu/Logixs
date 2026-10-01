import { HttpException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import type { NodeTaskWithWorkOrders } from "../domain/work-execution.repository";
import { hashCompleteRequest } from "../domain/client-operation";
import { WORK_CLIENT_OPERATION_REPOSITORY } from "../domain/client-operation.repository";
import { WORK_EXECUTION_REPOSITORY } from "../domain/work-execution.repository";
import { CompleteWorkOrderService } from "./complete-work-order.service";
const ASSERT_CONTAINER_TENANT = Symbol.for("logix.AssertContainerTenant");

const EVIDENCE = "22222222-2222-4222-8222-222222222222";
const APPLIED = { kind: "applied" } as const;
const VERSION_CONFLICT = { kind: "version_conflict" } as const;

function readyBundle(
  overrides: Partial<NodeTaskWithWorkOrders["task"]> = {},
): NodeTaskWithWorkOrders {
  return {
    task: {
      id: "t1",
      tenantId: overrides.tenantId ?? "t1",
      flowInstanceId: "f1",
      nodeInstanceId: "n1",
      nodeCode: "customs_clearance",
      containerId: "c1",
      taskDefinitionKey: "node-customs_clearance",
      state: "pending",
      createdAt: new Date("2026-09-12T10:00:00Z"),
      ...overrides,
      applicability: overrides.applicability ?? "required",
      readinessState: overrides.readinessState ?? "ready",
      completionEligibility:
        overrides.completionEligibility ?? "awaiting_evidence",
      conditionFactRefs: overrides.conditionFactRefs ?? [],
      version: overrides.version ?? 0,
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
        createdAt: new Date("2026-09-12T10:00:00Z"),
      },
    ],
    outcome: null,
  };
}

function command(evidenceRefs: string[] = []) {
  return {
    workOrderId: "w1",
    tenantId: "t1",
    actorId: "op-1",
    evidenceRefs,
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
      CompleteWorkOrderService,
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
    service: module.get(CompleteWorkOrderService),
    operations: clientOperations,
    assertContainerTenant,
  };
}

describe("CompleteWorkOrderService", () => {
  it("清关工单完成后不申请生命周期事件", async () => {
    const bundle = readyBundle();
    const repository = {
      findWorkOrderInTenant: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskInTenant: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderCompletion: vi.fn().mockResolvedValue(APPLIED),
    };
    const { service } = await buildService(repository);

    const result = await service.execute(command());

    expect(result).toMatchObject({
      taskState: "completed",
      outcomeRecorded: true,
      lifecycleApply: "not_applicable",
      lifecycleEventCode: null,
      activatedNodeCode: null,
      activatedNodeTaskId: null,
      receptionState: "received",
      businessDecisionState: "accepted",
      commitState: "committed",
    });
    expect(result.clientOperationId).toBeTruthy();
    expect(repository.applyWorkOrderCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        clientOperation: expect.objectContaining({
          actionCode: "work_execution.complete_work_order",
          commitState: "committed",
          resultRefs: [
            { entityType: "work_order", entityId: "w1" },
            { entityType: "node_task", entityId: "t1" },
            { entityType: "container", entityId: "c1" },
          ],
        }),
      }),
    );
  });

  it("optional 工单未完成不阻断 required 工单聚合任务完成", async () => {
    const bundle = readyBundle();
    bundle.workOrders.push({
      ...bundle.workOrders[0],
      id: "w-optional",
      applicability: "optional",
    });
    const repository = {
      findWorkOrderInTenant: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskInTenant: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderCompletion: vi.fn().mockResolvedValue(APPLIED),
    };
    const { service } = await buildService(repository);

    await expect(service.execute(command())).resolves.toMatchObject({
      taskState: "completed",
      outcomeRecorded: true,
    });
    expect(repository.applyWorkOrderCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ taskState: "completed" }),
    );
  });

  it("装箱工单完成不等于 stuffed，也不申请生命周期事件", async () => {
    const bundle = readyBundle({
      nodeCode: "container_stuffing",
      taskDefinitionKey: "node-container_stuffing",
    });
    const repository = {
      findWorkOrderInTenant: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskInTenant: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderCompletion: vi.fn().mockResolvedValue(APPLIED),
    };
    const { service } = await buildService(repository);

    const result = await service.execute(command([EVIDENCE]));

    expect(result.lifecycleApply).toBe("not_applicable");
    expect(result.lifecycleEventCode).toBeNull();
    expect(result.activatedNodeCode).toBeNull();
    expect(result.activatedNodeTaskId).toBeNull();
    expect(repository.applyWorkOrderCompletion).toHaveBeenCalled();
  });

  it("出运工单完成不等于 loaded", async () => {
    const bundle = readyBundle({
      nodeCode: "shipment_dispatch",
      taskDefinitionKey: "node-shipment_dispatch",
    });
    const repository = {
      findWorkOrderInTenant: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskInTenant: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderCompletion: vi.fn().mockResolvedValue(APPLIED),
    };
    const { service } = await buildService(repository);

    const result = await service.execute(command([EVIDENCE]));

    expect(result.lifecycleApply).toBe("not_applicable");
    expect(result.lifecycleEventCode).toBeNull();
  });

  it("离港工单完成不等于 departed", async () => {
    const bundle = readyBundle({
      nodeCode: "origin_departure",
      taskDefinitionKey: "node-origin_departure",
    });
    const repository = {
      findWorkOrderInTenant: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskInTenant: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderCompletion: vi.fn().mockResolvedValue(APPLIED),
    };
    const { service } = await buildService(repository);

    const result = await service.execute(command([EVIDENCE]));

    expect(result.lifecycleApply).toBe("not_applicable");
    expect(result.lifecycleEventCode).toBeNull();
  });

  it("缺 containerId 时本地工单仍完成且不涉及生命周期", async () => {
    const bundle = readyBundle({
      nodeCode: "container_stuffing",
      containerId: null,
    });
    const repository = {
      findWorkOrderInTenant: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskInTenant: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderCompletion: vi.fn().mockResolvedValue(APPLIED),
    };
    const { service } = await buildService(repository);

    const result = await service.execute(command());

    expect(result.taskState).toBe("completed");
    expect(result.lifecycleApply).toBe("not_applicable");
    expect(result.activatedNodeCode).toBeNull();
    expect(result.activatedNodeTaskId).toBeNull();
  });

  it("已完成工单重放不重复记结果，也不触发生命周期", async () => {
    const bundle = readyBundle({
      nodeCode: "container_stuffing",
      state: "completed",
    });
    bundle.workOrders[0].state = "completed";
    const repository = {
      findWorkOrderInTenant: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskInTenant: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderCompletion: vi.fn(),
    };
    const { service } = await buildService(repository);

    const result = await service.execute(command([EVIDENCE]));

    expect(result.applied).toBe(false);
    expect(result.lifecycleApply).toBe("not_applicable");
    expect(result.commitState).toBe("committed");
    expect(result.activatedNodeCode).toBeNull();
    expect(result.activatedNodeTaskId).toBeNull();
    expect(repository.applyWorkOrderCompletion).not.toHaveBeenCalled();
  });

  it("工单完成不借用生命周期证据门槛", async () => {
    const bundle = readyBundle({ nodeCode: "container_stuffing" });
    const repository = {
      findWorkOrderInTenant: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskInTenant: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderCompletion: vi.fn().mockResolvedValue(APPLIED),
    };
    const { service, operations } = await buildService(repository);

    await expect(service.execute(command())).resolves.toMatchObject({
      taskState: "completed",
      lifecycleApply: "not_applicable",
    });
    expect(repository.applyWorkOrderCompletion).toHaveBeenCalled();
    expect(operations.insert).not.toHaveBeenCalled();
  });

  it("cancelled 工单完成被拒绝", async () => {
    const bundle = readyBundle();
    bundle.workOrders[0].state = "cancelled";
    const repository = {
      findWorkOrderInTenant: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskInTenant: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderCompletion: vi.fn(),
    };
    const { service, operations } = await buildService(repository);

    await expect(service.execute(command())).rejects.toThrow(
      "BUSINESS_STATE_VIOLATION",
    );
    expect(repository.applyWorkOrderCompletion).not.toHaveBeenCalled();
    expect(operations.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        businessDecisionState: "rejected",
        rejectionReasonCode: "BUSINESS_STATE_VIOLATION",
      }),
    );
  });

  it("同键同哈希复用，不重复完成", async () => {
    const bundle = readyBundle();
    bundle.workOrders[0].state = "completed";
    const repository = {
      findWorkOrderInTenant: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskInTenant: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderCompletion: vi.fn(),
    };
    const { service, operations } = await buildService(repository, {
      findByIdempotency: vi.fn().mockResolvedValue({
        id: "op-existing",
        tenantId: "t1",
        actorType: "user",
        actorId: "op-1",
        actionCode: "work_execution.complete_work_order",
        actionVersion: 1,
        targetType: "work_order",
        targetId: "w1",
        targetOwnerModule: "work-execution",
        correlationId: "corr",
        causationId: null,
        traceId: "trace",
        idempotencyKey: "work-order:w1:complete",
        requestHash: hashCompleteRequest({
          workOrderId: "w1",
          evidenceRefs: [],
        }),
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
    expect(result.commitState).toBe("committed");
    expect(repository.applyWorkOrderCompletion).not.toHaveBeenCalled();
    expect(operations.insert).not.toHaveBeenCalled();
  });

  it("同键异哈希冲突", async () => {
    const repository = {
      findWorkOrderInTenant: vi.fn(),
      findTaskInTenant: vi.fn(),
      applyWorkOrderCompletion: vi.fn(),
    };
    const { service } = await buildService(repository, {
      findByIdempotency: vi.fn().mockResolvedValue({
        id: "op-existing",
        requestHash: "c".repeat(64),
        targetId: "w1",
      }),
      insert: vi.fn(),
    });
    await expect(service.execute(command(["other"]))).rejects.toThrow(
      "IDEMPOTENCY_CONFLICT",
    );
    expect(repository.applyWorkOrderCompletion).not.toHaveBeenCalled();
  });

  it("同租户无柜任务可完成，读取从 Repository 起限定租户", async () => {
    const bundle = readyBundle({ containerId: null });
    const repository = {
      findWorkOrderInTenant: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskInTenant: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderCompletion: vi.fn().mockResolvedValue(APPLIED),
    };
    const { service, assertContainerTenant } = await buildService(repository);

    const result = await service.execute(command());

    expect(result).toMatchObject({ applied: true, taskState: "completed" });
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
      applyWorkOrderCompletion: vi.fn(),
    };
    const { service, operations } = await buildService(repository);

    const error = await service.execute(command()).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).message).toBe("RESOURCE_NOT_FOUND");
    expect(repository.findTaskInTenant).not.toHaveBeenCalled();
    expect(repository.applyWorkOrderCompletion).not.toHaveBeenCalled();
    expect(operations.insert).not.toHaveBeenCalled();
  });

  it("任务在当前租户不可见时同样表现为不存在且不写入", async () => {
    const bundle = readyBundle({ containerId: null });
    const repository = {
      findWorkOrderInTenant: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskInTenant: vi.fn().mockResolvedValue(null),
      applyWorkOrderCompletion: vi.fn(),
    };
    const { service, operations } = await buildService(repository);

    await expect(service.execute(command())).rejects.toThrow(NotFoundException);
    expect(repository.applyWorkOrderCompletion).not.toHaveBeenCalled();
    expect(operations.insert).not.toHaveBeenCalled();
  });

  it("带柜任务保留父货柜租户断言", async () => {
    const bundle = readyBundle();
    const repository = {
      findWorkOrderInTenant: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskInTenant: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderCompletion: vi.fn().mockResolvedValue(APPLIED),
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
      applyWorkOrderCompletion: vi.fn(),
    };
    const { service, operations } = await buildService(repository, {
      findByIdempotency: vi.fn().mockResolvedValue({
        id: "op-existing",
        requestHash: hashCompleteRequest({
          workOrderId: "w1",
          evidenceRefs: [],
        }),
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
    expect(repository.applyWorkOrderCompletion).not.toHaveBeenCalled();
    expect(operations.insert).not.toHaveBeenCalled();
  });

  it("写入契约携带租户与已读版本", async () => {
    const bundle = readyBundle({ version: 4 });
    bundle.workOrders[0].version = 7;
    const repository = {
      findWorkOrderInTenant: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskInTenant: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderCompletion: vi.fn().mockResolvedValue(APPLIED),
    };
    const { service } = await buildService(repository);

    await service.execute(command());

    expect(repository.applyWorkOrderCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        workOrderId: "w1",
        taskId: "t1",
        expectedWorkOrderVersion: 7,
        expectedTaskVersion: 4,
      }),
    );
  });

  it("事务内租户或父链不命中表现为不存在且不落操作回执", async () => {
    const bundle = readyBundle({ containerId: null });
    const repository = {
      findWorkOrderInTenant: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskInTenant: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderCompletion: vi
        .fn()
        .mockResolvedValue({ kind: "scope_mismatch" }),
    };
    const { service, operations } = await buildService(repository);

    const error = await service.execute(command()).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundException);
    expect(repository.applyWorkOrderCompletion).toHaveBeenCalledTimes(1);
    expect(operations.insert).not.toHaveBeenCalled();
  });

  it("版本冲突后重读发现已完成，按 already_done 形成 applied=false 回执", async () => {
    const stale = readyBundle({ containerId: null });
    const fresh = readyBundle({
      containerId: null,
      state: "completed",
      version: 1,
    });
    fresh.workOrders[0] = {
      ...fresh.workOrders[0],
      state: "completed",
      version: 1,
    };
    const repository = {
      findWorkOrderInTenant: vi
        .fn()
        .mockResolvedValueOnce(stale.workOrders[0])
        .mockResolvedValueOnce(fresh.workOrders[0]),
      findTaskInTenant: vi
        .fn()
        .mockResolvedValueOnce(stale)
        .mockResolvedValueOnce(fresh),
      applyWorkOrderCompletion: vi.fn().mockResolvedValue(VERSION_CONFLICT),
    };
    const { service, operations } = await buildService(repository);

    const result = await service.execute(command());

    expect(result).toMatchObject({
      applied: false,
      workOrderState: "completed",
      taskState: "completed",
      commitState: "committed",
    });
    expect(repository.applyWorkOrderCompletion).toHaveBeenCalledTimes(1);
    expect(operations.insert).toHaveBeenCalledTimes(1);
    expect(operations.insert).toHaveBeenCalledWith(
      expect.objectContaining({ commitState: "committed" }),
    );
  });

  it("版本冲突后重读按最新工单集合重算任务聚合与版本", async () => {
    const sibling = {
      ...readyBundle().workOrders[0],
      id: "w2",
    };
    const stale = readyBundle({ containerId: null });
    stale.workOrders.push({ ...sibling, state: "ready" });
    const fresh = readyBundle({ containerId: null, version: 1 });
    fresh.workOrders.push({ ...sibling, state: "completed", version: 1 });
    const repository = {
      findWorkOrderInTenant: vi.fn().mockResolvedValue(stale.workOrders[0]),
      findTaskInTenant: vi
        .fn()
        .mockResolvedValueOnce(stale)
        .mockResolvedValueOnce(fresh),
      applyWorkOrderCompletion: vi
        .fn()
        .mockResolvedValueOnce(VERSION_CONFLICT)
        .mockResolvedValueOnce(APPLIED),
    };
    const { service, operations } = await buildService(repository);

    const result = await service.execute(command());

    expect(result).toMatchObject({
      applied: true,
      taskState: "completed",
      outcomeRecorded: true,
    });
    expect(repository.applyWorkOrderCompletion).toHaveBeenCalledTimes(2);
    const [first] = repository.applyWorkOrderCompletion.mock.calls[0];
    const [second] = repository.applyWorkOrderCompletion.mock.calls[1];
    expect(first).toMatchObject({ expectedTaskVersion: 0, outcome: null });
    expect(first.taskState).not.toBe("completed");
    expect(second).toMatchObject({
      expectedTaskVersion: 1,
      taskState: "completed",
      outcome: expect.objectContaining({
        completedWorkOrderIds: expect.arrayContaining(["w1", "w2"]),
      }),
    });
    expect(operations.insert).not.toHaveBeenCalled();
  });

  it("有界重读后仍冲突返回稳定并发错误，不落 rejected 回执", async () => {
    const bundle = readyBundle({ containerId: null });
    const repository = {
      findWorkOrderInTenant: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskInTenant: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderCompletion: vi.fn().mockResolvedValue(VERSION_CONFLICT),
    };
    const { service, operations } = await buildService(repository);

    const error = await service.execute(command()).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(409);
    expect((error as HttpException).getResponse()).toBe(
      "CONCURRENCY_VERSION_CONFLICT",
    );
    expect(repository.applyWorkOrderCompletion).toHaveBeenCalledTimes(3);
    expect(operations.insert).not.toHaveBeenCalled();
  });
});
