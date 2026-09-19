import { describe, expect, it, vi } from "vitest";
import type {
  NodeBlockRecord,
  NodeBlockRepository,
} from "../domain/node-block.repository";
import {
  ResolveNodeBlockService,
  type ResolveNodeBlockInput,
} from "./resolve-node-block.service";

describe("ResolveNodeBlockService", () => {
  it("解除最后一个阻断后自动重放待应用日期事实", async () => {
    const repository = repositoryMock();
    const replay = { execute: vi.fn().mockResolvedValue({ applied: 1 }) };
    const service = new ResolveNodeBlockService(repository, replay as never);

    await expect(service.execute(command())).resolves.toEqual({
      blockId: IDS.block,
      flowInstanceId: IDS.flow,
      nodeInstanceId: IDS.node,
      resolved: true,
      nodeUnblocked: true,
      applied: true,
      version: 5,
    });
    expect(replay.execute).toHaveBeenCalledWith({
      tenantId: IDS.tenant,
      containerId: IDS.container,
    });
  });

  it("仍有其他阻断时不重放也不恢复节点", async () => {
    const repository = repositoryMock({
      resolveBlock: vi.fn().mockResolvedValue({
        version: 5,
        nodeUnblocked: false,
      }),
    });
    const replay = { execute: vi.fn() };
    const service = new ResolveNodeBlockService(repository, replay as never);

    await expect(service.execute(command())).resolves.toMatchObject({
      nodeUnblocked: false,
      applied: true,
    });
    expect(replay.execute).not.toHaveBeenCalled();
  });

  it("解除时间早于阻断时间时拒绝", async () => {
    const repository = repositoryMock();
    const service = new ResolveNodeBlockService(repository, {
      execute: vi.fn(),
    } as never);

    await expect(
      service.execute({
        ...command(),
        resolvedAt: "2026-09-20T00:59:59Z",
      }),
    ).rejects.toThrow("NODE_BLOCK_RESOLUTION_TIME_CONFLICT");
    expect(repository.resolveBlock).not.toHaveBeenCalled();
  });

  it("未知数据库错误不泄露内部信息", async () => {
    const repository = repositoryMock({
      resolveBlock: vi.fn().mockRejectedValue(new Error("SQL secret detail")),
    });
    const service = new ResolveNodeBlockService(repository, {
      execute: vi.fn(),
    } as never);

    await expect(service.execute(command())).rejects.toThrow(
      "NODE_BLOCK_RESOLVE_FAILED",
    );
  });
});

const IDS = {
  tenant: "11111111-1111-4111-8111-111111111111",
  actor: "22222222-2222-4222-8222-222222222222",
  flow: "33333333-3333-4333-8333-333333333333",
  block: "44444444-4444-4444-8444-444444444444",
  node: "66666666-6666-4666-8666-666666666666",
  container: "77777777-7777-4777-8777-777777777777",
  fact: "88888888-8888-4888-8888-888888888888",
};

function command(): ResolveNodeBlockInput {
  return {
    tenantId: IDS.tenant,
    actorId: IDS.actor,
    flowInstanceId: IDS.flow,
    blockId: IDS.block,
    resolvedAt: "2026-09-20T02:00:00Z",
    reasonCode: "customs_released",
    expectedVersion: 4,
    idempotencyKey: "resolve-key-1",
    traceId: "trace-2",
  };
}

function repositoryMock(
  overrides: Partial<
    Record<keyof NodeBlockRepository, ReturnType<typeof vi.fn>>
  > = {},
): NodeBlockRepository {
  return {
    findFlowContext: vi.fn(),
    findBlockById: vi.fn().mockResolvedValue(blockRecord()),
    findBlockByIdempotencyKey: vi.fn(),
    findResolutionByIdempotencyKey: vi.fn().mockResolvedValue(null),
    createBlock: vi.fn(),
    resolveBlock: vi
      .fn()
      .mockResolvedValue({ version: 5, nodeUnblocked: true }),
    ...overrides,
  } as NodeBlockRepository;
}

function blockRecord(
  overrides: Partial<NodeBlockRecord> = {},
): NodeBlockRecord {
  return {
    id: IDS.block,
    tenantId: IDS.tenant,
    flowInstanceId: IDS.flow,
    containerId: IDS.container,
    nodeInstanceId: IDS.node,
    nodeCode: "customs_clearance",
    nodeState: "blocked",
    blockType: "inspection",
    sourceFactId: IDS.fact,
    occurredAt: new Date("2026-09-20T01:00:00Z"),
    actorId: IDS.actor,
    idempotencyKey: "block-key-1",
    traceId: "trace-1",
    projectionVersion: 4,
    resolution: null,
    flowVersion: 4,
    ...overrides,
  };
}
