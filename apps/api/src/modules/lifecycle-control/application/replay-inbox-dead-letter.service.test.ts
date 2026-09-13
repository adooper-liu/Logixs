import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { INBOX_REPOSITORY } from "../domain/inbox.repository";
import { hashReplayRequest } from "../domain/outbox-replay";
import { inboxReplayPayloadRef } from "../domain/inbox-replay";
import { ReplayInboxDeadLetterService } from "./replay-inbox-dead-letter.service";

const ORIGINAL = {
  id: "in-1",
  tenantId: "t1",
  consumerName: "lifecycle-control-inbox",
  messageId: "11111111-1111-4111-8111-111111111111",
  payloadHash: "a".repeat(64),
  payloadJson: { containerId: "c1" },
  state: "dead_letter" as const,
  attemptCount: 3,
  lastErrorCode: "timeout",
  failureCategory: "transient_technical",
  ownerQueue: "lifecycle-control-inbox",
  deadLetteredAt: new Date("2026-09-13T00:00:00.000Z"),
  receivedAt: new Date("2026-09-12T10:00:00.000Z"),
  causationId: null,
  traceId: "trace-old",
};

const COMMAND = {
  deadLetterId: "in-1",
  tenantId: "t1",
  operatorId: "op-1",
  reasonCode: "manual_replay",
  targetConsumerVersion: "consumer-v1",
  idempotencyKey: "replay-1",
};

const SAME_HASH = hashReplayRequest({
  reasonCode: COMMAND.reasonCode,
  targetConsumerVersion: COMMAND.targetConsumerVersion,
  payloadRef: inboxReplayPayloadRef(ORIGINAL.id),
  payloadHash: ORIGINAL.payloadHash,
});

async function buildService(overrides?: {
  findById?: ReturnType<typeof vi.fn>;
  findReplayByIdempotency?: ReturnType<typeof vi.fn>;
  insertReplay?: ReturnType<typeof vi.fn>;
}) {
  const inbox = {
    findById: overrides?.findById ?? vi.fn().mockResolvedValue(ORIGINAL),
    findReplayByIdempotency:
      overrides?.findReplayByIdempotency ?? vi.fn().mockResolvedValue(null),
    insertReplay:
      overrides?.insertReplay ?? vi.fn().mockResolvedValue(undefined),
  };
  const module = await Test.createTestingModule({
    providers: [
      ReplayInboxDeadLetterService,
      { provide: INBOX_REPOSITORY, useValue: inbox },
    ],
  }).compile();
  return {
    service: module.get(ReplayInboxDeadLetterService),
    inbox,
  };
}

describe("ReplayInboxDeadLetterService", () => {
  it("生成新 received 行且不复用原 messageId", async () => {
    const { service, inbox } = await buildService();
    const result = await service.execute(COMMAND);
    expect(result.applied).toBe(true);
    expect(result.corrected).toBe(false);
    expect(result.replayedMessageId).not.toBe(ORIGINAL.messageId);
    expect(inbox.insertReplay).toHaveBeenCalledWith(
      expect.objectContaining({
        replay: expect.objectContaining({
          state: "received",
          causationId: ORIGINAL.messageId,
          payloadHash: ORIGINAL.payloadHash,
        }),
        request: expect.objectContaining({
          deadLetterId: ORIGINAL.id,
          reasonCode: "manual_replay",
        }),
      }),
    );
  });

  it("跨租户拒绝且不写库", async () => {
    const { service, inbox } = await buildService();
    await expect(
      service.execute({ ...COMMAND, tenantId: "other" }),
    ).rejects.toThrow("AUTHORIZATION_SCOPE_DENIED");
    expect(inbox.insertReplay).not.toHaveBeenCalled();
  });

  it("非死信拒绝", async () => {
    const { service, inbox } = await buildService({
      findById: vi.fn().mockResolvedValue({
        ...ORIGINAL,
        state: "processed",
      }),
    });
    await expect(service.execute(COMMAND)).rejects.toThrow(
      "BUSINESS_STATE_VIOLATION",
    );
    expect(inbox.insertReplay).not.toHaveBeenCalled();
  });

  it("同键同哈希复用原重放", async () => {
    const { service, inbox } = await buildService({
      findReplayByIdempotency: vi.fn().mockResolvedValue({
        replayedInboxId: "in-replay",
        replayedMessageId: "55555555-5555-4555-8555-555555555555",
        requestHash: SAME_HASH,
      }),
    });
    const result = await service.execute(COMMAND);
    expect(result.applied).toBe(false);
    expect(result.corrected).toBe(false);
    expect(result.replayedInboxId).toBe("in-replay");
    expect(inbox.insertReplay).not.toHaveBeenCalled();
  });

  it("同键异哈希冲突", async () => {
    const { service, inbox } = await buildService({
      findReplayByIdempotency: vi.fn().mockResolvedValue({
        replayedInboxId: "in-replay",
        replayedMessageId: "55555555-5555-4555-8555-555555555555",
        requestHash: "c".repeat(64),
      }),
    });
    await expect(service.execute(COMMAND)).rejects.toThrow(
      "IDEMPOTENCY_CONFLICT",
    );
    expect(inbox.insertReplay).not.toHaveBeenCalled();
  });

  it("修正载荷写入新 hash，仍用新 messageId", async () => {
    const source = {
      ...ORIGINAL,
      id: "in-2",
      messageId: "22222222-2222-4222-8222-222222222222",
      payloadHash: "b".repeat(64),
      payloadJson: { containerId: "c2" },
      state: "received" as const,
    };
    const { service, inbox } = await buildService({
      findById: vi.fn(async (id: string) => {
        if (id === source.id) return source;
        if (id === ORIGINAL.id) return ORIGINAL;
        return null;
      }),
    });
    const result = await service.execute({
      ...COMMAND,
      payloadRef: "inbox/in-2",
      payloadHash: source.payloadHash,
    });
    expect(result.applied).toBe(true);
    expect(result.corrected).toBe(true);
    expect(result.replayedMessageId).not.toBe(ORIGINAL.messageId);
    expect(inbox.insertReplay).toHaveBeenCalledWith(
      expect.objectContaining({
        replay: expect.objectContaining({
          payloadHash: source.payloadHash,
          payloadJson: { containerId: "c2" },
          causationId: ORIGINAL.messageId,
        }),
      }),
    );
  });

  it("只给 payloadRef 拒绝", async () => {
    const { service, inbox } = await buildService();
    await expect(
      service.execute({ ...COMMAND, payloadRef: "inbox/in-2" }),
    ).rejects.toThrow("VALIDATION_FORMAT");
    expect(inbox.insertReplay).not.toHaveBeenCalled();
  });

  it("引用不存在拒绝", async () => {
    const { service, inbox } = await buildService({
      findById: vi.fn(async (id: string) =>
        id === ORIGINAL.id ? ORIGINAL : null,
      ),
    });
    await expect(
      service.execute({
        ...COMMAND,
        payloadRef: "inbox/in-missing",
        payloadHash: "b".repeat(64),
      }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
    expect(inbox.insertReplay).not.toHaveBeenCalled();
  });
});
