import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import {
  hashInboxApplyPayload,
  parseInboxApplyPayload,
} from "../domain/inbox-apply-payload";
import { INBOX_REPOSITORY } from "../domain/inbox.repository";
import { ReceiveInboxMessageService } from "./receive-inbox-message.service";

const MESSAGE_ID = "11111111-1111-4111-8111-111111111111";
const PAYLOAD = {
  containerId: "c1",
  eventCode: "stuffed",
  occurredAt: "2026-09-12T10:00:00.000Z",
  evidenceRefs: ["22222222-2222-4222-8222-222222222222"],
  idempotencyKey: "key-1",
};
const HASH = hashInboxApplyPayload(parseInboxApplyPayload(PAYLOAD));

function validInput() {
  return {
    actorType: "service",
    actorId: "service:logix-outbox-publisher",
    tenantId: "t1",
    consumerName: "lifecycle-control-inbox",
    messageId: MESSAGE_ID,
    payloadHash: HASH,
    payload: PAYLOAD,
    traceId: "trace-1",
  };
}

async function buildService(repo: {
  findByConsumerMessage: ReturnType<typeof vi.fn>;
  insertReceived: ReturnType<typeof vi.fn>;
}) {
  const module = await Test.createTestingModule({
    providers: [
      ReceiveInboxMessageService,
      { provide: INBOX_REPOSITORY, useValue: repo },
    ],
  }).compile();
  return module.get(ReceiveInboxMessageService);
}

describe("ReceiveInboxMessageService", () => {
  it("首次接收写入 received", async () => {
    const repo = {
      findByConsumerMessage: vi.fn().mockResolvedValue(null),
      insertReceived: vi.fn().mockResolvedValue(undefined),
    };
    const service = await buildService(repo);
    const result = await service.execute(validInput());
    expect(result.applied).toBe(true);
    expect(result.state).toBe("received");
    expect(result.messageId).toBe(MESSAGE_ID);
    expect(repo.insertReceived).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        consumerName: "lifecycle-control-inbox",
        state: "received",
      }),
    );
  });

  it("同键同哈希幂等返回且不插入", async () => {
    const repo = {
      findByConsumerMessage: vi.fn().mockResolvedValue({
        id: "in-1",
        tenantId: "t1",
        consumerName: "lifecycle-control-inbox",
        messageId: MESSAGE_ID,
        payloadHash: HASH,
        state: "received",
        attemptCount: 0,
        traceId: "trace-1",
        receivedAt: new Date("2026-09-13T00:00:00.000Z"),
      }),
      insertReceived: vi.fn(),
    };
    const service = await buildService(repo);
    const result = await service.execute(validInput());
    expect(result).toEqual({
      inboxRecordId: "in-1",
      messageId: MESSAGE_ID,
      state: "received",
      applied: false,
    });
    expect(repo.insertReceived).not.toHaveBeenCalled();
  });

  it("同键异哈希冲突；用户身份拒绝", async () => {
    const repo = {
      findByConsumerMessage: vi.fn().mockResolvedValue({
        id: "in-1",
        tenantId: "t1",
        consumerName: "lifecycle-control-inbox",
        messageId: MESSAGE_ID,
        payloadHash: "b".repeat(64),
        state: "received",
        attemptCount: 0,
        traceId: "trace-1",
        receivedAt: new Date("2026-09-13T00:00:00.000Z"),
      }),
      insertReceived: vi.fn(),
    };
    const service = await buildService(repo);
    await expect(service.execute(validInput())).rejects.toThrow(
      "IDEMPOTENCY_CONFLICT",
    );
    await expect(
      service.execute({ ...validInput(), actorType: "user", actorId: "op-1" }),
    ).rejects.toThrow("AUTHORIZATION_SCOPE_DENIED");
    expect(repo.insertReceived).not.toHaveBeenCalled();
  });
});
