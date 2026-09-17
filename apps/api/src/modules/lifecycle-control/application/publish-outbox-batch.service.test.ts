import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { POST_NOTIFICATION } from "../../notification";
import { OutboxDeliveryError } from "../domain/outbox-failure";
import { OUTBOX_REPOSITORY } from "../domain/outbox.repository";
import {
  OUTBOX_DELIVERY,
  PublishOutboxBatchService,
} from "./publish-outbox-batch.service";

const CLAIMED = {
  id: "evt-1",
  tenantId: "t1",
  ownerModule: "lifecycle-control",
  eventId: "evt-1",
  eventType: "stuffed",
  aggregateType: "container",
  aggregateId: "c1",
  payloadRef: "canonical-event/evt-1",
  payloadHash: "a".repeat(64),
  state: "publishing" as const,
  attemptCount: 1,
  lease: {
    owner: "op-1",
    lockedAt: new Date("2026-09-13T00:00:00.000Z"),
    expiresAt: new Date("2026-09-13T00:00:30.000Z"),
  },
  occurredAt: new Date("2026-09-12T10:00:00.000Z"),
  createdAt: new Date(),
  idempotencyKey: "key-1",
  traceId: "trace-1",
};

async function buildService(overrides?: {
  claimBatch?: ReturnType<typeof vi.fn>;
  markPublished?: ReturnType<typeof vi.fn>;
  markDeliveryFailed?: ReturnType<typeof vi.fn>;
  deliver?: ReturnType<typeof vi.fn>;
  postNotification?: ReturnType<typeof vi.fn>;
}) {
  const outbox = {
    claimBatch: overrides?.claimBatch ?? vi.fn().mockResolvedValue([CLAIMED]),
    markPublished:
      overrides?.markPublished ??
      vi.fn().mockResolvedValue({
        eventId: "evt-1",
        brokerReference: "stub:evt-1",
      }),
    markDeliveryFailed:
      overrides?.markDeliveryFailed ??
      vi
        .fn()
        .mockImplementation(async (input: { decision: { state: string } }) => ({
          eventId: "evt-1",
          state: input.decision.state,
        })),
  };
  const delivery = {
    deliver:
      overrides?.deliver ??
      vi.fn().mockResolvedValue({ brokerReference: "stub:evt-1" }),
  };
  const postNotification = {
    execute:
      overrides?.postNotification ?? vi.fn().mockResolvedValue({ id: "n1" }),
  };
  const module = await Test.createTestingModule({
    providers: [
      PublishOutboxBatchService,
      { provide: OUTBOX_REPOSITORY, useValue: outbox },
      { provide: OUTBOX_DELIVERY, useValue: delivery },
      { provide: POST_NOTIFICATION, useValue: postNotification },
    ],
  }).compile();
  return {
    service: module.get(PublishOutboxBatchService),
    outbox,
    delivery,
    postNotification,
  };
}

describe("PublishOutboxBatchService", () => {
  it("领取后占位投递并标 published", async () => {
    const { service, outbox, delivery } = await buildService();
    const result = await service.execute({
      tenantId: "t1",
      operatorId: "op-1",
    });
    expect(outbox.claimBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        ownerModule: "lifecycle-control",
        owner: "op-1",
        limit: 50,
      }),
    );
    expect(delivery.deliver).toHaveBeenCalledWith(CLAIMED);
    expect(outbox.markPublished).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "evt-1",
        owner: "op-1",
        brokerReference: "stub:evt-1",
      }),
    );
    expect(result).toEqual({
      claimed: 1,
      published: 1,
      retryWait: 0,
      deadLetter: 0,
      leftover: 0,
      items: [
        {
          eventId: "evt-1",
          state: "published",
          brokerReference: "stub:evt-1",
          lastErrorCode: null,
        },
      ],
    });
  });

  it("可重试失败进入 retry_wait", async () => {
    const { service, outbox } = await buildService({
      deliver: vi.fn().mockRejectedValue(new OutboxDeliveryError("timeout")),
    });
    const result = await service.execute({
      tenantId: "t1",
      operatorId: "op-1",
    });
    expect(outbox.markPublished).not.toHaveBeenCalled();
    expect(outbox.markDeliveryFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "evt-1",
        owner: "op-1",
        decision: expect.objectContaining({
          state: "retry_wait",
          lastErrorCode: "timeout",
        }),
      }),
    );
    expect(result.retryWait).toBe(1);
    expect(result.items[0]).toEqual({
      eventId: "evt-1",
      state: "retry_wait",
      brokerReference: null,
      lastErrorCode: "timeout",
    });
  });

  it("未知失败进入 dead_letter", async () => {
    const { service, outbox, postNotification } = await buildService({
      deliver: vi.fn().mockRejectedValue(new Error("broker down")),
    });
    const result = await service.execute({
      tenantId: "t1",
      operatorId: "op-1",
    });
    expect(outbox.markDeliveryFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: expect.objectContaining({
          state: "dead_letter",
          lastErrorCode: "unknown_code",
          ownerQueue: "lifecycle-control-outbox",
        }),
      }),
    );
    expect(postNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        problemCode: "outbox_dead_letter",
        entityType: "outbox_message",
        entityId: "evt-1",
      }),
    );
    expect(result.deadLetter).toBe(1);
    expect(result.items[0]).toMatchObject({
      state: "dead_letter",
      lastErrorCode: "unknown_code",
    });
  });

  it("丢失租约保持 publishing leftover", async () => {
    const { service } = await buildService({
      deliver: vi.fn().mockRejectedValue(new OutboxDeliveryError("timeout")),
      markDeliveryFailed: vi.fn().mockResolvedValue(null),
    });
    const result = await service.execute({
      tenantId: "t1",
      operatorId: "op-1",
    });
    expect(result.leftover).toBe(1);
    expect(result.items[0]).toMatchObject({
      state: "publishing",
      lastErrorCode: "timeout",
    });
  });

  it("空批次返回零", async () => {
    const { service, delivery } = await buildService({
      claimBatch: vi.fn().mockResolvedValue([]),
    });
    const result = await service.execute({
      tenantId: "t1",
      operatorId: "op-1",
      limit: 10,
    });
    expect(delivery.deliver).not.toHaveBeenCalled();
    expect(result).toEqual({
      claimed: 0,
      published: 0,
      retryWait: 0,
      deadLetter: 0,
      leftover: 0,
      items: [],
    });
  });

  it("非法 limit 拒绝", async () => {
    const { service } = await buildService();
    await expect(
      service.execute({ tenantId: "t1", operatorId: "op-1", limit: "201" }),
    ).rejects.toThrow("VALIDATION_FORMAT");
  });
});
