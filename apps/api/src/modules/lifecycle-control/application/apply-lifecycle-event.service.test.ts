import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { ApplyContainerRecordService } from "../../shipment-registry";
const CREATE_NODE_TASK = Symbol.for("logix.CreateNodeTask");
const ASSERT_EVIDENCE_REFS = Symbol.for("logix.AssertEvidenceRefs");
import { LIFECYCLE_REPOSITORY } from "../domain/lifecycle.repository";
import { ApplyLifecycleEventService } from "./apply-lifecycle-event.service";

const EVIDENCE = "22222222-2222-4222-8222-222222222222";

function buildRepository(currentStatus: string) {
  return {
    findContainerBase: vi.fn().mockResolvedValue({
      tenantId: "t1",
      orderNumber: "SO-1",
      containerNumber: "MSKU1",
      currentStatus,
    }),
    ensureFlow: vi.fn().mockResolvedValue({
      flow: {
        id: "f1",
        containerId: "c1",
        state: "active",
        currentNodeCode: "cargo_ready",
        version: 0,
      },
      nodes: [],
    }),
    findFlowByContainer: vi.fn().mockResolvedValue(null),
    completeNodes: vi.fn().mockResolvedValue(undefined),
    updateCurrentNode: vi.fn().mockResolvedValue(undefined),
    ensureNode: vi.fn().mockResolvedValue({
      id: "node-next",
      nodeCode: "shipment_dispatch",
    }),
    findEventByIdempotencyKey: vi.fn().mockResolvedValue(null),
    findLatestEventTime: vi.fn().mockResolvedValue(null),
    saveEvent: vi.fn().mockResolvedValue(undefined),
  };
}

async function buildService(
  repository: ReturnType<typeof buildRepository>,
  applyContainerRecord: { execute: ReturnType<typeof vi.fn> },
  createNodeTask = { execute: vi.fn() },
  assertEvidenceRefs = { execute: vi.fn().mockResolvedValue(undefined) },
) {
  const module = await Test.createTestingModule({
    providers: [
      ApplyLifecycleEventService,
      { provide: LIFECYCLE_REPOSITORY, useValue: repository },
      { provide: ApplyContainerRecordService, useValue: applyContainerRecord },
      { provide: CREATE_NODE_TASK, useValue: createNodeTask },
      { provide: ASSERT_EVIDENCE_REFS, useValue: assertEvidenceRefs },
    ],
  }).compile();
  return {
    service: module.get(ApplyLifecycleEventService),
    createNodeTask,
    assertEvidenceRefs,
  };
}

function baseInput() {
  return {
    containerId: "c1",
    tenantId: "t1",
    eventCode: "sailing" as const,
    occurredAt: new Date("2026-09-12T10:00:00Z"),
    idempotencyKey: "key-1",
    evidenceRefs: [EVIDENCE],
  };
}

