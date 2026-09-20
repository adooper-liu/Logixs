import { describe, expect, it, vi } from "vitest";
import type { AppendLifecycleDateFactInput } from "../domain/lifecycle-date-fact";
import { PrismaLifecycleDateFactRepository } from "./prisma-lifecycle-date-fact.repository";

function input(
  overrides: Partial<AppendLifecycleDateFactInput> = {},
): AppendLifecycleDateFactInput {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    tenantId: "22222222-2222-4222-8222-222222222222",
    containerId: "33333333-3333-4333-8333-333333333333",
    nodeCode: "destination_arrival",
    eventCode: "arrived",
    timeKind: "estimated",
    occurredAt: new Date("2026-09-18T10:00:00Z"),
    rawValue: "2026-09-18 18:00",
    sourceUtcOffset: "+08:00",
    ingestionChannel: "api",
    captureSource: "external_evidence",
    sourceSystem: "provider-adapter",
    authoritySystem: "carrier-a",
    provider: "provider-a",
    interfaceCode: "container.status",
    sourceEventId: "event-1",
    mappingVersion: "v1",
    verificationState: "pending",
    confidenceState: "provisional",
    validity: "effective",
    authorityPolicyRef: null,
    evidenceRefs: [],
    actorId: null,
    reasonCode: null,
    idempotencyKey: "provider:event-1",
    payloadHash: "a".repeat(64),
    supersedesFactId: null,
    applicationState: "not_applicable",
    applicationReasonCode: null,
    canonicalEventId: null,
    traceId: "trace-1",
    receivedAt: new Date("2026-09-18T10:00:01Z"),
    ...overrides,
    location: overrides.location ?? null,
  };
}

function row(source: AppendLifecycleDateFactInput, projectionVersion = 1) {
  const { location, ...record } = source;
  return {
    ...record,
    locationType: location?.locationType ?? null,
    unlocode: location?.unlocode ?? null,
    locationId: location?.locationId ?? null,
    segmentId: location?.segmentId ?? null,
    portCallId: location?.portCallId ?? null,
    locationTimezone: location?.timezone ?? null,
    isCurrent: true,
    projectionVersion,
    recordedAt: new Date("2026-09-18T10:00:02Z"),
    updatedAt: new Date("2026-09-18T10:00:02Z"),
  };
}

function transaction(overrides: Record<string, unknown> = {}) {
  const source = input();
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ id: source.containerId }]),
    lifecycleDateFact: {
      findUnique: vi.fn().mockResolvedValue(null),
      aggregate: vi.fn().mockResolvedValue({
        _max: { projectionVersion: 0 },
      }),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(async ({ data }: { data: AppendLifecycleDateFactInput }) =>
        row(data),
      ),
      ...overrides,
    },
    inboxMessage: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

function repositoryWith(tx: ReturnType<typeof transaction>) {
  const prisma = {
    $transaction: vi.fn(
      async (operation: (client: typeof tx) => Promise<unknown>) =>
        operation(tx),
    ),
    lifecycleDateFact: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  };
  return {
    repository: new PrismaLifecycleDateFactRepository(prisma as never),
    prisma,
  };
}

