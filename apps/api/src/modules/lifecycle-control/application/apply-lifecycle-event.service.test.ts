import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { ApplyContainerRecordService } from "../../shipment-registry";
import { LIFECYCLE_REPOSITORY } from "../domain/lifecycle.repository";
import { ApplyLifecycleEventService } from "./apply-lifecycle-event.service";

function buildRepository(currentStatus: string) {
  return {
    findContainerBase: vi.fn().mockResolvedValue({
      tenantId: "t1",
      orderNumber: "SO-1",
      containerNumber: "MSKU1",
      currentStatus,
    }),
    ensureFlow: vi.fn().mockResolvedValue({
      flow: {
        id: "f1",
        containerId: "c1",
        state: "active",
        currentNodeCode: "cargo_ready",
      },
      nodes: [],
    }),
    completeNodes: vi.fn().mockResolvedValue(undefined),
    updateCurrentNode: vi.fn().mockResolvedValue(undefined),
    findEventByIdempotencyKey: vi.fn().mockResolvedValue(null),
    findLatestEventTime: vi.fn().mockResolvedValue(null),
    saveEvent: vi.fn().mockResolvedValue(undefined),
  };
}

async function buildService(
  repository: ReturnType<typeof buildRepository>,
  applyContainerRecord: { execute: ReturnType<typeof vi.fn> },
) {
  const module = await Test.createTestingModule({
    providers: [
      ApplyLifecycleEventService,
      { provide: LIFECYCLE_REPOSITORY, useValue: repository },
      { provide: ApplyContainerRecordService, useValue: applyContainerRecord },
    ],
  }).compile();
  return module.get(ApplyLifecycleEventService);
}

function baseInput() {
  return {
    containerId: "c1",
    eventCode: "sailing" as const,
    occurredAt: new Date("2026-09-12T10:00:00Z"),
    idempotencyKey: "key-1",
  };
}

describe("ApplyLifecycleEventService", () => {
  it("sailing 推进 in_transit，但不完成节点", async () => {
    const repository = buildRepository("shipped");
    const applyContainerRecord = {
      execute: vi
        .fn()
        .mockResolvedValue({ containerRecordId: "c1", created: false }),
    };
    const service = await buildService(repository, applyContainerRecord);

    const result = await service.execute(baseInput());

    expect(result.completedNodes).toEqual([]);
    expect(result.resultingStatus).toBe("in_transit");
    expect(result.applied).toBe(true);
    expect(repository.saveEvent).toHaveBeenCalled();
  });

  it("回退事件（loaded 在 in_transit）→ 状态单调拦截", async () => {
    const repository = buildRepository("in_transit");
    const applyContainerRecord = {
      execute: vi
        .fn()
        .mockResolvedValue({ containerRecordId: "c1", created: false }),
    };
    const service = await buildService(repository, applyContainerRecord);

    const result = await service.execute({
      ...baseInput(),
      eventCode: "loaded",
    });

    expect(result.resultingStatus).toBe(null);
    expect(applyContainerRecord.execute).not.toHaveBeenCalled();
  });

  it("同 idempotencyKey → 幂等命中，不重复应用", async () => {
    const repository = buildRepository("shipped");
    repository.findEventByIdempotencyKey.mockResolvedValue({
      id: "e1",
      containerId: "c1",
      eventCode: "sailing",
      occurredAt: new Date("2026-09-12T10:00:00Z"),
      idempotencyKey: "key-1",
    });
    const applyContainerRecord = { execute: vi.fn() };
    const service = await buildService(repository, applyContainerRecord);

    const result = await service.execute(baseInput());

    expect(result.applied).toBe(false);
    expect(applyContainerRecord.execute).not.toHaveBeenCalled();
  });

  it("乱序事件（occurredAt 早于最晚）→ R1 时间单调拒绝", async () => {
    const repository = buildRepository("shipped");
    repository.findLatestEventTime.mockResolvedValue(
      new Date("2026-09-12T11:00:00Z"),
    );
    const applyContainerRecord = { execute: vi.fn() };
    const service = await buildService(repository, applyContainerRecord);

    await expect(service.execute(baseInput())).rejects.toThrow(
      "TIME_ORDER_CONFLICT",
    );
  });
});
