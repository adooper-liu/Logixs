import { describe, expect, it, vi } from "vitest";
import { PrismaLifecycleRepository } from "./prisma-lifecycle.repository";

const EVENT = {
  id: "",
  containerId: "c1",
  tenantId: "t1",
  eventCode: "stuffed" as const,
  domainFactId: "44444444-4444-4444-8444-444444444444",
  nodeCode: "container_stuffing" as const,
  timeKind: "actual" as const,
  authorityPolicyRef: "warehouse-stuffing:1",
  location: {
    locationType: "port" as const,
    unlocode: "CNNGB",
    segmentId: "55555555-5555-4555-8555-555555555555",
    timezone: "Asia/Shanghai",
  },
  occurredAt: new Date("2026-09-12T10:00:00.000Z"),
  evidenceRefs: ["22222222-2222-4222-8222-222222222222"],
  idempotencyKey: "key-1",
  traceId: "33333333-3333-4333-8333-333333333333",
};

describe("PrismaLifecycleRepository.saveEvent", () => {
  it("同事务写入规范事件与 pending Outbox，且 id 等于事件 id", async () => {
    const created = { id: "evt-1" };
    const tx = {
      canonicalEvent: { create: vi.fn().mockResolvedValue(created) },
      outboxMessage: { create: vi.fn().mockResolvedValue({}) },
      inboxMessage: { updateMany: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<void>) =>
        fn(tx),
      ),
    };
    const repository = new PrismaLifecycleRepository(prisma as never);

    await repository.saveEvent(EVENT);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.canonicalEvent.create).toHaveBeenCalledWith({
      data: {
        containerId: EVENT.containerId,
        eventCode: EVENT.eventCode,
        domainFactId: EVENT.domainFactId,
        nodeCode: EVENT.nodeCode,
        timeKind: EVENT.timeKind,
        authorityPolicyRef: EVENT.authorityPolicyRef,
        locationType: "port",
        unlocode: "CNNGB",
        locationId: null,
        segmentId: "55555555-5555-4555-8555-555555555555",
        portCallId: null,
        locationTimezone: "Asia/Shanghai",
        occurredAt: EVENT.occurredAt,
        evidenceRefs: EVENT.evidenceRefs,
        idempotencyKey: EVENT.idempotencyKey,
      },
    });
    expect(tx.outboxMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "evt-1",
        eventId: "evt-1",
        tenantId: "t1",
        ownerModule: "lifecycle-control",
        eventType: "stuffed",
        payloadHash: expect.any(String),
        state: "pending",
        attemptCount: 0,
        payloadRef: "canonical-event/evt-1",
        idempotencyKey: "key-1",
        traceId: EVENT.traceId,
      }),
    });
  });

  it("可选同事务标 Inbox processed", async () => {
    const created = { id: "evt-1" };
    const tx = {
      canonicalEvent: { create: vi.fn().mockResolvedValue(created) },
      outboxMessage: { create: vi.fn().mockResolvedValue({}) },
      inboxMessage: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<void>) =>
        fn(tx),
      ),
    };
    const repository = new PrismaLifecycleRepository(prisma as never);
    await repository.saveEvent({
      ...EVENT,
      completeInbox: {
        id: "in-1",
        owner: "service:logix-outbox-publisher",
        processedAt: EVENT.occurredAt,
      },
    });
    expect(tx.inboxMessage.updateMany).toHaveBeenCalledWith({
      where: {
        id: "in-1",
        state: "processing",
        leaseOwner: "service:logix-outbox-publisher",
      },
      data: expect.objectContaining({
        state: "processed",
        processedAt: EVENT.occurredAt,
      }),
    });
  });

  it("Outbox 写入失败则事务拒绝", async () => {
    const tx = {
      canonicalEvent: { create: vi.fn().mockResolvedValue({ id: "evt-1" }) },
      outboxMessage: {
        create: vi.fn().mockRejectedValue(new Error("outbox write failed")),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<void>) =>
        fn(tx),
      ),
    };
    const repository = new PrismaLifecycleRepository(prisma as never);

    await expect(repository.saveEvent(EVENT)).rejects.toThrow(
      "outbox write failed",
    );
  });
});

