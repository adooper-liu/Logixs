import { describe, expect, it, vi } from "vitest";
import { PrismaInboxRepository } from "./prisma-inbox.repository";

const NOW = new Date("2026-09-13T00:00:00.000Z");

describe("PrismaInboxRepository", () => {
  it("按消费者与 messageId 查找", async () => {
    const prisma = {
      inboxMessage: {
        findUnique: vi.fn().mockResolvedValue({
          id: "in-1",
          tenantId: "t1",
          consumerName: "lifecycle-control-inbox",
          messageId: "11111111-1111-4111-8111-111111111111",
          payloadHash: "a".repeat(64),
          state: "received",
          attemptCount: 0,
          traceId: "trace-1",
          receivedAt: NOW,
        }),
      },
    };
    const repository = new PrismaInboxRepository(prisma as never);
    const found = await repository.findByConsumerMessage({
      consumerName: "lifecycle-control-inbox",
      messageId: "11111111-1111-4111-8111-111111111111",
    });
    expect(prisma.inboxMessage.findUnique).toHaveBeenCalledWith({
      where: {
        consumerName_messageId: {
          consumerName: "lifecycle-control-inbox",
          messageId: "11111111-1111-4111-8111-111111111111",
        },
      },
    });
    expect(found?.state).toBe("received");
  });

  it("插入 received 行", async () => {
    const prisma = {
      inboxMessage: { create: vi.fn().mockResolvedValue({}) },
    };
    const repository = new PrismaInboxRepository(prisma as never);
    await repository.insertReceived({
      id: "in-1",
      tenantId: "t1",
      consumerName: "lifecycle-control-inbox",
      messageId: "11111111-1111-4111-8111-111111111111",
      payloadHash: "a".repeat(64),
      payloadJson: { containerId: "c1" },
      causationId: null,
      state: "received",
      attemptCount: 0,
      traceId: "trace-1",
      receivedAt: NOW,
    });
    expect(prisma.inboxMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "in-1",
        state: "received",
        messageId: "11111111-1111-4111-8111-111111111111",
      }),
    });
  });

  it("领取后把 SQL 行映射为 processing 租约", async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: "in-1",
          tenant_id: "t1",
          consumer_name: "lifecycle-control-inbox",
          message_id: "11111111-1111-4111-8111-111111111111",
          payload_hash: "a".repeat(64),
          payload_json: { containerId: "c1" },
          state: "processing",
          attempt_count: 1,
          locked_by: "service:logix-outbox-publisher",
          locked_at: NOW,
          lease_expires_at: new Date("2026-09-13T00:00:30.000Z"),
          trace_id: "trace-1",
          received_at: NOW,
        },
      ]),
    };
    const repository = new PrismaInboxRepository(prisma as never);
    const claimed = await repository.claimBatch({
      tenantId: "t1",
      consumerName: "lifecycle-control-inbox",
      owner: "service:logix-outbox-publisher",
      now: NOW,
      limit: 10,
      leaseSeconds: 30,
    });
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(claimed).toEqual([
      expect.objectContaining({
        id: "in-1",
        messageId: "11111111-1111-4111-8111-111111111111",
        state: "processing",
        attemptCount: 1,
        lease: {
          owner: "service:logix-outbox-publisher",
          lockedAt: NOW,
          expiresAt: new Date("2026-09-13T00:00:30.000Z"),
        },
      }),
    ]);
  });

  it("仅更新仍由本人持有的 processing 行", async () => {
    const prisma = {
      inboxMessage: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          messageId: "11111111-1111-4111-8111-111111111111",
          state: "processed",
          processedAt: NOW,
        }),
      },
    };
    const repository = new PrismaInboxRepository(prisma as never);
    const processed = await repository.markProcessed({
      id: "in-1",
      owner: "service:logix-outbox-publisher",
      processedAt: NOW,
    });
    expect(prisma.inboxMessage.updateMany).toHaveBeenCalledWith({
      where: {
        id: "in-1",
        state: "processing",
        leaseOwner: "service:logix-outbox-publisher",
      },
      data: expect.objectContaining({
        state: "processed",
        processedAt: NOW,
        leaseOwner: null,
      }),
    });
    expect(processed).toEqual({
      messageId: "11111111-1111-4111-8111-111111111111",
      processedAt: NOW,
    });
  });

  it("丢失租约且尚未 processed 则返回 null", async () => {
    const prisma = {
      inboxMessage: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUnique: vi.fn().mockResolvedValue({
          messageId: "11111111-1111-4111-8111-111111111111",
          state: "processing",
          processedAt: null,
        }),
      },
    };
    const repository = new PrismaInboxRepository(prisma as never);
    const processed = await repository.markProcessed({
      id: "in-1",
      owner: "service:other",
      processedAt: NOW,
    });
    expect(processed).toBeNull();
  });

  it("列死信只返回引用，不读载荷正文", async () => {
    const prisma = {
      inboxMessage: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "in-1",
            messageId: "11111111-1111-4111-8111-111111111111",
            consumerName: "lifecycle-control-inbox",
            payloadHash: "a".repeat(64),
            attemptCount: 3,
            lastErrorCode: "timeout",
            failureCategory: "transient_technical",
            ownerQueue: "lifecycle-control-inbox",
            deadLetteredAt: NOW,
            receivedAt: NOW,
            causationId: null,
            traceId: "trace-1",
          },
        ]),
      },
    };
    const repository = new PrismaInboxRepository(prisma as never);
    const items = await repository.listDeadLetters({
      tenantId: "t1",
      consumerName: "lifecycle-control-inbox",
      take: 50,
    });
    expect(prisma.inboxMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "t1",
          state: "dead_letter",
        }),
      }),
    );
    expect(items).toEqual([
      expect.objectContaining({
        id: "in-1",
        payloadRef: "inbox/in-1",
      }),
    ]);
    expect(items[0]).not.toHaveProperty("payloadJson");
  });

  it("重放同事务插入新 received 与 replay 记录", async () => {
    const inboxMessageCreate = vi.fn();
    const replayCreate = vi.fn();
    const prisma = {
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
        await fn({
          inboxMessage: { create: inboxMessageCreate },
          inboxReplayRequest: { create: replayCreate },
        });
      }),
    };
    const repository = new PrismaInboxRepository(prisma as never);
    await repository.insertReplay({
      replay: {
        id: "in-2",
        tenantId: "t1",
        consumerName: "lifecycle-control-inbox",
        messageId: "44444444-4444-4444-8444-444444444444",
        payloadHash: "a".repeat(64),
        payloadJson: { containerId: "c1" },
        causationId: "11111111-1111-4111-8111-111111111111",
        state: "received",
        attemptCount: 0,
        traceId: "trace-new",
        receivedAt: NOW,
      },
      request: {
        tenantId: "t1",
        deadLetterId: "in-1",
        replayedInboxId: "in-2",
        replayedMessageId: "44444444-4444-4444-8444-444444444444",
        targetConsumerVersion: "consumer-v1",
        requestedBy: "op-1",
        reasonCode: "manual_replay",
        requestedAt: NOW,
        traceId: "trace-new",
        idempotencyKey: "replay-1",
        requestHash: "b".repeat(64),
      },
    });
    expect(inboxMessageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "in-2",
        state: "received",
        causationId: "11111111-1111-4111-8111-111111111111",
      }),
    });
    expect(replayCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        deadLetterId: "in-1",
        replayedInboxId: "in-2",
      }),
    });
  });
});
