import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { DrainDueOutboxService } from "./drain-due-outbox.service";
import { PublishOutboxBatchService } from "./publish-outbox-batch.service";

function batch(claimed: number) {
  return {
    claimed,
    published: claimed,
    retryWait: 0,
    deadLetter: 0,
    leftover: 0,
    items: [],
  };
}

async function buildService(execute: ReturnType<typeof vi.fn>) {
  const module = await Test.createTestingModule({
    providers: [
      DrainDueOutboxService,
      { provide: PublishOutboxBatchService, useValue: { execute } },
    ],
  }).compile();
  return module.get(DrainDueOutboxService);
}

describe("DrainDueOutboxService", () => {
  it("循环到某轮无人可领", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce(batch(2))
      .mockResolvedValueOnce(batch(0));
    const service = await buildService(execute);
    const result = await service.execute({
      tenantId: "t1",
      operatorId: "op-1",
    });
    expect(execute).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      rounds: 2,
      emptied: true,
      claimed: 2,
      published: 2,
      retryWait: 0,
      deadLetter: 0,
      leftover: 0,
    });
  });

  it("达到 maxRounds 且仍有领取则未排空", async () => {
    const execute = vi.fn().mockResolvedValue(batch(1));
    const service = await buildService(execute);
    const result = await service.execute({
      tenantId: "t1",
      operatorId: "op-1",
      maxRounds: 2,
    });
    expect(execute).toHaveBeenCalledTimes(2);
    expect(result.rounds).toBe(2);
    expect(result.emptied).toBe(false);
    expect(result.claimed).toBe(2);
  });

  it("非法 maxRounds 拒绝且不发布", async () => {
    const execute = vi.fn();
    const service = await buildService(execute);
    await expect(
      service.execute({
        tenantId: "t1",
        operatorId: "op-1",
        maxRounds: "21",
      }),
    ).rejects.toThrow("VALIDATION_FORMAT");
    expect(execute).not.toHaveBeenCalled();
  });
});