describe("ApplyLifecycleEventService", () => {
  it("跨租户拒绝", async () => {
    const repository = buildRepository("shipped");
    const { service } = await buildService(repository, { execute: vi.fn() });
    await expect(
      service.execute({ ...baseInput(), tenantId: "other" }),
    ).rejects.toThrow("AUTHORIZATION_SCOPE_DENIED");
    expect(repository.saveEvent).not.toHaveBeenCalled();
  });

  it("缺证据拒绝，不写事件", async () => {
    const repository = buildRepository("shipped");
    const { service } = await buildService(repository, { execute: vi.fn() });
    await expect(
      service.execute({ ...baseInput(), evidenceRefs: [] }),
    ).rejects.toThrow("EVIDENCE_REQUIRED");
    expect(repository.saveEvent).not.toHaveBeenCalled();
  });

  it("sailing 推进 in_transit，但不完成节点、不建任务", async () => {
    const repository = buildRepository("shipped");
    const applyContainerRecord = {
      execute: vi
        .fn()
        .mockResolvedValue({ containerRecordId: "c1", created: false }),
    };
    const { service, createNodeTask } = await buildService(
      repository,
      applyContainerRecord,
    );

    const result = await service.execute(baseInput());

    expect(result.completedNodes).toEqual([]);
    expect(result.resultingStatus).toBe("in_transit");
    expect(result.applied).toBe(true);
    expect(result.activatedNodeTaskId).toBeNull();
    expect(createNodeTask.execute).not.toHaveBeenCalled();
    expect(repository.saveEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        evidenceRefs: [EVIDENCE],
        tenantId: "t1",
        traceId: expect.any(String),
      }),
    );
  });

  it("不合格证据拒绝，不写事件", async () => {
    const repository = buildRepository("shipped");
    const { service } = await buildService(
      repository,
      { execute: vi.fn() },
      { execute: vi.fn() },
      {
        execute: vi.fn().mockRejectedValue(new Error("EVIDENCE_REQUIRED")),
      },
    );
    await expect(service.execute(baseInput())).rejects.toThrow(
      "EVIDENCE_REQUIRED",
    );
    expect(repository.saveEvent).not.toHaveBeenCalled();
  });

  it("stuffed 完成后为出运节点建任务", async () => {
    const repository = buildRepository("not_shipped");
    const applyContainerRecord = { execute: vi.fn() };
    const createNodeTask = {
      execute: vi.fn().mockResolvedValue({
        task: { id: "task-dispatch" },
        workOrders: [],
        outcome: null,
      }),
    };
    const { service } = await buildService(
      repository,
      applyContainerRecord,
      createNodeTask,
    );

    const result = await service.execute({
      ...baseInput(),
      eventCode: "stuffed",
    });

    expect(result.completedNodes).toEqual(["container_stuffing"]);
    expect(result.activatedNodeCode).toBe("shipment_dispatch");
    expect(result.activatedNodeTaskId).toBe("task-dispatch");
    expect(createNodeTask.execute).toHaveBeenCalledWith({
      flowInstanceId: "f1",
      nodeInstanceId: "node-next",
      nodeCode: "shipment_dispatch",
      containerId: "c1",
      tenantId: "t1",
      applicability: "required",
    });
  });

  it("loaded 完成后为离港节点建任务", async () => {
    const repository = buildRepository("not_shipped");
    repository.ensureNode.mockResolvedValue({
      id: "node-depart",
      nodeCode: "origin_departure",
    });
    const applyContainerRecord = {
      execute: vi
        .fn()
        .mockResolvedValue({ containerRecordId: "c1", created: false }),
    };
    const createNodeTask = {
      execute: vi.fn().mockResolvedValue({
        task: { id: "task-depart" },
        workOrders: [],
        outcome: null,
      }),
    };
    const { service } = await buildService(
      repository,
      applyContainerRecord,
      createNodeTask,
    );

    const result = await service.execute({
      ...baseInput(),
      eventCode: "loaded",
    });

    expect(result.completedNodes).toEqual(["shipment_dispatch"]);
    expect(result.resultingStatus).toBe("shipped");
    expect(result.activatedNodeCode).toBe("origin_departure");
    expect(result.activatedNodeTaskId).toBe("task-depart");
  });

  it("departed 完成后为海运在途节点建任务", async () => {
    const repository = buildRepository("shipped");
    repository.ensureNode.mockResolvedValue({
      id: "node-transit",
      nodeCode: "ocean_transit",
    });
    const applyContainerRecord = {
      execute: vi.fn(),
    };
    const createNodeTask = {
      execute: vi.fn().mockResolvedValue({
        task: { id: "task-transit" },
        workOrders: [],
        outcome: null,
      }),
    };
    const { service } = await buildService(
      repository,
      applyContainerRecord,
      createNodeTask,
    );

    const result = await service.execute({
      ...baseInput(),
      eventCode: "departed",
    });

    expect(result.completedNodes).toEqual(["origin_departure"]);
    expect(result.resultingStatus).toBe("shipped");
    expect(result.activatedNodeCode).toBe("ocean_transit");
    expect(result.activatedNodeTaskId).toBe("task-transit");
    expect(createNodeTask.execute).toHaveBeenCalledWith({
      flowInstanceId: "f1",
      nodeInstanceId: "node-transit",
      nodeCode: "ocean_transit",
      containerId: "c1",
      tenantId: "t1",
      applicability: "required",
    });
  });

  it("transit_arrived 在中转 N/A 时激活清关任务", async () => {
    const repository = buildRepository("in_transit");
    repository.ensureFlow.mockResolvedValue({
      flow: {
        id: "f1",
        containerId: "c1",
        state: "active",
        currentNodeCode: "ocean_transit",
        version: 1,
      },
      nodes: [
        {
          id: "node-ts",
          nodeCode: "transshipment",
          state: "pending",
          completedAt: null,
          applicability: "optional_not_applicable",
        },
      ],
    });
    repository.ensureNode.mockResolvedValue({
      id: "node-customs",
      nodeCode: "customs_clearance",
    });
    const applyContainerRecord = { execute: vi.fn() };
    const createNodeTask = {
      execute: vi.fn().mockResolvedValue({
        task: { id: "task-customs" },
        workOrders: [],
        outcome: null,
      }),
    };
    const { service } = await buildService(
      repository,
      applyContainerRecord,
      createNodeTask,
    );

    const result = await service.execute({
      ...baseInput(),
      eventCode: "transit_arrived",
    });

    expect(result.completedNodes).toEqual(["ocean_transit"]);
    expect(result.activatedNodeCode).toBe("customs_clearance");
    expect(result.activatedNodeTaskId).toBe("task-customs");
    expect(createNodeTask.execute).toHaveBeenCalledWith({
      flowInstanceId: "f1",
      nodeInstanceId: "node-customs",
      nodeCode: "customs_clearance",
      containerId: "c1",
      tenantId: "t1",
      applicability: "required",
    });
  });

  it("transit_arrived 激活中转任务时保留可选节点适用性", async () => {
    const repository = buildRepository("in_transit");
    repository.ensureFlow.mockResolvedValue({
      flow: {
        id: "f1",
        containerId: "c1",
        state: "active",
        currentNodeCode: "ocean_transit",
        version: 1,
      },
      nodes: [
        {
          id: "node-ts",
          nodeCode: "transshipment",
          state: "pending",
          completedAt: null,
          applicability: "optional_applicable",
        },
      ],
    });
    repository.ensureNode.mockResolvedValue({
      id: "node-ts",
      nodeCode: "transshipment",
    });
    const createNodeTask = {
      execute: vi.fn().mockResolvedValue({
        task: { id: "task-ts" },
        workOrders: [],
        outcome: null,
      }),
    };
    const { service } = await buildService(
      repository,
      { execute: vi.fn() },
      createNodeTask,
    );

    const result = await service.execute({
      ...baseInput(),
      eventCode: "transit_arrived",
    });

    expect(result.activatedNodeCode).toBe("transshipment");
    expect(createNodeTask.execute).toHaveBeenCalledWith({
      flowInstanceId: "f1",
      nodeInstanceId: "node-ts",
      nodeCode: "transshipment",
      containerId: "c1",
      tenantId: "t1",
      applicability: "optional_applicable",
    });
  });

  it("建单失败不回滚已应用事件", async () => {
    const repository = buildRepository("not_shipped");
    const applyContainerRecord = { execute: vi.fn() };
    const createNodeTask = {
      execute: vi.fn().mockRejectedValue(new Error("boom")),
    };
    const { service } = await buildService(
      repository,
      applyContainerRecord,
      createNodeTask,
    );

    const result = await service.execute({
      ...baseInput(),
      eventCode: "stuffed",
    });

    expect(result.applied).toBe(true);
    expect(result.activatedNodeCode).toBe("shipment_dispatch");
    expect(result.activatedNodeTaskId).toBeNull();
    expect(repository.saveEvent).toHaveBeenCalled();
  });

  it("回退事件（loaded 在 in_transit）→ 状态单调拦截", async () => {
    const repository = buildRepository("in_transit");
    const applyContainerRecord = {
      execute: vi
        .fn()
        .mockResolvedValue({ containerRecordId: "c1", created: false }),
    };
    const { service } = await buildService(repository, applyContainerRecord);

    const result = await service.execute({
      ...baseInput(),
      eventCode: "loaded",
    });

    expect(result.resultingStatus).toBe(null);
    expect(applyContainerRecord.execute).not.toHaveBeenCalled();
  });

  it("同 idempotencyKey → 幂等命中，不重复应用", async () => {
    const repository = buildRepository("shipped");
    repository.findEventByIdempotencyKey.mockResolvedValue({
      id: "e1",
      containerId: "c1",
      eventCode: "sailing",
      occurredAt: new Date("2026-09-12T10:00:00Z"),
      idempotencyKey: "key-1",
    });
    const applyContainerRecord = { execute: vi.fn() };
    const { service, createNodeTask } = await buildService(
      repository,
      applyContainerRecord,
    );

    const result = await service.execute(baseInput());

    expect(result.applied).toBe(false);
    expect(applyContainerRecord.execute).not.toHaveBeenCalled();
    expect(createNodeTask.execute).not.toHaveBeenCalled();
  });

  it("乱序事件（occurredAt 早于最晚）→ R1 时间单调拒绝", async () => {
    const repository = buildRepository("shipped");
    repository.findLatestEventTime.mockResolvedValue(
      new Date("2026-09-12T11:00:00Z"),
    );
    const applyContainerRecord = { execute: vi.fn() };
    const { service } = await buildService(repository, applyContainerRecord);

    await expect(service.execute(baseInput())).rejects.toThrow(
      "TIME_ORDER_CONFLICT",
    );
  });
});
