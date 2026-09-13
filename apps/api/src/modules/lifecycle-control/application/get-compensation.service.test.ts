import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { FIRST_SLICE_COMPENSATION_ACTION } from "../domain/compensation";
import { COMPENSATION_REPOSITORY } from "../domain/compensation.repository";
import { GetCompensationService } from "./get-compensation.service";

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

async function buildService(findById: ReturnType<typeof vi.fn>) {
  const module = await Test.createTestingModule({
    providers: [
      GetCompensationService,
      {
        provide: COMPENSATION_REPOSITORY,
        useValue: {
          findByIdempotency: vi.fn(),
          findById,
          listByOriginal: vi.fn(),
          insert: vi.fn(),
          updateState: vi.fn(),
        },
      },
    ],
  }).compile();
  return module.get(GetCompensationService);
}

describe("GetCompensationService", () => {
  it("同租户同原操作可读", async () => {
    const service = await buildService(vi.fn().mockResolvedValue(RECORD));
    const record = await service.execute({
      tenantId: "t1",
      originalClientOperationId: "op-1",
      compensationId: "cmp-1",
    });
    expect(record.id).toBe("cmp-1");
  });

  it("跨租户当不存在", async () => {
    const service = await buildService(vi.fn().mockResolvedValue(RECORD));
    await expect(
      service.execute({
        tenantId: "other",
        originalClientOperationId: "op-1",
        compensationId: "cmp-1",
      }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
  });

  it("不属于该操作当不存在", async () => {
    const service = await buildService(vi.fn().mockResolvedValue(RECORD));
    await expect(
      service.execute({
        tenantId: "t1",
        originalClientOperationId: "op-other",
        compensationId: "cmp-1",
      }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
  });
});
