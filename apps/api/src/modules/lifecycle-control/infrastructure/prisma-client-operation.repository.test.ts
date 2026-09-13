import { describe, expect, it, vi } from "vitest";
import { PrismaClientOperationRepository } from "./prisma-client-operation.repository";

const NOW = new Date("2026-09-13T03:00:00.000Z");

describe("PrismaClientOperationRepository", () => {
  it("按租户与 createdAt desc 列操作", async () => {
    const prisma = {
      clientOperation: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "op-1",
            tenantId: "t1",
            actorType: "user",
            actorId: "actor-1",
            actionCode: "lifecycle.apply_event",
            actionVersion: 1,
            targetType: "container",
            targetId: "c1",
            targetOwnerModule: "shipment-registry",
            correlationId: "corr-1",
            causationId: null,
            traceId: "trace-1",
            idempotencyKey: "op-1",
            requestHash: "a".repeat(64),
            receptionState: "received",
            businessDecisionState: "accepted",
            commitState: "committed",
            resultRefs: [],
            rejectionReasonCode: null,
            attemptCount: 1,
            receivedAt: NOW,
            decidedAt: NOW,
            committedAt: NOW,
            createdAt: NOW,
          },
        ]),
      },
    };
    const repository = new PrismaClientOperationRepository(prisma as never);
    const rows = await repository.listByTenant({
      tenantId: "t1",
      take: 51,
    });
    expect(prisma.clientOperation.findMany).toHaveBeenCalledWith({
      where: { tenantId: "t1" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 51,
    });
    expect(rows[0]).toMatchObject({
      id: "op-1",
      createdAt: NOW,
      targetId: "c1",
    });
  });
});