describe("PrismaLifecycleRepository.findActiveOceanRouteSegment", () => {
  it("只返回指定货柜当前 active 路线中的航段", async () => {
    const prisma = {
      oceanRouteSegment: {
        findFirst: vi.fn().mockResolvedValue({
          id: "segment-1",
          sequence: 2,
          isFinal: true,
          destinationLocationType: "terminal",
          destinationUnlocode: "USLAX",
          destinationLocationId: "terminal-1",
          destinationPortCallId: "call-1",
          routePlan: { id: "route-1", version: 3 },
        }),
      },
    };
    const repository = new PrismaLifecycleRepository(prisma as never);

    await expect(
      repository.findActiveOceanRouteSegment("container-1", "segment-1"),
    ).resolves.toEqual({
      routePlanId: "route-1",
      routeVersion: 3,
      segmentId: "segment-1",
      sequence: 2,
      isFinal: true,
      destinationLocationType: "terminal",
      destinationUnlocode: "USLAX",
      destinationLocationId: "terminal-1",
      destinationPortCallId: "call-1",
    });
    expect(prisma.oceanRouteSegment.findFirst).toHaveBeenCalledWith({
      where: {
        id: "segment-1",
        routePlan: { containerId: "container-1", status: "active" },
      },
      select: expect.any(Object),
    });
  });

  it("航段不属于当前 active 路线时返回空", async () => {
    const prisma = {
      oceanRouteSegment: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const repository = new PrismaLifecycleRepository(prisma as never);
    await expect(
      repository.findActiveOceanRouteSegment("container-1", "segment-1"),
    ).resolves.toBeNull();
  });
});

describe("PrismaLifecycleRepository.listFlowsWithNodes", () => {
  it("只读本租户已有流程，不 ensureFlow", async () => {
    const prisma = {
      containerRecord: {
        findMany: vi.fn().mockResolvedValue([{ id: "c1" }]),
      },
      flowInstance: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "f1",
            containerId: "c1",
            state: "active",
            currentNodeCode: "cargo_ready",
            version: 0,
            nodes: [
              {
                id: "n1",
                nodeCode: "cargo_ready",
                state: "active",
                completedAt: null,
                applicability: "required",
              },
            ],
          },
        ]),
        create: vi.fn(),
      },
    };
    const repository = new PrismaLifecycleRepository(prisma as never);
    const flows = await repository.listFlowsWithNodes({
      tenantId: "t1",
      containerIds: ["c1", "c2"],
    });
    expect(flows).toEqual([
      {
        flow: {
          id: "f1",
          containerId: "c1",
          state: "active",
          currentNodeCode: "cargo_ready",
          version: 0,
        },
        nodes: [
          {
            id: "n1",
            nodeCode: "cargo_ready",
            state: "active",
            completedAt: null,
            applicability: "required",
            blockedReasonRefs: [],
          },
        ],
      },
    ]);
    expect(prisma.flowInstance.create).not.toHaveBeenCalled();
  });

  it("他租户货柜直接省略", async () => {
    const prisma = {
      containerRecord: { findMany: vi.fn().mockResolvedValue([]) },
      flowInstance: { findMany: vi.fn(), create: vi.fn() },
    };
    const repository = new PrismaLifecycleRepository(prisma as never);
    await expect(
      repository.listFlowsWithNodes({
        tenantId: "other",
        containerIds: ["c1"],
      }),
    ).resolves.toEqual([]);
    expect(prisma.flowInstance.findMany).not.toHaveBeenCalled();
  });
});

describe("PrismaLifecycleRepository.ensureFlow", () => {
  it("首次初始化一次创建完整14节点管道", async () => {
    const flow = {
      id: "f1",
      containerId: "c1",
      state: "active",
      currentNodeCode: "cargo_ready",
      version: 0,
    };
    const tx = {
      flowInstance: {
        upsert: vi.fn().mockResolvedValue(flow),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ ...flow, nodes: [] }),
      },
      nodeInstance: {
        createMany: vi.fn().mockResolvedValue({ count: 14 }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    };
    const repository = new PrismaLifecycleRepository(prisma as never);

    await repository.ensureFlow("c1");

    expect(tx.nodeInstance.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ nodeCode: "cargo_ready", state: "active" }),
        expect.objectContaining({
          nodeCode: "transshipment",
          state: "pending",
          applicability: "optional_applicable",
        }),
        expect.objectContaining({ nodeCode: "empty_return", state: "pending" }),
      ]),
      skipDuplicates: true,
    });
    expect(tx.nodeInstance.createMany.mock.calls[0]?.[0].data).toHaveLength(14);
  });
});

