import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
const APPLY_LIFECYCLE_EVENT = Symbol.for("logix.ApplyLifecycleEvent");
import type { NodeTaskWithWorkOrders } from "../domain/work-execution.repository";
import { WORK_EXECUTION_REPOSITORY } from "../domain/work-execution.repository";
import { CompleteWorkOrderService } from "./complete-work-order.service";
const ASSERT_CONTAINER_TENANT = Symbol.for("logix.AssertContainerTenant");
const ASSERT_EVIDENCE_REFS = Symbol.for("logix.AssertEvidenceRefs");

const EVIDENCE = "22222222-2222-4222-8222-222222222222";

function readyBundle(
  overrides: Partial<NodeTaskWithWorkOrders["task"]> = {},
): NodeTaskWithWorkOrders {
  return {
    task: {
      id: "t1",
      flowInstanceId: "f1",
      nodeInstanceId: "n1",
      nodeCode: "customs_clearance",
      containerId: "c1",
      taskDefinitionKey: "node-customs_clearance",
      state: "pending",
      createdAt: new Date("2026-09-12T10:00:00Z"),
      ...overrides,
    },
    workOrders: [
      {
        id: "w1",
        nodeTaskId: "t1",
        workOrderDefinitionKey: "wo-customs_clearance",
        state: "ready",
        assignmentState: "unassigned",
        completedAt: null,
      },
    ],
    outcome: null,
  };
}

async function buildService(
  repository: Record<string, ReturnType<typeof vi.fn>>,
  applyLifecycleEvent = { execute: vi.fn() },
  assertEvidenceRefs = { execute: vi.fn().mockResolvedValue(undefined) },
) {
  const module = await Test.createTestingModule({
    providers: [
      CompleteWorkOrderService,
      { provide: WORK_EXECUTION_REPOSITORY, useValue: repository },
      { provide: APPLY_LIFECYCLE_EVENT, useValue: applyLifecycleEvent },
      {
        provide: ASSERT_CONTAINER_TENANT,
        useValue: { execute: vi.fn().mockResolvedValue(undefined) },
      },
      { provide: ASSERT_EVIDENCE_REFS, useValue: assertEvidenceRefs },
    ],
  }).compile();
  return {
    service: module.get(CompleteWorkOrderService),
    applyLifecycleEvent,
    assertEvidenceRefs,
  };
}