describe("PrismaLifecycleDateFactRepository.append", () => {
  it("地点与航段分列写入并从事实记录重建", async () => {
    const location = {
      locationType: "port" as const,
      unlocode: "USLAX",
      segmentId: "66666666-6666-4666-8666-666666666666",
      portCallId: "call-1",
      timezone: "America/Los_Angeles",
    };
    const tx = transaction({
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ...data,
        isCurrent: true,
        projectionVersion: 1,
        recordedAt: new Date("2026-09-18T10:00:02Z"),
      })),
    });
    const { repository } = repositoryWith(tx);

    const result = await repository.append(input({ location }));

    expect(tx.lifecycleDateFact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        locationType: "port",
        unlocode: "USLAX",
        segmentId: location.segmentId,
        portCallId: "call-1",
        locationTimezone: "America/Los_Angeles",
      }),
    });
    expect(result.record.location).toEqual(location);
  });

  it("锁定货柜并为新投影分配单调版本", async () => {
    const old = row(
      input({
        id: "44444444-4444-4444-8444-444444444444",
        idempotencyKey: "old",
        payloadHash: "b".repeat(64),
      }),
      3,
    );
    const tx = transaction({
      aggregate: vi.fn().mockResolvedValue({
        _max: { projectionVersion: 3 },
      }),
      findFirst: vi.fn().mockResolvedValue(old),
      update: vi.fn().mockResolvedValue({ ...old, isCurrent: false }),
      create: vi.fn(async ({ data }: { data: AppendLifecycleDateFactInput }) =>
        row(data, 4),
      ),
    });
    const { repository } = repositoryWith(tx);

    const result = await repository.append(input({ expectedVersion: 3 }));

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.lifecycleDateFact.update).toHaveBeenCalledWith({
      where: { id: old.id },
      data: { isCurrent: false },
    });
    expect(tx.lifecycleDateFact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectionVersion: 4,
        supersedesFactId: old.id,
        isCurrent: true,
      }),
    });
    expect(result.record.projectionVersion).toBe(4);
  });

  it("同幂等键同哈希返回原记录，异哈希明确冲突", async () => {
    const existing = row(input(), 2);
    const sameTx = transaction({
      findUnique: vi.fn().mockResolvedValue(existing),
    });
    const { repository: sameRepository } = repositoryWith(sameTx);

    await expect(sameRepository.append(input())).resolves.toMatchObject({
      duplicate: true,
      record: { id: existing.id, projectionVersion: 2 },
    });
    expect(sameTx.lifecycleDateFact.aggregate).not.toHaveBeenCalled();

    const conflictTx = transaction({
      findUnique: vi.fn().mockResolvedValue(existing),
    });
    const { repository: conflictRepository } = repositoryWith(conflictTx);
    await expect(
      conflictRepository.append(input({ payloadHash: "f".repeat(64) })),
    ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });

  it("日期事实与 Inbox 完成在同一事务内提交", async () => {
    const tx = transaction();
    const { repository } = repositoryWith(tx);
    const processedAt = new Date("2026-09-18T10:00:03Z");

    await repository.append(
      input({
        completeInbox: { id: "inbox-1", owner: "worker-1", processedAt },
      }),
    );

    expect(tx.inboxMessage.updateMany).toHaveBeenCalledWith({
      where: {
        id: "inbox-1",
        state: "processing",
        leaseOwner: "worker-1",
      },
      data: expect.objectContaining({
        state: "processed",
        processedAt,
        leaseOwner: null,
      }),
    });
  });

  it("预期版本落后时拒绝写入", async () => {
    const tx = transaction({
      aggregate: vi.fn().mockResolvedValue({
        _max: { projectionVersion: 5 },
      }),
    });
    const { repository } = repositoryWith(tx);

    await expect(
      repository.append(input({ expectedVersion: 4 })),
    ).rejects.toThrow("OPTIMISTIC_LOCK_CONFLICT");
    expect(tx.lifecycleDateFact.create).not.toHaveBeenCalled();
  });

  it("已有实际日期必须显式引用当前事实才能更正", async () => {
    const current = row(
      input({
        id: "55555555-5555-4555-8555-555555555555",
        timeKind: "actual",
        evidenceRefs: ["66666666-6666-4666-8666-666666666666"],
      }),
      2,
    );
    const tx = transaction({
      aggregate: vi.fn().mockResolvedValue({
        _max: { projectionVersion: 2 },
      }),
      findFirst: vi.fn().mockResolvedValue(current),
    });
    const { repository } = repositoryWith(tx);

    await expect(
      repository.append(
        input({
          timeKind: "actual",
          evidenceRefs: ["77777777-7777-4777-8777-777777777777"],
          expectedVersion: 2,
        }),
      ),
    ).rejects.toThrow("实际日期更正必须引用当前事实");
    expect(tx.lifecycleDateFact.update).not.toHaveBeenCalled();
  });

  it("显式更正地点航段时按 supersedesFactId 锁定旧槽", async () => {
    const current = row(
      input({
        id: "55555555-5555-4555-8555-555555555555",
        timeKind: "actual",
        location: {
          locationType: "port",
          unlocode: "USLGB",
          segmentId: "66666666-6666-4666-8666-666666666666",
          timezone: "America/Los_Angeles",
        },
        evidenceRefs: ["77777777-7777-4777-8777-777777777777"],
      }),
      2,
    );
    const tx = transaction({
      aggregate: vi.fn().mockResolvedValue({
        _max: { projectionVersion: 2 },
      }),
      findFirst: vi.fn().mockResolvedValue(current),
      update: vi.fn().mockResolvedValue({ ...current, isCurrent: false }),
      create: vi.fn(async ({ data }: { data: AppendLifecycleDateFactInput }) =>
        row(data, 3),
      ),
    });
    const { repository } = repositoryWith(tx);

    await repository.append(
      input({
        timeKind: "actual",
        expectedVersion: 2,
        supersedesFactId: current.id,
        location: {
          locationType: "port",
          unlocode: "USLAX",
          segmentId: "88888888-8888-4888-8888-888888888888",
          timezone: "America/Los_Angeles",
        },
        evidenceRefs: ["99999999-9999-4999-8999-999999999999"],
      }),
    );

    expect(tx.lifecycleDateFact.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: current.id,
        containerId: current.containerId,
        isCurrent: true,
      }),
      orderBy: [{ projectionVersion: "desc" }, { id: "desc" }],
    });
    expect(tx.lifecycleDateFact.update).toHaveBeenCalledWith({
      where: { id: current.id },
      data: { isCurrent: false },
    });
  });
});

