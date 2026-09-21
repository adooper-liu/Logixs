import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { GET_CUSTOMS_CLEARANCE_READINESS } from "../../customs-compliance";
import { READ_EVIDENCE_AUTHORITY_CONTEXT } from "../../document-records";
import { GET_WAREHOUSE_DELIVERY_READINESS } from "../../inland-fulfillment";
import {
  ApplyContainerRecordService,
  GET_CONTAINER_DISPATCH_READINESS,
  GET_CONTAINER_STUFFING_READINESS,
} from "../../shipment-registry";
import { EVALUATE_CARGO_READY_COMPLIANCE } from "../../compliance-management";
const CREATE_NODE_TASK = Symbol.for("logix.CreateNodeTask");
const ASSERT_EVIDENCE_REFS = Symbol.for("logix.AssertEvidenceRefs");
import { LIFECYCLE_REPOSITORY } from "../domain/lifecycle.repository";
import { LIFECYCLE_DATE_FACT_REPOSITORY } from "../domain/lifecycle-date-fact.repository";
import { ASSERT_LIFECYCLE_STATE_EVIDENCE } from "../assert-lifecycle-state-evidence.port";
import { defaultApplicability } from "../domain/node-applicability";
import { NODE_SEQUENCE } from "../domain/node-status";
import { ApplyLifecycleEventService } from "./apply-lifecycle-event.service";

const EVIDENCE = "22222222-2222-4222-8222-222222222222";
const DOMAIN_FACT = "33333333-3333-4333-8333-333333333333";
const ARRIVAL_LOCATION = {
  locationType: "port" as const,
  unlocode: "USLAX",
  segmentId: "44444444-4444-4444-8444-444444444444",
  timezone: "America/Los_Angeles",
};
const PICKUP_LOCATION = {
  locationType: "terminal" as const,
  unlocode: "USLAX",
  locationId: "77777777-7777-4777-8777-777777777777",
  timezone: "America/Los_Angeles",
};
const WAREHOUSE_LOCATION = {
  locationType: "warehouse" as const,
  unlocode: "ESBCN",
  locationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  timezone: "Europe/Madrid",
};
const FINAL_ROUTE_SEGMENT = {
  routePlanId: "55555555-5555-4555-8555-555555555555",
  routeVersion: 1,
  segmentId: ARRIVAL_LOCATION.segmentId,
  sequence: 1,
  isFinal: true,
  destinationLocationType: "port" as const,
  destinationUnlocode: "USLAX",
  destinationLocationId: null,
  destinationPortCallId: null,
};