describe("CompleteWorkOrderService", () => {
  it("清关工单完成后不申请生命周期事件", async () => {
    const bundle = readyBundle();
    const repository = {
      findWorkOrderById: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskById: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderCompletion: vi.fn().mockResolvedValue(undefined),
    };
    const { service, applyLifecycleEvent } = await buildService(repository);

    const result = await service.execute("w1", "t1");

    expect(result).toMatchObject({
      taskState: "completed",
      outcomeRecorded: true,
      lifecycleApply: "not_applicable",
      lifecycleEventCode: null,
      activatedNodeCode: null,
      activatedNodeTaskId: null,
    });
    expect(applyLifecycleEvent.execute).not.toHaveBeenCalled();
  });

  it("装箱完成且有 containerId 时申请 stuffed", async () => {
    const bundle = readyBundle({
      nodeCode: "container_stuffing",
      taskDefinitionKey: "node-container_stuffing",
    });
    const repository = {
      findWorkOrderById: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskById: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderCompletion: vi.fn().mockResolvedValue(undefined),
    };
    const applyLifecycleEvent = {
      execute: vi.fn().mockResolvedValue({
        applied: true,
        activatedNodeCode: "shipment_dispatch",
        activatedNodeTaskId: "task-dispatch",
      }),
    };
    const { service } = await buildService(repository, applyLifecycleEvent);

    const result = await service.execute("w1", "t1", [EVIDENCE]);

    expect(result.lifecycleApply).toBe("applied");
    expect(result.lifecycleEventCode).toBe("stuffed");
    expect(result.activatedNodeCode).toBe("shipment_dispatch");
    expect(result.activatedNodeTaskId).toBe("task-dispatch");
    expect(applyLifecycleEvent.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        containerId: "c1",
        eventCode: "stuffed",
        evidenceRefs: [EVIDENCE],
        idempotencyKey: "work-execution:outcome:t1:stuffed",
      }),
    );
    expect(repository.applyWorkOrderCompletion).toHaveBeenCalled();
  });

  it("出运完成且有 containerId 时申请 loaded", async () => {
    const bundle = readyBundle({
      nodeCode: "shipment_dispatch",
      taskDefinitionKey: "node-shipment_dispatch",
    });
    const repository = {
      findWorkOrderById: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskById: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderCompletion: vi.fn().mockResolvedValue(undefined),
    };
    const applyLifecycleEvent = {
      execute: vi.fn().mockResolvedValue({ applied: true }),
    };
    const { service } = await buildService(repository, applyLifecycleEvent);

    const result = await service.execute("w1", "t1", [EVIDENCE]);

    expect(result.lifecycleApply).toBe("applied");
    expect(result.lifecycleEventCode).toBe("loaded");
    expect(applyLifecycleEvent.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        eventCode: "loaded",
        evidenceRefs: [EVIDENCE],
        idempotencyKey: "work-execution:outcome:t1:loaded",
      }),
    );
  });

  it("离港完成且有 containerId 时申请 departed", async () => {
    const bundle = readyBundle({
      nodeCode: "origin_departure",
      taskDefinitionKey: "node-origin_departure",
    });
    const repository = {
      findWorkOrderById: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskById: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderCompletion: vi.fn().mockResolvedValue(undefined),
    };
    const applyLifecycleEvent = {
      execute: vi.fn().mockResolvedValue({ applied: true }),
    };
    const { service } = await buildService(repository, applyLifecycleEvent);

    const result = await service.execute("w1", "t1", [EVIDENCE]);

    expect(result.lifecycleApply).toBe("applied");
    expect(result.lifecycleEventCode).toBe("departed");
    expect(applyLifecycleEvent.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        eventCode: "departed",
        evidenceRefs: [EVIDENCE],
        idempotencyKey: "work-execution:outcome:t1:departed",
      }),
    );
  });

  it("缺 containerId 时跳过申请，本地工单仍完成", async () => {
    const bundle = readyBundle({
      nodeCode: "container_stuffing",
      containerId: null,
    });
    const repository = {
      findWorkOrderById: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskById: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderCompletion: vi.fn().mockResolvedValue(undefined),
    };
    const { service, applyLifecycleEvent } = await buildService(repository);

    const result = await service.execute("w1", "t1");

    expect(result.taskState).toBe("completed");
    expect(result.lifecycleApply).toBe("skipped");
    expect(result.activatedNodeCode).toBeNull();
    expect(result.activatedNodeTaskId).toBeNull();
    expect(applyLifecycleEvent.execute).not.toHaveBeenCalled();
  });

  it("lifecycle 拒绝不回滚已完成工单", async () => {
    const bundle = readyBundle({ nodeCode: "container_stuffing" });
    const repository = {
      findWorkOrderById: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskById: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderCompletion: vi.fn().mockResolvedValue(undefined),
    };
    const applyLifecycleEvent = {
      execute: vi.fn().mockRejectedValue(new Error("RESOURCE_NOT_FOUND")),
    };
    const { service } = await buildService(repository, applyLifecycleEvent);

    const result = await service.execute("w1", "t1", [EVIDENCE]);

    expect(result.applied).toBe(true);
    expect(result.taskState).toBe("completed");
    expect(result.lifecycleApply).toBe("rejected");
    expect(result.lifecycleDetail).toContain("RESOURCE_NOT_FOUND");
    expect(result.activatedNodeCode).toBeNull();
    expect(result.activatedNodeTaskId).toBeNull();
  });

  it("已完成重放再次申请，走 lifecycle 幂等", async () => {
    const bundle = readyBundle({
      nodeCode: "container_stuffing",
      state: "completed",
    });
    bundle.workOrders[0].state = "completed";
    const repository = {
      findWorkOrderById: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskById: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderCompletion: vi.fn(),
    };
    const applyLifecycleEvent = {
      execute: vi.fn().mockResolvedValue({
        applied: false,
        activatedNodeCode: "shipment_dispatch",
        activatedNodeTaskId: "task-dispatch",
      }),
    };
    const { service } = await buildService(repository, applyLifecycleEvent);

    const result = await service.execute("w1", "t1", [EVIDENCE]);

    expect(result.applied).toBe(false);
    expect(result.lifecycleApply).toBe("replayed");
    expect(result.activatedNodeCode).toBe("shipment_dispatch");
    expect(result.activatedNodeTaskId).toBe("task-dispatch");
    expect(repository.applyWorkOrderCompletion).not.toHaveBeenCalled();
    expect(applyLifecycleEvent.execute).toHaveBeenCalled();
  });

  it("会发事件时无证据则拒绝，不落完成", async () => {
    const bundle = readyBundle({ nodeCode: "container_stuffing" });
    const repository = {
      findWorkOrderById: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskById: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderCompletion: vi.fn(),
    };
    const { service, applyLifecycleEvent } = await buildService(repository);

    await expect(service.execute("w1", "t1")).rejects.toThrow(
      "EVIDENCE_REQUIRED",
    );
    expect(repository.applyWorkOrderCompletion).not.toHaveBeenCalled();
    expect(applyLifecycleEvent.execute).not.toHaveBeenCalled();
  });

  it("cancelled 工单完成被拒绝", async () => {
    const bundle = readyBundle();
    bundle.workOrders[0].state = "cancelled";
    const repository = {
      findWorkOrderById: vi.fn().mockResolvedValue(bundle.workOrders[0]),
      findTaskById: vi.fn().mockResolvedValue(bundle),
      applyWorkOrderCompletion: vi.fn(),
    };
    const { service, applyLifecycleEvent } = await buildService(repository);

    await expect(service.execute("w1", "t1")).rejects.toThrow(
      "BUSINESS_STATE_VIOLATION",
    );
    expect(repository.applyWorkOrderCompletion).not.toHaveBeenCalled();
    expect(applyLifecycleEvent.execute).not.toHaveBeenCalled();
  });
});
