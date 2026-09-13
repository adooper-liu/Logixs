import { describe, expect, it, vi } from "vitest";
import { PrismaLifecycleRepository } from "./prisma-lifecycle.repository";

const EVENT = {
  id: "",
  containerId: "c1",
  tenantId: "t1",
  eventCode: "stuffed" as const,
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
