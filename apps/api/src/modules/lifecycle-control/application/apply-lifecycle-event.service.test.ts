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

describe("ApplyLifecycleEventService", () => {
  it("sailing 推进 in_transit，但不完成节点", async () => {
    const repository = buildRepository("shipped");
    const applyContainerRecord = {
      execute: vi
        .fn()
        .mockResolvedValue({ containerRecordId: "c1", created: false }),
    };
    const service = await buildService(repository, applyContainerRecord);

    const result = await service.execute({
      containerId: "c1",
      eventCode: "sailing",
      occurredAt: new Date(),
    });

    expect(result.completedNodes).toEqual([]);
    expect(result.resultingStatus).toBe("in_transit");
    expect(applyContainerRecord.execute).toHaveBeenCalled();
  });

  it("回退事件（loaded 在 in_transit）→ 状态单调拦截，不推进", async () => {
    const repository = buildRepository("in_transit");
    const applyContainerRecord = {
      execute: vi
        .fn()
        .mockResolvedValue({ containerRecordId: "c1", created: false }),
    };
    const service = await buildService(repository, applyContainerRecord);

    const result = await service.execute({
      containerId: "c1",
      eventCode: "loaded",
      occurredAt: new Date(),
    });

    expect(result.resultingStatus).toBe(null);
    expect(applyContainerRecord.execute).not.toHaveBeenCalled();
  });
});