function buildRepository(
  currentStatus: string,
  containerNumber: string | null = "MSKU1",
) {
  const flow = flowAt("cargo_ready");
  return {
    findContainerBase: vi.fn().mockResolvedValue({
      tenantId: "t1",
      orderNumber: "SO-1",
      containerNumber,
      currentStatus,
    }),
    findActiveOceanRouteSegment: vi.fn().mockResolvedValue(FINAL_ROUTE_SEGMENT),
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
    execute: vi
      .fn()
      .mockImplementation(async (input: { eventCode: string }) => ({
        domainFactId: DOMAIN_FACT,
        nodeCode: "cargo_ready",
        authorityPolicyRef: "policy-1:1",
        location: ["arrived", "transit_arrived"].includes(input.eventCode)
          ? ARRIVAL_LOCATION
          : input.eventCode === "gate_out"
            ? PICKUP_LOCATION
            : ["delivered", "warehouse_arrival"].includes(input.eventCode)
              ? WAREHOUSE_LOCATION
              : null,
      })),
  },
  evaluateCargoReadyCompliance = {
    execute: vi.fn().mockResolvedValue({
      approved: true,
      reasonCode: "CARGO_READY_COMPLIANCE_APPROVED",
      assessmentId: "55555555-5555-4555-8555-555555555555",
      decisionId: "66666666-6666-4666-8666-666666666666",
    }),
  },
  getContainerStuffingReadiness = {
    execute: vi.fn().mockResolvedValue({
      confirmed: true,
      reasonCode: null,
      snapshotId: "77777777-7777-4777-8777-777777777777",
    }),
  },
  getContainerDispatchReadiness = {
    execute: vi.fn().mockResolvedValue({
      confirmed: true,
      reasonCode: null,
      snapshotId: "88888888-8888-4888-8888-888888888888",
    }),
  },
  getCustomsClearanceReadiness = {
    execute: vi.fn().mockResolvedValue({
      confirmed: true,
      reasonCode: null,
      caseId: "99999999-9999-4999-8999-999999999999",
    }),
  },
  lifecycleDateFacts = { listCurrent: vi.fn().mockResolvedValue([]) },
  getWarehouseDeliveryReadiness = {
    execute: vi.fn().mockResolvedValue({
      confirmed: true,
      reasonCode: null,
      instruction: {
        instructionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        warehouseLocationId: WAREHOUSE_LOCATION.locationId,
        unlocode: WAREHOUSE_LOCATION.unlocode,
        timezone: WAREHOUSE_LOCATION.timezone,
      },
    }),
  },
  readEvidenceAuthorityContext = {
    execute: vi.fn().mockResolvedValue([
      {
        id: EVIDENCE,
        evidenceType: "receipt",
        authorityLevel: "operational",
        sourceType: "organization",
        authoritySystem: "warehouse.vls",
        verificationState: "verified",
        validity: "effective",
      },
    ]),
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
      {
        provide: EVALUATE_CARGO_READY_COMPLIANCE,
        useValue: evaluateCargoReadyCompliance,
      },
      {
        provide: GET_CONTAINER_STUFFING_READINESS,
        useValue: getContainerStuffingReadiness,
      },
      {
        provide: GET_CONTAINER_DISPATCH_READINESS,
        useValue: getContainerDispatchReadiness,
      },
      {
        provide: GET_CUSTOMS_CLEARANCE_READINESS,
        useValue: getCustomsClearanceReadiness,
      },
      {
        provide: GET_WAREHOUSE_DELIVERY_READINESS,
        useValue: getWarehouseDeliveryReadiness,
      },
      {
        provide: READ_EVIDENCE_AUTHORITY_CONTEXT,
        useValue: readEvidenceAuthorityContext,
      },
      {
        provide: LIFECYCLE_DATE_FACT_REPOSITORY,
        useValue: lifecycleDateFacts,
      },
    ],
  }).compile();
  return {
    service: module.get(ApplyLifecycleEventService),
    createNodeTask,
    assertEvidenceRefs,
    assertStateEvidence,
    evaluateCargoReadyCompliance,
    getContainerStuffingReadiness,
    getContainerDispatchReadiness,
    lifecycleDateFacts,
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
  it("delivered 在目的仓与 POD 证据匹配时完成送仓但保持 picked_up", async () => {
    const repository = buildRepository("picked_up");
    useFlow(repository, flowAt("warehouse_delivery"));
    const applyContainerRecord = { execute: vi.fn() };
    const { service } = await buildService(repository, applyContainerRecord);

    const result = await service.execute({
      ...baseInput(),
      eventCode: "delivered",
    });

    expect(result.completedNodes).toEqual(["warehouse_delivery"]);
    expect(applyContainerRecord.execute).not.toHaveBeenCalled();
  });

  it("delivered 缺少当前目的仓指令时保存事件并保持待应用", async () => {
    const repository = buildRepository("picked_up");
    useFlow(repository, flowAt("warehouse_delivery"));
    const readiness = {
      execute: vi.fn().mockResolvedValue({
        confirmed: false,
        reasonCode: "LIFECYCLE_EVENT_PENDING_DELIVERY_INSTRUCTION",
        instruction: null,
      }),
    };
    const { service } = await buildService(
      repository,
      { execute: vi.fn() },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      readiness,
    );

    const result = await service.execute({
      ...baseInput(),
      eventCode: "delivered",
    });

    expect(result.completedNodes).toEqual([]);
    expect(result.pendingReasonCodes.warehouse_delivery).toBe(
      "LIFECYCLE_EVENT_PENDING_DELIVERY_INSTRUCTION",
    );
  });

  it("gate_out 读取当前可提事实并完成提柜节点", async () => {
    const repository = buildRepository("at_port");
    useFlow(repository, flowAt("container_pickup"));
    const lifecycleDateFacts = {
      listCurrent: vi.fn().mockResolvedValue([
        {
          id: "available-fact",
          tenantId: "t1",
          containerId: "c1",
          nodeCode: "container_pickup",
          eventCode: "available",
          timeKind: "actual",
          occurredAt: new Date("2026-09-12T09:00:00Z"),
          verificationState: "verified",
          confidenceState: "confirmed",
          validity: "effective",
          applicationState: "applied",
          location: PICKUP_LOCATION,
          isCurrent: true,
        },
      ]),
    };
    const applyContainerRecord = { execute: vi.fn() };
    const { service } = await buildService(
      repository,
      applyContainerRecord,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      lifecycleDateFacts,
    );

    const result = await service.execute({
      ...baseInput(),
      eventCode: "gate_out",
      occurredAt: new Date("2026-09-12T10:00:00Z"),
    });

    expect(lifecycleDateFacts.listCurrent).toHaveBeenCalledWith({
      tenantId: "t1",
      containerId: "c1",
    });
    expect(result.completedNodes).toEqual(["container_pickup"]);
    expect(applyContainerRecord.execute).toHaveBeenCalledWith(
      expect.objectContaining({ currentStatus: "picked_up" }),
    );
  });

  it("gate_out 缺少可提事实时保持待应用", async () => {
    const repository = buildRepository("at_port");
    useFlow(repository, flowAt("container_pickup"));
    const lifecycleDateFacts = { listCurrent: vi.fn().mockResolvedValue([]) };
    const { service } = await buildService(
      repository,
      { execute: vi.fn() },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      lifecycleDateFacts,
    );

    const result = await service.execute({
      ...baseInput(),
      eventCode: "gate_out",
    });

    expect(result.completedNodes).toEqual([]);
    expect(result.pendingReasonCodes.container_pickup).toBe(
      "LIFECYCLE_EVENT_PENDING_TERMINAL_AVAILABILITY",
    );
    expect(repository.applyEventToNode).not.toHaveBeenCalled();
  });

  it("cargo_ready 合规未放行时保存事件但保留待应用", async () => {
    const repository = buildRepository("not_shipped");
    const gate = {
      execute: vi.fn().mockResolvedValue({
        approved: false,
        reasonCode: "CARGO_READY_COMPLIANCE_NOT_APPROVED",
        assessmentId: "55555555-5555-4555-8555-555555555555",
        decisionId: null,
      }),
    };
    const { service } = await buildService(
      repository,
      { execute: vi.fn() },
      undefined,
      undefined,
      undefined,
      gate,
    );

    const result = await service.execute({
      ...baseInput(),
      eventCode: "cargo_ready",
    });

    expect(result.completedNodes).toEqual([]);
    expect(result.pendingReasonCodes.cargo_ready).toBe(
      "LIFECYCLE_EVENT_PENDING_COMPLIANCE",
    );
    expect(repository.applyEventToNode).not.toHaveBeenCalled();
  });

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

  it("stuffed 事实先到但箱号未绑定时留待应用，不完成装箱节点", async () => {
    const repository = buildRepository("not_shipped", null);
    useFlow(repository, flowAt("container_stuffing"));
    const { service, createNodeTask } = await buildService(repository, {
      execute: vi.fn(),
    });

    const result = await service.execute({
      ...baseInput(),
      eventCode: "stuffed",
    });

    expect(result.completedNodes).toEqual([]);
    expect(result.pendingNodes).toEqual(["container_stuffing"]);
    expect(result.pendingReasonCodes).toEqual({
      container_stuffing: "LIFECYCLE_EVENT_PENDING_CONTAINER_IDENTITY",
    });
    expect(repository.recordNodeEventApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "pending_application",
        reasonCode: "LIFECYCLE_EVENT_PENDING_CONTAINER_IDENTITY",
      }),
    );
    expect(repository.applyEventToNode).not.toHaveBeenCalled();
    expect(createNodeTask.execute).not.toHaveBeenCalled();
  });

  it.each([
    "LIFECYCLE_EVENT_PENDING_STUFFING_SNAPSHOT",
    "LIFECYCLE_EVENT_PENDING_STUFFING_SNAPSHOT_STALE",
    "LIFECYCLE_EVENT_PENDING_STUFFING_EVIDENCE",
  ])("stuffed 装箱事实未就绪时留待自动重放：%s", async (reasonCode) => {
    const repository = buildRepository("not_shipped");
    useFlow(repository, flowAt("container_stuffing"));
    const getContainerStuffingReadiness = {
      execute: vi.fn().mockResolvedValue({
        confirmed: false,
        reasonCode,
        snapshotId: null,
      }),
    };
    const { service, createNodeTask } = await buildService(
      repository,
      { execute: vi.fn() },
      undefined,
      undefined,
      undefined,
      undefined,
      getContainerStuffingReadiness,
    );

    const result = await service.execute({
      ...baseInput(),
      eventCode: "stuffed",
    });

    expect(result.completedNodes).toEqual([]);
    expect(result.pendingReasonCodes.container_stuffing).toBe(reasonCode);
    expect(repository.applyEventToNode).not.toHaveBeenCalled();
    expect(createNodeTask.execute).not.toHaveBeenCalled();
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

  it("loaded 在出运交接缺失时保留待应用并等待自动重放", async () => {
    const repository = buildRepository("not_shipped");
    useFlow(repository, flowAt("shipment_dispatch"));
    const dispatchReadiness = {
      execute: vi.fn().mockResolvedValue({
        confirmed: false,
        reasonCode: "LIFECYCLE_EVENT_PENDING_DISPATCH_SNAPSHOT",
        snapshotId: null,
      }),
    };
    const { service } = await buildService(
      repository,
      { execute: vi.fn() },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      dispatchReadiness,
    );

    const result = await service.execute({
      ...baseInput(),
      eventCode: "loaded",
    });

    expect(result.completedNodes).toEqual([]);
    expect(result.pendingReasonCodes.shipment_dispatch).toBe(
      "LIFECYCLE_EVENT_PENDING_DISPATCH_SNAPSHOT",
    );
    expect(repository.applyEventToNode).not.toHaveBeenCalled();
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
    repository.findActiveOceanRouteSegment.mockResolvedValue({
      ...FINAL_ROUTE_SEGMENT,
      isFinal: false,
    });
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
    repository.findActiveOceanRouteSegment.mockResolvedValue({
      ...FINAL_ROUTE_SEGMENT,
      isFinal: false,
    });
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
      location: null,
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
      expect.objectContaining({
        targetNodeCode: "ocean_transit",
        routeSegmentGuard: FINAL_ROUTE_SEGMENT,
      }),
    );
  });

  it("arrived 缺少持久化地点航段时保留待应用且不完成海运", async () => {
    const repository = buildRepository("in_transit");
    useFlow(
      repository,
      flowAt("ocean_transit", {
        transshipment: "optional_not_applicable",
      }),
    );
    const { service } = await buildService(
      repository,
      { execute: vi.fn() },
      undefined,
      undefined,
      {
        execute: vi.fn().mockResolvedValue({
          domainFactId: DOMAIN_FACT,
          nodeCode: "destination_arrival",
          authorityPolicyRef: "policy-1:1",
          location: null,
        }),
      },
    );

    const result = await service.execute({
      ...baseInput(),
      eventCode: "arrived",
    });

    expect(result.completedNodes).toEqual([]);
    expect(result.pendingReasonCodes.ocean_transit).toBe(
      "LIFECYCLE_EVENT_PENDING_LOCATION_CONTEXT",
    );
    expect(repository.applyEventToNode).not.toHaveBeenCalled();
  });

  it("arrived 找不到当前权威路线航段时保留待应用", async () => {
    const repository = buildRepository("in_transit");
    repository.findActiveOceanRouteSegment.mockResolvedValue(null);
    useFlow(
      repository,
      flowAt("ocean_transit", {
        transshipment: "optional_not_applicable",
      }),
    );
    const { service } = await buildService(repository, { execute: vi.fn() });

    const result = await service.execute({
      ...baseInput(),
      eventCode: "arrived",
    });

    expect(repository.findActiveOceanRouteSegment).toHaveBeenCalledWith(
      "c1",
      ARRIVAL_LOCATION.segmentId,
    );
    expect(result.completedNodes).toEqual([]);
    expect(result.pendingReasonCodes.ocean_transit).toBe(
      "LIFECYCLE_EVENT_PENDING_ROUTE_CONTEXT",
    );
    expect(repository.applyEventToNode).not.toHaveBeenCalled();
  });

  it("arrived 的目的港与当前最终航段不匹配时保留待应用", async () => {
    const repository = buildRepository("in_transit");
    repository.findActiveOceanRouteSegment.mockResolvedValue({
      ...FINAL_ROUTE_SEGMENT,
      destinationUnlocode: "USLGB",
    });
    useFlow(
      repository,
      flowAt("ocean_transit", {
        transshipment: "optional_not_applicable",
      }),
    );
    const { service } = await buildService(repository, { execute: vi.fn() });

    const result = await service.execute({
      ...baseInput(),
      eventCode: "arrived",
    });

    expect(result.completedNodes).toEqual([]);
    expect(result.pendingReasonCodes.ocean_transit).toBe(
      "LIFECYCLE_EVENT_ROUTE_MISMATCH",
    );
    expect(repository.applyEventToNode).not.toHaveBeenCalled();
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
      location: ARRIVAL_LOCATION,
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
      location: null,
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
