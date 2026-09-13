import { describe, expect, it, vi } from "vitest";
import { PrismaOutboxRepository } from "./prisma-outbox.repository";

const NOW = new Date("2026-09-13T00:00:00.000Z");

describe("PrismaOutboxRepository", () => {
  it("领取后把 SQL 行映射为 publishing 租约", async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: "evt-1",
          tenant_id: "t1",
          owner_module: "lifecycle-control",
          event_id: "evt-1",
          event_type: "stuffed",
          aggregate_type: "container",
          aggregate_id: "c1",
          payload_ref: "canonical-event/evt-1",
          payload_hash: "a".repeat(64),
          state: "publishing",
          attempt_count: 1,
          locked_by: "op-1",
          locked_at: NOW,
          lease_expires_at: new Date("2026-09-13T00:00:30.000Z"),
          occurred_at: NOW,
          created_at: NOW,
          idempotency_key: "key-1",
          trace_id: "trace-1",
        },
      ]),
    };
    const repository = new PrismaOutboxRepository(prisma as never);
    const claimed = await repository.claimBatch({
      tenantId: "t1",
      ownerModule: "lifecycle-control",
      owner: "op-1",
      now: NOW,
      limit: 10,
      leaseSeconds: 30,
    });
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(claimed).toEqual([
      expect.objectContaining({
        id: "evt-1",
        eventId: "evt-1",
        state: "publishing",
        attemptCount: 1,
        lease: {
          owner: "op-1",
          lockedAt: NOW,
          expiresAt: new Date("2026-09-13T00:00:30.000Z"),
        },
      }),
    ]);
  });

  it("仅更新仍由本人持有的 publishing 行", async () => {
    const prisma = {
      outboxMessage: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          eventId: "evt-1",
          state: "published",
          brokerReference: "stub:evt-1",
        }),
      },
    };
    const repository = new PrismaOutboxRepository(prisma as never);
    const published = await repository.markPublished({
      id: "evt-1",
      owner: "op-1",
      brokerReference: "stub:evt-1",
      publishedAt: NOW,
    });
    expect(prisma.outboxMessage.updateMany).toHaveBeenCalledWith({
      where: { id: "evt-1", state: "publishing", leaseOwner: "op-1" },
      data: expect.objectContaining({
        state: "published",
        brokerReference: "stub:evt-1",
        publishedAt: NOW,
        leaseOwner: null,
      }),
    });
    expect(published).toEqual({
      eventId: "evt-1",
      brokerReference: "stub:evt-1",
    });
  });

  it("丢失租约且尚未 published 则返回 null", async () => {
    const prisma = {
      outboxMessage: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUnique: vi.fn().mockResolvedValue({
          eventId: "evt-1",
          state: "publishing",
          brokerReference: null,
        }),
      },
    };
    const repository = new PrismaOutboxRepository(prisma as never);
    await expect(
      repository.markPublished({
        id: "evt-1",
        owner: "op-1",
        brokerReference: "stub:evt-1",
        publishedAt: NOW,
      }),
    ).resolves.toBeNull();
  });

  it("失败裁决只更新本人持有的 publishing 行", async () => {
    const prisma = {
      outboxMessage: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          eventId: "evt-1",
          state: "retry_wait",
        }),
      },
    };
    const repository = new PrismaOutboxRepository(prisma as never);
    const marked = await repository.markDeliveryFailed({
      id: "evt-1",
      owner: "op-1",
      decision: {
        state: "retry_wait",
        nextAttemptAt: new Date("2026-09-13T00:00:05.000Z"),
        lastErrorCode: "timeout",
        failureCategory: "transient_technical",
      },
    });
    expect(prisma.outboxMessage.updateMany).toHaveBeenCalledWith({
      where: { id: "evt-1", state: "publishing", leaseOwner: "op-1" },
      data: expect.objectContaining({
        state: "retry_wait",
        lastErrorCode: "timeout",
        leaseOwner: null,
      }),
    });
    expect(marked).toEqual({ eventId: "evt-1", state: "retry_wait" });
  });

  it("重放同事务插入新 Outbox 与 ReplayRequest", async () => {
    const tx = {
      outboxMessage: { create: vi.fn().mockResolvedValue({}) },
      outboxReplayRequest: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<void>) =>
        fn(tx),
      ),
    };
    const repository = new PrismaOutboxRepository(prisma as never);
    await repository.insertReplay({
      replay: {
        id: "evt-replay",
        tenantId: "t1",
        ownerModule: "lifecycle-control",
        eventId: "evt-replay",
        eventType: "stuffed",
        eventVersion: 1,
        aggregateType: "container",
        aggregateId: "c1",
        payloadRef: "canonical-event/evt-1",
        payloadHash: "a".repeat(64),
        causationId: "evt-1",
        state: "pending",
        attemptCount: 0,
        occurredAt: NOW,
        idempotencyKey: "replay:dl-1:replay-1",
        traceId: "trace-new",
      },
      request: {
        tenantId: "t1",
        deadLetterId: "dl-1",
        replayedOutboxId: "evt-replay",
        targetConsumerVersion: "consumer-v1",
        requestedBy: "op-1",
        reasonCode: "manual_replay",
        requestedAt: NOW,
        traceId: "trace-new",
        idempotencyKey: "replay-1",
        requestHash: "d".repeat(64),
      },
    });
    expect(tx.outboxMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "evt-replay",
        eventId: "evt-replay",
        causationId: "evt-1",
        state: "pending",
      }),
    });
    expect(tx.outboxReplayRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        deadLetterId: "dl-1",
        replayedOutboxId: "evt-replay",
        requestedBy: "op-1",
      }),
    });
  });

  it("列死信按租户与 deadLetteredAt desc 查询", async () => {
    const prisma = {
      outboxMessage: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "dl-1",
            eventId: "evt-1",
            eventType: "stuffed",
            aggregateType: "container",
            aggregateId: "c1",
            payloadRef: "canonical-event/evt-1",
            payloadHash: "a".repeat(64),
            attemptCount: 3,
            lastErrorCode: "unknown_code",
            failureCategory: "unknown_code",
            ownerQueue: "lifecycle-control-outbox",
            deadLetteredAt: NOW,
            occurredAt: NOW,
            causationId: null,
            traceId: "trace-1",
          },
        ]),
      },
    };
    const repository = new PrismaOutboxRepository(prisma as never);
    const rows = await repository.listDeadLetters({
      tenantId: "t1",
      ownerModule: "lifecycle-control",
      take: 51,
    });
    expect(prisma.outboxMessage.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "t1",
        ownerModule: "lifecycle-control",
        state: "dead_letter",
        deadLetteredAt: { not: null },
      },
      orderBy: [{ deadLetteredAt: "desc" }, { id: "desc" }],
      take: 51,
    });
    expect(rows[0]).toMatchObject({ id: "dl-1", eventId: "evt-1" });
  });

  it("到期租户查询不带调用方 tenant_id", async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ tenant_id: "t1" }, { tenant_id: "t2" }]),
    };
    const repository = new PrismaOutboxRepository(prisma as never);
    const tenants = await repository.listDueTenantIds({
      ownerModule: "lifecycle-control",
      now: NOW,
      take: 21,
    });
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(tenants).toEqual(["t1", "t2"]);
  });
});
