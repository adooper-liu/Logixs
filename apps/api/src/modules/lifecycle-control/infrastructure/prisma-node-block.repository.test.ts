import { describe, expect, it, vi } from "vitest";
import { PrismaNodeBlockRepository } from "./prisma-node-block.repository";

describe("PrismaNodeBlockRepository", () => {
  it("同一事务追加阻断、更新版本和节点投影并写 Outbox", async () => {
    const tx = createTransaction();
    const repository = createRepository(tx);

    await expect(repository.createBlock(blockInput())).resolves.toEqual({
      version: 4,
    });
    expect(tx.nodeBlock.create).toHaveBeenCalledTimes(1);
    expect(tx.nodeInstance.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: IDS.node }),
      data: { state: "blocked" },
    });
    expect(tx.outboxMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: IDS.block,
        eventType: "lifecycle.node_blocked",
        aggregateId: IDS.container,
      }),
    });
  });

  it("解除最后一个阻断时恢复节点并写解除 Outbox", async () => {
    const tx = createTransaction({ unresolvedCount: 0 });
    const repository = createRepository(tx);

    await expect(repository.resolveBlock(resolveInput())).resolves.toEqual({
      version: 5,
      nodeUnblocked: true,
    });
    expect(tx.nodeBlockResolution.create).toHaveBeenCalledTimes(1);
    expect(tx.nodeInstance.updateMany).toHaveBeenCalledWith({
      where: { id: IDS.node, state: "blocked" },
      data: { state: "active" },
    });
    expect(tx.outboxMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "lifecycle.node_block_resolved",
        aggregateId: IDS.container,
      }),
    });
  });

  it("仍有未解除阻断时保持节点 blocked", async () => {
    const tx = createTransaction({ unresolvedCount: 1 });
    const repository = createRepository(tx);

    await expect(repository.resolveBlock(resolveInput())).resolves.toEqual({
      version: 5,
      nodeUnblocked: false,
    });
    expect(tx.nodeInstance.updateMany).not.toHaveBeenCalled();
  });

  it("版本并发冲突时不留下阻断或 Outbox", async () => {
    const tx = createTransaction({ versionUpdated: 0 });
    const repository = createRepository(tx);

    await expect(repository.createBlock(blockInput())).rejects.toThrow(
      "LIFECYCLE_VERSION_CONFLICT",
    );
    expect(tx.nodeBlock.create).not.toHaveBeenCalled();
    expect(tx.outboxMessage.create).not.toHaveBeenCalled();
  });
});

const IDS = {
  tenant: "11111111-1111-4111-8111-111111111111",
  actor: "22222222-2222-4222-8222-222222222222",
  flow: "33333333-3333-4333-8333-333333333333",
  block: "44444444-4444-4444-8444-444444444444",
  fact: "55555555-5555-4555-8555-555555555555",
  node: "66666666-6666-4666-8666-666666666666",
  container: "77777777-7777-4777-8777-777777777777",
  resolution: "88888888-8888-4888-8888-888888888888",
};

function blockInput() {
  return {
    id: IDS.block,
    tenantId: IDS.tenant,
    flowInstanceId: IDS.flow,
    containerId: IDS.container,
    nodeInstanceId: IDS.node,
    blockType: "inspection",
    sourceFactId: IDS.fact,
    occurredAt: new Date("2026-09-20T01:00:00Z"),
    actorId: IDS.actor,
    expectedVersion: 3,
    idempotencyKey: "block-key-1",
    traceId: "trace-1",
  };
}

function resolveInput() {
  return {
    resolutionId: IDS.resolution,
    tenantId: IDS.tenant,
    blockId: IDS.block,
    flowInstanceId: IDS.flow,
    containerId: IDS.container,
    nodeInstanceId: IDS.node,
    resolvedAt: new Date("2026-09-20T02:00:00Z"),
    reasonCode: "customs_released",
    actorId: IDS.actor,
    expectedVersion: 4,
    idempotencyKey: "resolve-key-1",
    traceId: "trace-2",
  };
}

function createTransaction(options?: {
  unresolvedCount?: number;
  versionUpdated?: number;
}) {
  return {
    flowInstance: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: IDS.flow,
        containerId: IDS.container,
        state: "active",
        currentNodeCode: "customs_clearance",
      }),
      updateMany: vi
        .fn()
        .mockResolvedValue({ count: options?.versionUpdated ?? 1 }),
    },
    nodeInstance: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: IDS.node,
        flowInstanceId: IDS.flow,
        nodeCode: "customs_clearance",
        state: "active",
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    lifecycleDateFact: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: IDS.fact,
        tenantId: IDS.tenant,
        containerId: IDS.container,
        nodeCode: "customs_clearance",
        occurredAt: new Date("2026-09-20T01:00:00Z"),
        timeKind: "actual",
        verificationState: "verified",
        confidenceState: "confirmed",
        validity: "effective",
        isCurrent: true,
        authorityPolicyRef: "customs-inspection-v1",
      }),
    },
    nodeBlock: {
      create: vi.fn().mockResolvedValue({ id: IDS.block }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: IDS.block,
        tenantId: IDS.tenant,
        flowInstanceId: IDS.flow,
        nodeInstanceId: IDS.node,
        occurredAt: new Date("2026-09-20T01:00:00Z"),
        resolution: null,
        node: {
          id: IDS.node,
          nodeCode: "customs_clearance",
          state: "blocked",
        },
        flow: {
          id: IDS.flow,
          containerId: IDS.container,
          currentNodeCode: "customs_clearance",
          state: "active",
        },
      }),
      count: vi.fn().mockResolvedValue(options?.unresolvedCount ?? 0),
    },
    nodeBlockResolution: {
      create: vi.fn().mockResolvedValue({ id: IDS.resolution }),
    },
    outboxMessage: {
      create: vi.fn().mockResolvedValue({ id: IDS.block }),
    },
  };
}

function createRepository(tx: ReturnType<typeof createTransaction>) {
  return new PrismaNodeBlockRepository({
    $transaction: vi.fn(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    ),
  } as never);
}
