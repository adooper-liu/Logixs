import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { ApplyContainerRecordService } from "../../shipment-registry";
const CREATE_NODE_TASK = Symbol.for("logix.CreateNodeTask");
const ASSERT_EVIDENCE_REFS = Symbol.for("logix.AssertEvidenceRefs");
import { LIFECYCLE_REPOSITORY } from "../domain/lifecycle.repository";
import { ASSERT_LIFECYCLE_STATE_EVIDENCE } from "../assert-lifecycle-state-evidence.port";
import { defaultApplicability } from "../domain/node-applicability";
import { NODE_SEQUENCE } from "../domain/node-status";
import { ApplyLifecycleEventService } from "./apply-lifecycle-event.service";

const EVIDENCE = "22222222-2222-4222-8222-222222222222";
const DOMAIN_FACT = "33333333-3333-4333-8333-333333333333";

function buildRepository(currentStatus: string) {
  const flow = flowAt("cargo_ready");
  return {
    findContainerBase: vi.fn().mockResolvedValue({
      tenantId: "t1",
      orderNumber: "SO-1",
      containerNumber: "MSKU1",
      currentStatus,
    }),
    ensureFlow: vi.fn().mockResolvedValue(flow),
    findFlowByContainer: vi.fn().mockResolvedValue(null),
    completeNodes: vi.fn().mockResolvedValue(undefined),
    updateCurrentNode: vi.fn().mockResolvedValue(undefined),
    ensureNode: vi.fn().mockResolvedValue({
      id: "node-next",
      nodeCode: "shipment_dispatch",
    }),
    findEventByIdempotencyKey: vi.fn().mockResolvedValue(null),
    findLatestEventTime: vi.fn().mockResolvedValue(null),
    saveEvent: vi.fn().mockResolvedValue({ id: "event-1" }),
    findNodeEventApplication: vi.fn().mockResolvedValue(null),
    recordNodeEventApplication: vi.fn().mockResolvedValue(undefined),
    applyEventToNode: vi
      .fn()
      .mockImplementation(async (input: { expectedFlowVersion: number }) => ({
        applied: true,
        version: input.expectedFlowVersion + 1,
      })),
  };
}

function flowAt(
  currentNodeCode: keyof typeof NODE_SEQUENCE,
  applicability: Partial<
    Record<
      keyof typeof NODE_SEQUENCE,
      "required" | "optional_applicable" | "optional_not_applicable"
    >
  > = {},
) {
  const currentSequence = NODE_SEQUENCE[currentNodeCode];
  return {
    flow: {
      id: "f1",
      containerId: "c1",
      state: "active",
      currentNodeCode,
      version: 0,
    },
    nodes: Object.entries(NODE_SEQUENCE).map(([nodeCode, sequence]) => ({
      id: `node-${nodeCode}`,
      nodeCode,
      state:
        sequence < currentSequence
          ? "completed"
          : sequence === currentSequence
            ? "active"
            : "pending",
      completedAt:
        sequence < currentSequence ? new Date("2026-09-12T09:00:00Z") : null,
      applicability:
        applicability[nodeCode as keyof typeof NODE_SEQUENCE] ??
        defaultApplicability(nodeCode as keyof typeof NODE_SEQUENCE),
    })),
  };
}

function useFlow(
  repository: ReturnType<typeof buildRepository>,
  flow: ReturnType<typeof flowAt>,
) {
  repository.ensureFlow.mockResolvedValue(flow);
  repository.findFlowByContainer.mockResolvedValue(flow);
}

async function buildService(
  repository: ReturnType<typeof buildRepository>,
  applyContainerRecord: { execute: ReturnType<typeof vi.fn> },
  createNodeTask = { execute: vi.fn() },
  assertEvidenceRefs = { execute: vi.fn().mockResolvedValue(undefined) },
  assertStateEvidence = {
    execute: vi.fn().mockResolvedValue({
      domainFactId: DOMAIN_FACT,
      nodeCode: "cargo_ready",
      authorityPolicyRef: "policy-1:1",
    }),
  },
) {
  const module = await Test.createTestingModule({
    providers: [
      ApplyLifecycleEventService,
      { provide: LIFECYCLE_REPOSITORY, useValue: repository },
      { provide: ApplyContainerRecordService, useValue: applyContainerRecord },
      { provide: CREATE_NODE_TASK, useValue: createNodeTask },
      { provide: ASSERT_EVIDENCE_REFS, useValue: assertEvidenceRefs },
      {
        provide: ASSERT_LIFECYCLE_STATE_EVIDENCE,
        useValue: assertStateEvidence,
      },
    ],
  }).compile();
  return {
    service: module.get(ApplyLifecycleEventService),
    createNodeTask,
    assertEvidenceRefs,
    assertStateEvidence,
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
    domainFactId: DOMAIN_FACT,
  };
}

