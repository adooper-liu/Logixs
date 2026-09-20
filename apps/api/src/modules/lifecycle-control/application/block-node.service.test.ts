import { describe, expect, it, vi } from "vitest";
import type { LifecycleDateFactRecord } from "../domain/lifecycle-date-fact";
import type {
  NodeBlockRecord,
  NodeBlockRepository,
} from "../domain/node-block.repository";
import { BlockNodeService, type BlockNodeInput } from "./block-node.service";

describe("BlockNodeService", () => {
  it("用合格异常事实阻断当前节点", async () => {
    const repository = repositoryMock();
    const service = new BlockNodeService(repository, {
      findById: vi.fn().mockResolvedValue(sourceFact()),
    } as never);

    await expect(service.execute(command())).resolves.toEqual({
      blockId: IDS.block,
      flowInstanceId: IDS.flow,
      nodeInstanceId: IDS.node,
      state: "active",
      applied: true,
      version: 4,
    });
    expect(repository.createBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceFactId: IDS.fact,
        expectedVersion: 3,
      }),
    );
  });

  it("普通里程碑事实不能伪装成阻断来源", async () => {
    const repository = repositoryMock();
    const service = new BlockNodeService(repository, {
      findById: vi.fn().mockResolvedValue({
        ...sourceFact(),
        eventCode: "container_customs_completed",
      }),
    } as never);

    await expect(service.execute(command())).rejects.toThrow(
      "NODE_BLOCK_SOURCE_FACT_NOT_EXCEPTION",
    );
    expect(repository.createBlock).not.toHaveBeenCalled();
  });

  it("同一幂等键异载荷明确冲突", async () => {
    const repository = repositoryMock({
      findBlockByIdempotencyKey: vi
        .fn()
        .mockResolvedValue(blockRecord({ blockType: "carrier_hold" })),
    });
    const service = new BlockNodeService(repository, {
      findById: vi.fn(),
    } as never);

    await expect(service.execute(command())).rejects.toThrow(
      "IDEMPOTENCY_CONFLICT",
    );
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
};

function command(): BlockNodeInput {
  return {
    tenantId: IDS.tenant,
    actorId: IDS.actor,
    flowInstanceId: IDS.flow,
    blockId: IDS.block,
    blockType: "inspection",
    sourceFactId: IDS.fact,
    occurredAt: "2026-09-20T01:00:00Z",
    nodeInstanceId: IDS.node,
    expectedVersion: 3,
    idempotencyKey: "block-key-1",
    traceId: "trace-1",
  };
}

function repositoryMock(
  overrides: Partial<
    Record<keyof NodeBlockRepository, ReturnType<typeof vi.fn>>
  > = {},
): NodeBlockRepository {
  return {
    findFlowContext: vi.fn().mockResolvedValue({
      tenantId: IDS.tenant,
      containerId: IDS.container,
      flowInstanceId: IDS.flow,
      flowState: "active",
      currentNodeCode: "customs_clearance",
      version: 3,
      nodeInstanceId: IDS.node,
      nodeCode: "customs_clearance",
      nodeState: "active",
    }),
    findBlockById: vi.fn().mockResolvedValue(null),
    findBlockByIdempotencyKey: vi.fn().mockResolvedValue(null),
    findResolutionByIdempotencyKey: vi.fn().mockResolvedValue(null),
    createBlock: vi.fn().mockResolvedValue({ version: 4 }),
    resolveBlock: vi.fn(),
    ...overrides,
  } as NodeBlockRepository;
}

function sourceFact(): LifecycleDateFactRecord {
  return {
    id: IDS.fact,
    tenantId: IDS.tenant,
    containerId: IDS.container,
    nodeCode: "customs_clearance",
    eventCode: "inspection",
    timeKind: "actual",
    occurredAt: new Date("2026-09-20T01:00:00Z"),
    rawValue: "2026-09-20T01:00:00Z",
    sourceUtcOffset: "+00:00",
    ingestionChannel: "manual_ui",
    captureSource: "manual_backfill",
    sourceSystem: "logix",
    authoritySystem: "customs",
    provider: null,
    interfaceCode: null,
    sourceEventId: null,
    mappingVersion: null,
    verificationState: "verified",
    confidenceState: "confirmed",
    validity: "effective",
    authorityPolicyRef: "customs-inspection-v1",
    location: null,
    evidenceRefs: [],
    actorId: IDS.actor,
    reasonCode: "inspection_notice",
    idempotencyKey: "fact-key",
    payloadHash: "hash",
    supersedesFactId: null,
    isCurrent: true,
    applicationState: "pending_application",
    applicationReasonCode: null,
    canonicalEventId: null,
    projectionVersion: 1,
    traceId: "trace-1",
    receivedAt: new Date("2026-09-20T01:00:01Z"),
    recordedAt: new Date("2026-09-20T01:00:01Z"),
  };
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