describe("PrismaLifecycleRepository node event applications", () => {
  it("记录 pending 时不降级并发下已经 applied 的终态", async () => {
    const tx = {
      nodeEventApplication: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUnique: vi.fn().mockResolvedValue({ state: "applied" }),
        create: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    };
    const repository = new PrismaLifecycleRepository(prisma as never);

    await repository.recordNodeEventApplication({
      eventId: "event-1",
      targetNodeInstanceId: "node-1",
      state: "pending_application",
      evaluatedAt: new Date("2026-09-18T10:00:00Z"),
      guardResults: [],
      reasonCode: "LIFECYCLE_EVENT_PENDING_PREDECESSOR",
    });

    expect(tx.nodeEventApplication.create).not.toHaveBeenCalled();
  });

  it("完成目标节点、激活下一节点并原子记录 applied", async () => {
    const occurredAt = new Date("2026-09-18T10:00:00Z");
    const tx = {
      nodeEventApplication: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({ id: "application-1" }),
      },
      nodeInstance: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "node-ocean",
          flowInstanceId: "flow-1",
          nodeCode: "ocean_transit",
          state: "active",
        }),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      flowInstance: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue({ containerId: "container-1" }),
      },
      canonicalEvent: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          containerId: "container-1",
          occurredAt,
          domainFact: { traceId: "trace-1" },
        }),
      },
      containerRecord: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ tenantId: "tenant-1" }),
      },
      outboxMessage: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    };
    const repository = new PrismaLifecycleRepository(prisma as never);

    const result = await repository.applyEventToNode({
      tenantId: "tenant-1",
      flowInstanceId: "flow-1",
      expectedFlowVersion: 3,
      eventId: "event-1",
      targetNodeInstanceId: "node-ocean",
      targetNodeCode: "ocean_transit",
      nextNodeCode: "customs_clearance",
      occurredAt,
      evaluatedAt: occurredAt,
      guardResults: ["PREDECESSOR_NODES_COMPLETED"],
      routeSegmentGuard: null,
      traceId: "trace-1",
    });

    expect(result).toEqual({ applied: true, version: 4 });
    expect(tx.flowInstance.updateMany).toHaveBeenCalledWith({
      where: { id: "flow-1", version: 3, state: "active" },
      data: {
        version: { increment: 1 },
        currentNodeCode: "customs_clearance",
        state: "active",
      },
    });
    expect(tx.nodeInstance.update).toHaveBeenCalledWith({
      where: { id: "node-ocean" },
      data: { state: "completed", completedAt: occurredAt },
    });
    expect(tx.nodeEventApplication.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ state: "applied" }),
        update: expect.objectContaining({ state: "applied" }),
      }),
    );
    expect(tx.outboxMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        eventType: "work_execution.reconcile_applied_lifecycle_fact.requested",
        aggregateType: "node_event_application",
        aggregateId: "application-1",
        payloadRef: "node-event-application/application-1",
        causationId: "event-1",
        state: "pending",
      }),
    });
  });

  it("专用 Outbox 写入失败时整个节点应用事务拒绝", async () => {
    const occurredAt = new Date("2026-09-18T10:00:00Z");
    const tx = {
      nodeEventApplication: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({ id: "application-1" }),
      },
      nodeInstance: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "node-ocean",
          flowInstanceId: "flow-1",
          nodeCode: "ocean_transit",
          state: "active",
        }),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      flowInstance: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue({ containerId: "container-1" }),
      },
      canonicalEvent: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          containerId: "container-1",
          occurredAt,
          domainFact: { traceId: "trace-1" },
        }),
      },
      containerRecord: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ tenantId: "tenant-1" }),
      },
      outboxMessage: {
        create: vi.fn().mockRejectedValue(new Error("outbox write failed")),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    };
    const repository = new PrismaLifecycleRepository(prisma as never);

    await expect(
      repository.applyEventToNode({
        tenantId: "tenant-1",
        flowInstanceId: "flow-1",
        expectedFlowVersion: 3,
        eventId: "event-1",
        targetNodeInstanceId: "node-ocean",
        targetNodeCode: "ocean_transit",
        nextNodeCode: "customs_clearance",
        occurredAt,
        evaluatedAt: occurredAt,
        guardResults: [],
        routeSegmentGuard: null,
        traceId: "trace-1",
      }),
    ).rejects.toThrow("outbox write failed");
  });

  it("流程版本冲突时不接受本次节点转换", async () => {
    const tx = {
      nodeEventApplication: { findUnique: vi.fn().mockResolvedValue(null) },
      nodeInstance: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "node-ocean",
          flowInstanceId: "flow-1",
          nodeCode: "ocean_transit",
          state: "active",
        }),
      },
      flowInstance: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    };
    const repository = new PrismaLifecycleRepository(prisma as never);

    await expect(
      repository.applyEventToNode({
        tenantId: "tenant-1",
        flowInstanceId: "flow-1",
        expectedFlowVersion: 3,
        eventId: "event-1",
        targetNodeInstanceId: "node-ocean",
        targetNodeCode: "ocean_transit",
        nextNodeCode: "customs_clearance",
        occurredAt: new Date("2026-09-18T10:00:00Z"),
        evaluatedAt: new Date("2026-09-18T10:00:01Z"),
        guardResults: [],
        routeSegmentGuard: null,
        traceId: "trace-1",
      }),
    ).rejects.toThrow("LIFECYCLE_VERSION_CONFLICT");
  });

  it("原子应用时目标节点已被并发阻断则拒绝转换", async () => {
    const tx = {
      nodeEventApplication: { findUnique: vi.fn().mockResolvedValue(null) },
      nodeInstance: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "node-ocean",
          flowInstanceId: "flow-1",
          nodeCode: "ocean_transit",
          state: "blocked",
        }),
      },
      flowInstance: { updateMany: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    };
    const repository = new PrismaLifecycleRepository(prisma as never);

    await expect(
      repository.applyEventToNode({
        tenantId: "tenant-1",
        flowInstanceId: "flow-1",
        expectedFlowVersion: 3,
        eventId: "event-1",
        targetNodeInstanceId: "node-ocean",
        targetNodeCode: "ocean_transit",
        nextNodeCode: "customs_clearance",
        occurredAt: new Date("2026-09-18T10:00:00Z"),
        evaluatedAt: new Date("2026-09-18T10:00:01Z"),
        guardResults: [],
        routeSegmentGuard: null,
        traceId: "trace-1",
      }),
    ).rejects.toThrow("LIFECYCLE_NODE_BLOCKED");
    expect(tx.flowInstance.updateMany).not.toHaveBeenCalled();
  });

  it("节点事务提交前路线已换版则拒绝使用旧匹配结果", async () => {
    const tx = {
      nodeEventApplication: { findUnique: vi.fn().mockResolvedValue(null) },
      nodeInstance: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "node-ocean",
          flowInstanceId: "flow-1",
          nodeCode: "ocean_transit",
          state: "active",
        }),
      },
      oceanRouteSegment: { findFirst: vi.fn().mockResolvedValue(null) },
      flowInstance: { updateMany: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    };
    const repository = new PrismaLifecycleRepository(prisma as never);

    await expect(
      repository.applyEventToNode({
        tenantId: "tenant-1",
        flowInstanceId: "flow-1",
        expectedFlowVersion: 3,
        eventId: "event-1",
        targetNodeInstanceId: "node-ocean",
        targetNodeCode: "ocean_transit",
        nextNodeCode: "customs_clearance",
        occurredAt: new Date("2026-09-18T10:00:00Z"),
        evaluatedAt: new Date("2026-09-18T10:00:01Z"),
        guardResults: ["ARRIVAL_ROUTE_ACTIVE"],
        routeSegmentGuard: {
          routePlanId: "route-1",
          routeVersion: 1,
          segmentId: "segment-1",
          sequence: 1,
          isFinal: true,
          destinationLocationType: "port",
          destinationUnlocode: "USLAX",
          destinationLocationId: null,
          destinationPortCallId: null,
        },
        traceId: "trace-1",
      }),
    ).rejects.toThrow("LIFECYCLE_EVENT_ROUTE_MISMATCH");
    expect(tx.flowInstance.updateMany).not.toHaveBeenCalled();
  });
});
