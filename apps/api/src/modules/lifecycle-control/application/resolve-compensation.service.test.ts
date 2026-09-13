import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { FIRST_SLICE_COMPENSATION_ACTION } from "../domain/compensation";
import { COMPENSATION_REPOSITORY } from "../domain/compensation.repository";
import { ResolveCompensationService } from "./resolve-compensation.service";

const RECORD = {
  id: "cmp-1",
  tenantId: "t1",
  originalClientOperationId: "op-1",
  compensationActionCode: FIRST_SLICE_COMPENSATION_ACTION,
  state: "pending" as const,
  reasonCode: "manual_compensate",
  requestedBy: "actor-1",
  resultRefs: [],
  idempotencyKey: "cmp-1",
  requestHash: "a".repeat(64),
  traceId: "trace-1",
  createdAt: new Date("2026-09-13T03:00:00.000Z"),
  updatedAt: new Date("2026-09-13T03:00:00.000Z"),
};

const COMMAND = {
  originalClientOperationId: "op-1",
  compensationId: "cmp-1",
  tenantId: "t1",
  state: "compensated",
};

async function buildService(overrides?: {
  findById?: ReturnType<typeof vi.fn>;
  updateState?: ReturnType<typeof vi.fn>;
}) {
  const compensations = {
    findByIdempotency: vi.fn(),
    findById: overrides?.findById ?? vi.fn().mockResolvedValue(RECORD),
    insert: vi.fn(),
    updateState: overrides?.updateState ?? vi.fn().mockResolvedValue(undefined),
  };
  const module = await Test.createTestingModule({
    providers: [
      ResolveCompensationService,
      { provide: COMPENSATION_REPOSITORY, useValue: compensations },
    ],
  }).compile();
  return {
    service: module.get(ResolveCompensationService),
    compensations,
  };
}

describe("ResolveCompensationService", () => {
  it("pending 推进到 compensated", async () => {
    const { service, compensations } = await buildService();
    const result = await service.execute(COMMAND);
    expect(result.applied).toBe(true);
    expect(result.state).toBe("compensated");
    expect(compensations.updateState).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "cmp-1",
        originalClientOperationId: "op-1",
        state: "compensated",
      }),
    );
  });

  it("同态重放不写库", async () => {
    const { service, compensations } = await buildService({
      findById: vi.fn().mockResolvedValue({ ...RECORD, state: "compensated" }),
    });
    const result = await service.execute(COMMAND);
    expect(result.applied).toBe(false);
    expect(result.state).toBe("compensated");
    expect(compensations.updateState).not.toHaveBeenCalled();
  });

  it("终态再改拒绝", async () => {
    const { service, compensations } = await buildService({
      findById: vi.fn().mockResolvedValue({ ...RECORD, state: "compensated" }),
    });
    await expect(
      service.execute({ ...COMMAND, state: "failed" }),
    ).rejects.toThrow("BUSINESS_STATE_VIOLATION");
    expect(compensations.updateState).not.toHaveBeenCalled();
  });

  it("failed 可进人工复核", async () => {
    const { service } = await buildService({
      findById: vi.fn().mockResolvedValue({ ...RECORD, state: "failed" }),
    });
    const result = await service.execute({
      ...COMMAND,
      state: "manual_review",
    });
    expect(result.applied).toBe(true);
    expect(result.state).toBe("manual_review");
  });

  it("路径操作不匹配拒绝", async () => {
    const { service, compensations } = await buildService();
    await expect(
      service.execute({ ...COMMAND, originalClientOperationId: "op-other" }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
    expect(compensations.updateState).not.toHaveBeenCalled();
  });
});
