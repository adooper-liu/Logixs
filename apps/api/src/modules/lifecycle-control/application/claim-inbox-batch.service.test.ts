import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { INBOX_REPOSITORY } from "../domain/inbox.repository";
import { ClaimInboxBatchService } from "./claim-inbox-batch.service";

const MESSAGE_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-09-13T00:00:00.000Z");

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
    limit: 10,
  };
}

async function buildService(claimBatch: ReturnType<typeof vi.fn>) {
  const module = await Test.createTestingModule({
    providers: [
      ClaimInboxBatchService,
      { provide: INBOX_REPOSITORY, useValue: { claimBatch } },
    ],
  }).compile();
  return module.get(ClaimInboxBatchService);
}

describe("ClaimInboxBatchService", () => {
  it("领取后返回 processing 租约", async () => {
    const claimBatch = vi.fn().mockResolvedValue([CLAIMED]);
    const service = await buildService(claimBatch);
    const result = await service.execute(validInput());
    expect(result).toEqual({
      claimed: 1,
      leftover: false,
      items: [
        {
          inboxRecordId: "in-1",
          messageId: MESSAGE_ID,
          state: "processing",
          attemptCount: 1,
          leaseOwner: "service:logix-outbox-publisher",
          leaseLockedAt: "2026-09-13T00:00:00.000Z",
          leaseExpiresAt: "2026-09-13T00:00:30.000Z",
        },
      ],
    });
    expect(claimBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        consumerName: "lifecycle-control-inbox",
        owner: "service:logix-outbox-publisher",
        limit: 10,
      }),
    );
  });

  it("空批次不报 leftover", async () => {
    const claimBatch = vi.fn().mockResolvedValue([]);
    const service = await buildService(claimBatch);
    const result = await service.execute(validInput());
    expect(result).toEqual({ claimed: 0, leftover: false, items: [] });
  });

  it("用户身份拒绝；不受理的消费者拒绝", async () => {
    const claimBatch = vi.fn();
    const service = await buildService(claimBatch);
    await expect(
      service.execute({ ...validInput(), actorType: "user", actorId: "op-1" }),
    ).rejects.toThrow("AUTHORIZATION_SCOPE_DENIED");
    await expect(
      service.execute({ ...validInput(), consumerName: "other-inbox" }),
    ).rejects.toThrow("VALIDATION_FORMAT");
    expect(claimBatch).not.toHaveBeenCalled();
  });
});
