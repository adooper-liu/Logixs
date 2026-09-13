import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { InboxConsumptionError } from "../domain/inbox-failure";
import { INBOX_REPOSITORY } from "../domain/inbox.repository";
import {
  INBOX_CONSUMPTION,
  ProcessInboxBatchService,
} from "./process-inbox-batch.service";

const MESSAGE_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date();

const CLAIMED = {
  id: "in-1",
  tenantId: "t1",
  consumerName: "lifecycle-control-inbox",
  messageId: MESSAGE_ID,
  payloadHash: "a".repeat(64),
  payloadJson: { containerId: "c1" },
  state: "processing" as const,
  attemptCount: 1,
  lease: {
    owner: "service:logix-outbox-publisher",
    lockedAt: NOW,
    expiresAt: new Date("2026-09-13T00:00:30.000Z"),
  },
  traceId: "trace-1",
  receivedAt: NOW,
};

function validInput() {
  return {
    actorType: "service",
    actorId: "service:logix-outbox-publisher",
    tenantId: "t1",
    consumerName: "lifecycle-control-inbox",
  };
}

async function buildService(overrides?: {
  claimBatch?: ReturnType<typeof vi.fn>;
  markProcessed?: ReturnType<typeof vi.fn>;
  markConsumptionFailed?: ReturnType<typeof vi.fn>;
  consume?: ReturnType<typeof vi.fn>;
}) {
  const inbox = {
    claimBatch: overrides?.claimBatch ?? vi.fn().mockResolvedValue([CLAIMED]),
    markProcessed:
      overrides?.markProcessed ??
      vi.fn().mockResolvedValue({
        messageId: MESSAGE_ID,
        processedAt: NOW,
      }),
    markConsumptionFailed:
      overrides?.markConsumptionFailed ??
      vi.fn().mockImplementation(
        async (input: { decision: { state: string } }) => ({
          messageId: MESSAGE_ID,
          state: input.decision.state,
        }),
      ),
  };
  const consumption = {
    consume: overrides?.consume ?? vi.fn().mockResolvedValue(undefined),
  };
  const module = await Test.createTestingModule({
    providers: [
      ProcessInboxBatchService,
      { provide: INBOX_REPOSITORY, useValue: inbox },
      { provide: INBOX_CONSUMPTION, useValue: consumption },
    ],
  }).compile();
  return {
    service: module.get(ProcessInboxBatchService),
    inbox,
    consumption,
  };
}

describe("ProcessInboxBatchService", () => {
  it("领取后占位消费并标 processed", async () => {
    const { service, inbox, consumption } = await buildService();
    const result = await service.execute(validInput());
    expect(inbox.claimBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        consumerName: "lifecycle-control-inbox",
        owner: "service:logix-outbox-publisher",
        limit: 50,
      }),
    );
    expect(consumption.consume).toHaveBeenCalledWith(CLAIMED);
    expect(inbox.markProcessed).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "in-1",
        owner: "service:logix-outbox-publisher",
      }),
    );
    expect(result).toEqual({
      claimed: 1,
      processed: 1,
      retryWait: 0,
      deadLetter: 0,
      leftover: 0,
      items: [
        {
          inboxRecordId: "in-1",
          messageId: MESSAGE_ID,
          state: "processed",
          processedAt: NOW.toISOString(),
          lastErrorCode: null,
        },
      ],
    });
  });

  it("可重试失败进入 retry_wait；未知失败进入 dead_letter", async () => {
    const retry = await buildService({
      consume: vi
        .fn()
        .mockRejectedValue(new InboxConsumptionError("timeout")),
    });
    const retried = await retry.service.execute(validInput());
    expect(retry.inbox.markProcessed).not.toHaveBeenCalled();
    expect(retry.inbox.markConsumptionFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: expect.objectContaining({ state: "retry_wait" }),
      }),
    );
    expect(retried.retryWait).toBe(1);

    const dead = await buildService({
      consume: vi.fn().mockRejectedValue(new Error("handler down")),
    });
    const died = await dead.service.execute(validInput());
    expect(died.deadLetter).toBe(1);
    expect(died.items[0]).toMatchObject({
      state: "dead_letter",
      lastErrorCode: "unknown_code",
    });
  });

  it("丢失租约计入 leftover；用户身份拒绝", async () => {
    const { service, inbox } = await buildService({
      markProcessed: vi.fn().mockResolvedValue(null),
    });
    const lost = await service.execute(validInput());
    expect(lost.leftover).toBe(1);
    expect(lost.items[0]?.state).toBe("processing");

    await expect(
      service.execute({ ...validInput(), actorType: "user", actorId: "op-1" }),
    ).rejects.toThrow("AUTHORIZATION_SCOPE_DENIED");
    expect(inbox.claimBatch).toHaveBeenCalledTimes(1);
  });
});
