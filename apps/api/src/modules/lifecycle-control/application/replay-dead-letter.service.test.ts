import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { OUTBOX_REPOSITORY } from "../domain/outbox.repository";
import {
  hashReplayRequest,
  type StoredOutboxMessage,
} from "../domain/outbox-replay";
import { ReplayDeadLetterService } from "./replay-dead-letter.service";

const ORIGINAL: StoredOutboxMessage = {
  id: "dl-1",
  tenantId: "t1",
  ownerModule: "lifecycle-control",
  eventId: "evt-1",
  eventType: "stuffed",
  eventVersion: 1,
  aggregateType: "container",
  aggregateId: "c1",
  payloadRef: "canonical-event/evt-1",
  payloadHash: "a".repeat(64),
  state: "dead_letter",
  attemptCount: 3,
  occurredAt: new Date("2026-09-12T10:00:00.000Z"),
  idempotencyKey: "key-1",
  causationId: null,
  traceId: "trace-old",
};

const COMMAND = {
  deadLetterId: "dl-1",
  tenantId: "t1",
  operatorId: "op-1",
  reasonCode: "manual_replay",
  targetConsumerVersion: "consumer-v1",
  idempotencyKey: "replay-1",
};

const SAME_HASH = hashReplayRequest({
  reasonCode: COMMAND.reasonCode,
  targetConsumerVersion: COMMAND.targetConsumerVersion,
  payloadRef: ORIGINAL.payloadRef,
  payloadHash: ORIGINAL.payloadHash,
});

async function buildService(overrides?: {
  findById?: ReturnType<typeof vi.fn>;
  findReplayByIdempotency?: ReturnType<typeof vi.fn>;
  insertReplay?: ReturnType<typeof vi.fn>;
}) {
  const outbox = {
    findById: overrides?.findById ?? vi.fn().mockResolvedValue(ORIGINAL),
    findReplayByIdempotency:
      overrides?.findReplayByIdempotency ?? vi.fn().mockResolvedValue(null),
    insertReplay:
      overrides?.insertReplay ?? vi.fn().mockResolvedValue(undefined),
  };
  const module = await Test.createTestingModule({
    providers: [
      ReplayDeadLetterService,
      { provide: OUTBOX_REPOSITORY, useValue: outbox },
    ],
  }).compile();
  return {
    service: module.get(ReplayDeadLetterService),
    outbox,
  };
}

describe("ReplayDeadLetterService", () => {
  it("生成新 pending 行且不复用原 eventId", async () => {
    const { service, outbox } = await buildService();
    const result = await service.execute(COMMAND);
    expect(result.applied).toBe(true);
    expect(result.corrected).toBe(false);
    expect(result.replayedEventId).not.toBe("evt-1");
    expect(outbox.insertReplay).toHaveBeenCalledWith(
      expect.objectContaining({
        replay: expect.objectContaining({
          state: "pending",
          causationId: "evt-1",
          payloadRef: ORIGINAL.payloadRef,
          payloadHash: ORIGINAL.payloadHash,
        }),
        request: expect.objectContaining({
          idempotencyKey: "replay-1",
          requestHash: SAME_HASH,
        }),
      }),
    );
  });

  it("同键同哈希返回原重放结果", async () => {
    const { service, outbox } = await buildService({
      findReplayByIdempotency: vi.fn().mockResolvedValue({
        replayedOutboxId: "evt-replay",
        replayedEventId: "evt-replay",
        requestHash: SAME_HASH,
      }),
    });
    const result = await service.execute(COMMAND);
    expect(result.applied).toBe(false);
    expect(result.replayedEventId).toBe("evt-replay");
    expect(outbox.insertReplay).not.toHaveBeenCalled();
  });

  it("同键异哈希冲突", async () => {
    const { service, outbox } = await buildService({
      findReplayByIdempotency: vi.fn().mockResolvedValue({
        replayedOutboxId: "evt-replay",
        replayedEventId: "evt-replay",
        requestHash: "e".repeat(64),
      }),
    });
    await expect(service.execute(COMMAND)).rejects.toThrow(
      "IDEMPOTENCY_CONFLICT",
    );
    expect(outbox.insertReplay).not.toHaveBeenCalled();
  });

  it("修正载荷写入新 hash，仍用新 eventId", async () => {
    const { service, outbox } = await buildService();
    const result = await service.execute({
      ...COMMAND,
      payloadRef: "canonical-event/corrected",
      payloadHash: "b".repeat(64),
    });
    expect(result.applied).toBe(true);
    expect(result.corrected).toBe(true);
    expect(result.replayedEventId).not.toBe("evt-1");
    expect(outbox.insertReplay).toHaveBeenCalledWith(
      expect.objectContaining({
        replay: expect.objectContaining({
          payloadRef: "canonical-event/corrected",
          payloadHash: "b".repeat(64),
          causationId: "evt-1",
        }),
      }),
    );
  });

  it("只给 payloadRef 拒绝", async () => {
    const { service } = await buildService();
    await expect(
      service.execute({ ...COMMAND, payloadRef: "canonical-event/new" }),
    ).rejects.toThrow("VALIDATION_FORMAT");
  });

  it("非死信拒绝", async () => {
    const { service, outbox } = await buildService({
      findById: vi.fn().mockResolvedValue({ ...ORIGINAL, state: "pending" }),
    });
    await expect(service.execute(COMMAND)).rejects.toThrow(
      "BUSINESS_STATE_VIOLATION",
    );
    expect(outbox.insertReplay).not.toHaveBeenCalled();
  });

  it("跨租户拒绝", async () => {
    const { service } = await buildService();
    await expect(
      service.execute({ ...COMMAND, tenantId: "other" }),
    ).rejects.toThrow("AUTHORIZATION_SCOPE_DENIED");
  });

  it("不存在 → RESOURCE_NOT_FOUND", async () => {
    const { service } = await buildService({
      findById: vi.fn().mockResolvedValue(null),
    });
    await expect(service.execute(COMMAND)).rejects.toThrow(
      "RESOURCE_NOT_FOUND",
    );
  });
});