describe("ApplyLifecycleEventService", () => {
  it("缺少规范事实引用时禁止直接申请状态推进", async () => {
    const repository = buildRepository("shipped");
    const { service, assertStateEvidence } = await buildService(repository, {
      execute: vi.fn(),
    });

    await expect(
      service.execute({ ...baseInput(), domainFactId: undefined }),
    ).rejects.toThrow("LIFECYCLE_EVENT_NOT_STATE_EVIDENCE");
    expect(assertStateEvidence.execute).not.toHaveBeenCalled();
    expect(repository.saveEvent).not.toHaveBeenCalled();
  });

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
    useFlow(repository, flowAt("container_stuffing"));
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
    useFlow(repository, flowAt("shipment_dispatch"));
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
    useFlow(repository, flowAt("origin_departure"));
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
    useFlow(
      repository,
      flowAt("ocean_transit", {
        transshipment: "optional_not_applicable",
      }),
    );
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
    useFlow(repository, flowAt("ocean_transit"));
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
    useFlow(repository, flowAt("container_stuffing"));
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
    useFlow(repository, flowAt("shipment_dispatch"));
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
      domainFactId: DOMAIN_FACT,
      nodeCode: "cargo_ready",
      timeKind: "actual",
      authorityPolicyRef: "policy-1:1",
      evidenceRefs: [EVIDENCE],
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

  it("未来节点事件只留 pending_application，不越过未完成的必经前序", async () => {
    const repository = buildRepository("not_shipped");
    useFlow(repository, flowAt("cargo_ready"));
    const { service } = await buildService(repository, { execute: vi.fn() });

    const result = await service.execute({
      ...baseInput(),
      eventCode: "loaded",
    });

    expect(result.completedNodes).toEqual([]);
    expect(result.pendingNodes).toEqual(["shipment_dispatch"]);
    expect(repository.recordNodeEventApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "event-1",
        targetNodeInstanceId: "node-shipment_dispatch",
        state: "pending_application",
        reasonCode: "LIFECYCLE_EVENT_PENDING_PREDECESSOR",
      }),
    );
    expect(repository.applyEventToNode).not.toHaveBeenCalled();
  });

  it("arrived 先完成海运目标，清关未完成时把到港目标留待重放", async () => {
    const repository = buildRepository("in_transit");
    const before = flowAt("ocean_transit", {
      transshipment: "optional_not_applicable",
    });
    const afterOcean = flowAt("customs_clearance", {
      transshipment: "optional_not_applicable",
    });
    const transshipment = afterOcean.nodes.find(
      (node) => node.nodeCode === "transshipment",
    );
    if (transshipment) {
      transshipment.state = "pending";
      transshipment.completedAt = null;
    }
    repository.ensureFlow.mockResolvedValue(before);
    repository.findFlowByContainer.mockResolvedValue(afterOcean);
    const { service } = await buildService(repository, {
      execute: vi.fn().mockResolvedValue({}),
    });

    const result = await service.execute({
      ...baseInput(),
      eventCode: "arrived",
    });

    expect(result.completedNodes).toEqual(["ocean_transit"]);
    expect(result.pendingNodes).toEqual(["destination_arrival"]);
    expect(repository.applyEventToNode).toHaveBeenCalledTimes(1);
    expect(repository.applyEventToNode).toHaveBeenCalledWith(
      expect.objectContaining({ targetNodeCode: "ocean_transit" }),
    );
  });

  it("同一 arrived 事件在前序满足后只应用尚未完成的第二个目标", async () => {
    const repository = buildRepository("at_port");
    const ready = flowAt("destination_arrival", {
      transshipment: "optional_not_applicable",
    });
    const transshipment = ready.nodes.find(
      (node) => node.nodeCode === "transshipment",
    );
    if (transshipment) {
      transshipment.state = "pending";
      transshipment.completedAt = null;
    }
    useFlow(repository, ready);
    repository.findEventByIdempotencyKey.mockResolvedValue({
      id: "event-1",
      containerId: "c1",
      eventCode: "arrived",
      occurredAt: baseInput().occurredAt,
      domainFactId: DOMAIN_FACT,
      nodeCode: "destination_arrival",
      timeKind: "actual",
      authorityPolicyRef: "policy-1:1",
      evidenceRefs: [EVIDENCE],
      idempotencyKey: "key-1",
    });
    repository.findNodeEventApplication.mockImplementation(
      async (_eventId: string, targetNodeInstanceId: string) =>
        targetNodeInstanceId === "node-ocean_transit"
          ? {
              eventId: "event-1",
              targetNodeInstanceId,
              state: "applied",
              evaluatedAt: baseInput().occurredAt,
              guardResults: [],
              reasonCode: null,
            }
          : null,
    );
    const { service } = await buildService(repository, {
      execute: vi.fn().mockResolvedValue({}),
    });

    const result = await service.execute({
      ...baseInput(),
      eventCode: "arrived",
    });

    expect(result.completedNodes).toEqual(["destination_arrival"]);
    expect(result.pendingNodes).toEqual([]);
    expect(repository.saveEvent).not.toHaveBeenCalled();
    expect(repository.applyEventToNode).toHaveBeenCalledTimes(1);
    expect(repository.applyEventToNode).toHaveBeenCalledWith(
      expect.objectContaining({ targetNodeCode: "destination_arrival" }),
    );
  });

  it("已应用的事件目标幂等重放时不覆盖密封节点", async () => {
    const repository = buildRepository("not_shipped");
    const flow = flowAt("shipment_dispatch");
    const stuffing = flow.nodes.find(
      (node) => node.nodeCode === "container_stuffing",
    );
    if (stuffing) stuffing.completedAt = baseInput().occurredAt;
    useFlow(repository, flow);
    repository.findEventByIdempotencyKey.mockResolvedValue({
      id: "event-1",
      containerId: "c1",
      eventCode: "stuffed",
      occurredAt: baseInput().occurredAt,
      domainFactId: DOMAIN_FACT,
      nodeCode: "container_stuffing",
      timeKind: "actual",
      authorityPolicyRef: "policy-1:1",
      evidenceRefs: [EVIDENCE],
      idempotencyKey: "key-1",
    });
    repository.findNodeEventApplication.mockResolvedValue({
      eventId: "event-1",
      targetNodeInstanceId: "node-container_stuffing",
      state: "applied",
      evaluatedAt: baseInput().occurredAt,
      guardResults: [],
      reasonCode: null,
    });
    const { service } = await buildService(repository, { execute: vi.fn() });

    await service.execute({ ...baseInput(), eventCode: "stuffed" });

    expect(repository.applyEventToNode).not.toHaveBeenCalled();
    expect(repository.recordNodeEventApplication).not.toHaveBeenCalled();
  });

  it("前序实际时间晚于后序事件时留拒绝账并报告冲突", async () => {
    const repository = buildRepository("not_shipped");
    const flow = flowAt("container_stuffing");
    const cargoReady = flow.nodes.find(
      (node) => node.nodeCode === "cargo_ready",
    );
    if (cargoReady) {
      cargoReady.completedAt = new Date("2026-09-12T11:00:00Z");
    }
    useFlow(repository, flow);
    const { service } = await buildService(repository, { execute: vi.fn() });

    await expect(
      service.execute({ ...baseInput(), eventCode: "stuffed" }),
    ).rejects.toThrow("LIFECYCLE_TIME_ORDER_CONFLICT");
    expect(repository.recordNodeEventApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "rejected",
        reasonCode: "LIFECYCLE_TIME_ORDER_CONFLICT",
      }),
    );
    expect(repository.applyEventToNode).not.toHaveBeenCalled();
  });

  it("迟到事件仍先进入时间线，不拿接收顺序冒充节点先后", async () => {
    const repository = buildRepository("shipped");
    repository.findLatestEventTime.mockResolvedValue(
      new Date("2026-09-12T11:00:00Z"),
    );
    const applyContainerRecord = {
      execute: vi.fn().mockResolvedValue({}),
    };
    const { service } = await buildService(repository, applyContainerRecord);

    await expect(service.execute(baseInput())).resolves.toMatchObject({
      canonicalEventId: "event-1",
      completedNodes: [],
    });
    expect(repository.saveEvent).toHaveBeenCalled();
    expect(repository.findLatestEventTime).not.toHaveBeenCalled();
  });
});
