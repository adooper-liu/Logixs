import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { FIRST_SLICE_CLIENT_ACTION } from "../domain/client-operation";
import { encodeClientOperationCursor } from "../domain/client-operation-page";
import { CLIENT_OPERATION_REPOSITORY } from "../domain/client-operation.repository";
import { ListClientOperationsService } from "./list-client-operations.service";

function item(id: string, createdAt: string, tenantId = "t1") {
  return {
    id,
    tenantId,
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
    idempotencyKey: id,
    requestHash: "a".repeat(64),
    receptionState: "received" as const,
    businessDecisionState: "accepted" as const,
    commitState: "committed" as const,
    resultRefs: [],
    rejectionReasonCode: null,
    attemptCount: 1,
    receivedAt: new Date(createdAt),
    decidedAt: new Date(createdAt),
    committedAt: new Date(createdAt),
    createdAt: new Date(createdAt),
  };
}

async function buildService(listByTenant: ReturnType<typeof vi.fn>) {
  const module = await Test.createTestingModule({
    providers: [
      ListClientOperationsService,
      {
        provide: CLIENT_OPERATION_REPOSITORY,
        useValue: {
          findByIdempotency: vi.fn(),
          findById: vi.fn(),
          listByTenant,
          insert: vi.fn(),
        },
      },
    ],
  }).compile();
  return module.get(ListClientOperationsService);
}

describe("ListClientOperationsService", () => {
  it("缺租户拒绝", async () => {
    const listByTenant = vi.fn();
    const service = await buildService(listByTenant);
    await expect(service.execute({})).rejects.toThrow(
      "AUTHORIZATION_SCOPE_DENIED",
    );
    expect(listByTenant).not.toHaveBeenCalled();
  });

  it("非法 pageSize 拒绝", async () => {
    const listByTenant = vi.fn();
    const service = await buildService(listByTenant);
    await expect(
      service.execute({ tenantId: "t1", pageSize: "201" }),
    ).rejects.toThrow("VALIDATION_FORMAT");
    expect(listByTenant).not.toHaveBeenCalled();
  });

  it("cursor 租户不一致拒绝", async () => {
    const listByTenant = vi.fn();
    const service = await buildService(listByTenant);
    const cursor = encodeClientOperationCursor({
      tenantId: "other",
      createdAt: new Date("2026-09-13T03:00:00.000Z"),
      id: "op-1",
    });
    await expect(service.execute({ tenantId: "t1", cursor })).rejects.toThrow(
      "VALIDATION_FORMAT",
    );
    expect(listByTenant).not.toHaveBeenCalled();
  });

  it("损坏 cursor 拒绝", async () => {
    const listByTenant = vi.fn();
    const service = await buildService(listByTenant);
    await expect(
      service.execute({ tenantId: "t1", cursor: "not-base64" }),
    ).rejects.toThrow("VALIDATION_FORMAT");
    expect(listByTenant).not.toHaveBeenCalled();
  });

  it("按页返回并给出下一页 cursor", async () => {
    const first = item("op-1", "2026-09-13T05:00:00.000Z");
    const second = item("op-2", "2026-09-13T04:00:00.000Z");
    const third = item("op-3", "2026-09-13T03:00:00.000Z");
    const listByTenant = vi.fn().mockResolvedValue([first, second, third]);
    const service = await buildService(listByTenant);
    const page = await service.execute({ tenantId: "t1", pageSize: "2" });
    expect(page.items.map((row) => row.id)).toEqual(["op-1", "op-2"]);
    expect(page.pageInfo.hasNextPage).toBe(true);
    expect(page.pageInfo.nextCursor).toBe(
      encodeClientOperationCursor({
        tenantId: "t1",
        createdAt: second.createdAt,
        id: second.id,
      }),
    );
    expect(page.projectionVersion).toBe(0);
    expect(listByTenant).toHaveBeenCalledWith({
      tenantId: "t1",
      after: undefined,
      take: 3,
    });
  });

  it("末页不给 cursor", async () => {
    const first = item("op-1", "2026-09-13T05:00:00.000Z");
    const service = await buildService(vi.fn().mockResolvedValue([first]));
    const page = await service.execute({ tenantId: "t1", pageSize: "2" });
    expect(page.items).toHaveLength(1);
    expect(page.pageInfo.hasNextPage).toBe(false);
    expect(page.pageInfo.nextCursor).toBeNull();
  });
});
