import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { FIRST_SLICE_CLIENT_ACTION } from "../domain/client-operation";
import { CLIENT_OPERATION_REPOSITORY } from "../domain/client-operation.repository";
import { FIRST_SLICE_COMPENSATION_ACTION } from "../domain/compensation";
import { encodeCompensationCursor } from "../domain/compensation-page";
import { COMPENSATION_REPOSITORY } from "../domain/compensation.repository";
import { ListCompensationsService } from "./list-compensations.service";

const ORIGINAL = {
  id: "op-1",
  tenantId: "t1",
  actorType: "user",
  actorId: "actor-1",
  actionCode: FIRST_SLICE_CLIENT_ACTION,
  actionVersion: 1,
  targetType: "container",
  targetId: "c1",
  targetOwnerModule: "shipment-registry",
  correlationId: "corr-1",
  causationId: null,
  traceId: "trace-1",
  idempotencyKey: "op-key",
  requestHash: "a".repeat(64),
  receptionState: "received" as const,
  businessDecisionState: "accepted" as const,
  commitState: "committed" as const,
  resultRefs: [],
  rejectionReasonCode: null,
  attemptCount: 1,
  receivedAt: new Date(),
  decidedAt: new Date(),
  committedAt: new Date(),
};

function record(id: string, createdAt: string) {
  return {
    id,
    tenantId: "t1",
    originalClientOperationId: "op-1",
    compensationActionCode: FIRST_SLICE_COMPENSATION_ACTION,
    state: "pending" as const,
    reasonCode: "manual_compensate",
    requestedBy: "actor-1",
    resultRefs: [],
    idempotencyKey: id,
    requestHash: "b".repeat(64),
    traceId: "trace-1",
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
  };
}

async function buildService(overrides?: {
  findById?: ReturnType<typeof vi.fn>;
  listByOriginal?: ReturnType<typeof vi.fn>;
}) {
  const operations = {
    findById: overrides?.findById ?? vi.fn().mockResolvedValue(ORIGINAL),
    findByIdempotency: vi.fn(),
    listByTenant: vi.fn(),
    insert: vi.fn(),
  };
  const compensations = {
    findByIdempotency: vi.fn(),
    findById: vi.fn(),
    listByOriginal:
      overrides?.listByOriginal ?? vi.fn().mockResolvedValue([]),
    insert: vi.fn(),
    updateState: vi.fn(),
  };
  const module = await Test.createTestingModule({
    providers: [
      ListCompensationsService,
      { provide: CLIENT_OPERATION_REPOSITORY, useValue: operations },
      { provide: COMPENSATION_REPOSITORY, useValue: compensations },
    ],
  }).compile();
  return {
    service: module.get(ListCompensationsService),
    compensations,
  };
}

describe("ListCompensationsService", () => {
  it("原操作不存在 → 404", async () => {
    const { service, compensations } = await buildService({
      findById: vi.fn().mockResolvedValue(null),
    });
    await expect(
      service.execute({ tenantId: "t1", originalClientOperationId: "op-1" }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
    expect(compensations.listByOriginal).not.toHaveBeenCalled();
  });

  it("cursor 与原操作不一致拒绝", async () => {
    const { service, compensations } = await buildService();
    const cursor = encodeCompensationCursor({
      tenantId: "t1",
      originalClientOperationId: "op-other",
      createdAt: new Date("2026-09-13T03:00:00.000Z"),
      id: "cmp-1",
    });
    await expect(
      service.execute({
        tenantId: "t1",
        originalClientOperationId: "op-1",
        cursor,
      }),
    ).rejects.toThrow("VALIDATION_FORMAT");
    expect(compensations.listByOriginal).not.toHaveBeenCalled();
  });

  it("跨租户原操作当不存在", async () => {
    const { service, compensations } = await buildService({
      findById: vi.fn().mockResolvedValue({ ...ORIGINAL, tenantId: "other" }),
    });
    await expect(
      service.execute({ tenantId: "t1", originalClientOperationId: "op-1" }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
    expect(compensations.listByOriginal).not.toHaveBeenCalled();
  });

  it("cursor 租户不一致拒绝", async () => {
    const { service, compensations } = await buildService();
    const cursor = encodeCompensationCursor({
      tenantId: "other",
      originalClientOperationId: "op-1",
      createdAt: new Date("2026-09-13T03:00:00.000Z"),
      id: "cmp-1",
    });
    await expect(
      service.execute({
        tenantId: "t1",
        originalClientOperationId: "op-1",
        cursor,
      }),
    ).rejects.toThrow("VALIDATION_FORMAT");
    expect(compensations.listByOriginal).not.toHaveBeenCalled();
  });

  it("损坏 cursor 拒绝", async () => {
    const { service, compensations } = await buildService();
    await expect(
      service.execute({
        tenantId: "t1",
        originalClientOperationId: "op-1",
        cursor: "not-base64",
      }),
    ).rejects.toThrow("VALIDATION_FORMAT");
    expect(compensations.listByOriginal).not.toHaveBeenCalled();
  });

  it("非法 pageSize 拒绝", async () => {
    const { service, compensations } = await buildService();
    await expect(
      service.execute({
        tenantId: "t1",
        originalClientOperationId: "op-1",
        pageSize: "201",
      }),
    ).rejects.toThrow("VALIDATION_FORMAT");
    expect(compensations.listByOriginal).not.toHaveBeenCalled();
  });

  it("末页不给 cursor", async () => {
    const first = record("cmp-1", "2026-09-13T03:00:00.000Z");
    const { service } = await buildService({
      listByOriginal: vi.fn().mockResolvedValue([first]),
    });
    const page = await service.execute({
      tenantId: "t1",
      originalClientOperationId: "op-1",
      pageSize: "2",
    });
    expect(page.items).toHaveLength(1);
    expect(page.pageInfo.hasNextPage).toBe(false);
    expect(page.pageInfo.nextCursor).toBeNull();
    expect(page.projectionVersion).toBe(0);
  });

  it("按页返回并给出下一页 cursor", async () => {
    const first = record("cmp-1", "2026-09-13T03:00:00.000Z");
    const second = record("cmp-2", "2026-09-13T04:00:00.000Z");
    const third = record("cmp-3", "2026-09-13T05:00:00.000Z");
    const { service, compensations } = await buildService({
      listByOriginal: vi.fn().mockResolvedValue([first, second, third]),
    });
    const page = await service.execute({
      tenantId: "t1",
      originalClientOperationId: "op-1",
      pageSize: "2",
    });
    expect(page.items.map((item) => item.id)).toEqual(["cmp-1", "cmp-2"]);
    expect(page.pageInfo.hasNextPage).toBe(true);
    expect(page.pageInfo.nextCursor).toBe(
      encodeCompensationCursor({
        tenantId: "t1",
        originalClientOperationId: "op-1",
        createdAt: second.createdAt,
        id: second.id,
      }),
    );
    expect(compensations.listByOriginal).toHaveBeenCalledWith({
      tenantId: "t1",
      originalClientOperationId: "op-1",
      after: undefined,
      take: 3,
    });
  });
});
