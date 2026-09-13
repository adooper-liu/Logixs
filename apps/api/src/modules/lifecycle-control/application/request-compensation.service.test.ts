import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { FIRST_SLICE_CLIENT_ACTION } from "../domain/client-operation";
import { CLIENT_OPERATION_REPOSITORY } from "../domain/client-operation.repository";
import {
  FIRST_SLICE_COMPENSATION_ACTION,
  hashCompensationRequest,
} from "../domain/compensation";
import { COMPENSATION_REPOSITORY } from "../domain/compensation.repository";
import { RequestCompensationService } from "./request-compensation.service";

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
  traceId: "trace-old",
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

const COMMAND = {
  originalClientOperationId: "op-1",
  tenantId: "t1",
  operatorId: "actor-1",
  reasonCode: "manual_compensate",
  idempotencyKey: "cmp-1",
};

const SAME_HASH = hashCompensationRequest({
  reasonCode: COMMAND.reasonCode,
  compensationActionCode: FIRST_SLICE_COMPENSATION_ACTION,
});

async function buildService(overrides?: {
  findById?: ReturnType<typeof vi.fn>;
  findByIdempotency?: ReturnType<typeof vi.fn>;
  insert?: ReturnType<typeof vi.fn>;
}) {
  const operations = {
    findById: overrides?.findById ?? vi.fn().mockResolvedValue(ORIGINAL),
    findByIdempotency: vi.fn(),
    insert: vi.fn(),
  };
  const compensations = {
    findByIdempotency:
      overrides?.findByIdempotency ?? vi.fn().mockResolvedValue(null),
    insert: overrides?.insert ?? vi.fn().mockResolvedValue(undefined),
  };
  const module = await Test.createTestingModule({
    providers: [
      RequestCompensationService,
      { provide: CLIENT_OPERATION_REPOSITORY, useValue: operations },
      { provide: COMPENSATION_REPOSITORY, useValue: compensations },
    ],
  }).compile();
  return {
    service: module.get(RequestCompensationService),
    operations,
    compensations,
  };
}

describe("RequestCompensationService", () => {
  it("已落账申请写入 pending，不改原操作", async () => {
    const { service, operations, compensations } = await buildService();
    const result = await service.execute(COMMAND);
    expect(result.applied).toBe(true);
    expect(result.state).toBe("pending");
    expect(result.compensationActionCode).toBe(FIRST_SLICE_COMPENSATION_ACTION);
    expect(result.compensationId).not.toBe(ORIGINAL.id);
    expect(operations.insert).not.toHaveBeenCalled();
    expect(compensations.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        originalClientOperationId: ORIGINAL.id,
        state: "pending",
      }),
    );
  });

  it("工单完成拒绝且不写库", async () => {
    const { service, compensations } = await buildService({
      findById: vi.fn().mockResolvedValue({
        ...ORIGINAL,
        actionCode: "work_execution.complete_work_order",
      }),
    });
    await expect(service.execute(COMMAND)).rejects.toThrow(
      "BUSINESS_STATE_VIOLATION",
    );
    expect(compensations.insert).not.toHaveBeenCalled();
  });

  it("未落账拒绝", async () => {
    const { service, compensations } = await buildService({
      findById: vi.fn().mockResolvedValue({
        ...ORIGINAL,
        commitState: "pending",
      }),
    });
    await expect(service.execute(COMMAND)).rejects.toThrow(
      "BUSINESS_STATE_VIOLATION",
    );
    expect(compensations.insert).not.toHaveBeenCalled();
  });

  it("同键同哈希复用", async () => {
    const { service, compensations } = await buildService({
      findByIdempotency: vi.fn().mockResolvedValue({
        id: "cmp-existing",
        tenantId: "t1",
        originalClientOperationId: ORIGINAL.id,
        compensationActionCode: FIRST_SLICE_COMPENSATION_ACTION,
        state: "pending",
        reasonCode: COMMAND.reasonCode,
        requestedBy: "actor-1",
        resultRefs: [],
        idempotencyKey: COMMAND.idempotencyKey,
        requestHash: SAME_HASH,
        traceId: "trace-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    });
    const result = await service.execute(COMMAND);
    expect(result.applied).toBe(false);
    expect(result.compensationId).toBe("cmp-existing");
    expect(compensations.insert).not.toHaveBeenCalled();
  });

  it("同键异哈希冲突", async () => {
    const { service, compensations } = await buildService({
      findByIdempotency: vi.fn().mockResolvedValue({
        id: "cmp-existing",
        tenantId: "t1",
        originalClientOperationId: ORIGINAL.id,
        compensationActionCode: FIRST_SLICE_COMPENSATION_ACTION,
        state: "pending",
        reasonCode: "other",
        requestedBy: "actor-1",
        resultRefs: [],
        idempotencyKey: COMMAND.idempotencyKey,
        requestHash: "c".repeat(64),
        traceId: "trace-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    });
    await expect(service.execute(COMMAND)).rejects.toThrow(
      "IDEMPOTENCY_CONFLICT",
    );
    expect(compensations.insert).not.toHaveBeenCalled();
  });
});