describe("PrismaLifecycleDateFactRepository.findById", () => {
  it("按事实主键回读服务端持久化的裁决上下文", async () => {
    const persisted = row(
      input({
        timeKind: "actual",
        verificationState: "verified",
        confidenceState: "confirmed",
        applicationState: "pending_application",
        authorityPolicyRef: "port-arrival:3",
        evidenceRefs: ["66666666-6666-4666-8666-666666666666"],
      }),
      4,
    );
    const tx = transaction();
    const { repository, prisma } = repositoryWith(tx);
    prisma.lifecycleDateFact.findUnique.mockResolvedValue(persisted);

    await expect(repository.findById(persisted.id)).resolves.toMatchObject({
      id: persisted.id,
      timeKind: "actual",
      verificationState: "verified",
      confidenceState: "confirmed",
      applicationState: "pending_application",
      authorityPolicyRef: "port-arrival:3",
    });
    expect(prisma.lifecycleDateFact.findUnique).toHaveBeenCalledWith({
      where: { id: persisted.id },
    });
  });

  it("事实不存在时返回 null", async () => {
    const tx = transaction();
    const { repository, prisma } = repositoryWith(tx);
    prisma.lifecycleDateFact.findUnique.mockResolvedValue(null);

    await expect(repository.findById("missing")).resolves.toBeNull();
  });
});

describe("PrismaLifecycleDateFactRepository.claimPendingApplications", () => {
  it("领取同柜 current actual pending 事实并写入短租约", async () => {
    const first = row(
      input({
        id: "66666666-6666-4666-8666-666666666666",
        timeKind: "actual",
        applicationState: "pending_application",
        occurredAt: new Date("2026-09-18T01:00:00Z"),
      }),
      1,
    );
    const second = row(
      input({
        id: "77777777-7777-4777-8777-777777777777",
        timeKind: "actual",
        applicationState: "pending_application",
        occurredAt: new Date("2026-09-18T02:00:00Z"),
      }),
      2,
    );
    const tx = transaction({
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      findMany: vi.fn().mockResolvedValue([first, second]),
    });
    tx.$queryRaw.mockResolvedValue([{ id: first.id }, { id: second.id }]);
    const { repository } = repositoryWith(tx);
    const now = new Date("2026-09-18T03:00:00Z");
    const leaseUntil = new Date("2026-09-18T03:00:30Z");

    const result = await repository.claimPendingApplications({
      tenantId: first.tenantId,
      containerId: first.containerId,
      owner: "worker-1",
      now,
      leaseUntil,
      limit: 50,
    });

    expect(tx.lifecycleDateFact.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: [first.id, second.id] },
        applicationState: "pending_application",
      },
      data: {
        applicationLeaseOwner: "worker-1",
        applicationLeaseUntil: leaseUntil,
        applicationAttempts: { increment: 1 },
        lastApplicationAt: now,
      },
    });
    expect(tx.lifecycleDateFact.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [first.id, second.id] },
        applicationLeaseOwner: "worker-1",
      },
      orderBy: [
        { occurredAt: "asc" },
        { projectionVersion: "asc" },
        { id: "asc" },
      ],
    });
    expect(result.map((item) => item.id)).toEqual([first.id, second.id]);
  });
});
