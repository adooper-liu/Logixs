import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { CLIENT_OPERATION_REPOSITORY } from "../domain/client-operation.repository";
import {
  hashInboxApplyPayload,
  parseInboxApplyPayload,
} from "../domain/inbox-apply-payload";
import { SubmitClientOperationService } from "./submit-client-operation.service";

const PAYLOAD = {
  containerId: "c1",
  eventCode: "stuffed",
  occurredAt: "2026-09-12T10:00:00.000Z",
  evidenceRefs: ["22222222-2222-4222-8222-222222222222"],
  idempotencyKey: "key-1",
};

function validInput() {
  return {
    tenantId: "t1",
    actorId: "op-1",
    actionCode: "lifecycle.apply_event",
    ...PAYLOAD,
  };
}

async function buildService(overrides?: {
  findByIdempotency?: ReturnType<typeof vi.fn>;
  insert?: ReturnType<typeof vi.fn>;
}) {
  const operations = {
    findByIdempotency:
      overrides?.findByIdempotency ?? vi.fn().mockResolvedValue(null),
    insert: overrides?.insert ?? vi.fn().mockResolvedValue(undefined),
    findById: vi.fn(),
  };
  const module = await Test.createTestingModule({
    providers: [
      SubmitClientOperationService,
      { provide: CLIENT_OPERATION_REPOSITORY, useValue: operations },
    ],
  }).compile();
  return {
    service: module.get(SubmitClientOperationService),
    operations,
  };
}

describe("SubmitClientOperationService", () => {
  it("旧客户端操作不能绕过日期事实直接推进生命周期", async () => {
    const { service, operations } = await buildService();
    await expect(service.execute(validInput())).rejects.toThrow(
      "LIFECYCLE_EVENT_NOT_STATE_EVIDENCE",
    );
    expect(operations.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        receptionState: "received",
        businessDecisionState: "rejected",
        commitState: "pending",
        rejectionReasonCode: "LIFECYCLE_EVENT_NOT_STATE_EVIDENCE",
      }),
    );
  });

  it("同键同哈希复用；异哈希冲突", async () => {
    const hash = hashInboxApplyPayload(parseInboxApplyPayload(PAYLOAD));
    const existing = {
      id: "op-1",
      tenantId: "t1",
      actorId: "op-1",
      actionCode: "lifecycle.apply_event",
      requestHash: hash,
      receptionState: "received",
      businessDecisionState: "accepted",
      commitState: "committed",
    };
    const reuse = await buildService({
      findByIdempotency: vi.fn().mockResolvedValue(existing),
    });
    const reused = await reuse.service.execute(validInput());
    expect(reused).toEqual(existing);
    expect(reuse.operations.insert).not.toHaveBeenCalled();

    const conflict = await buildService({
      findByIdempotency: vi.fn().mockResolvedValue({
        ...existing,
        requestHash: "b".repeat(64),
      }),
    });
    await expect(conflict.service.execute(validInput())).rejects.toThrow(
      "IDEMPOTENCY_CONFLICT",
    );
  });

  it("拒绝记录不标 committed", async () => {
    const { service, operations } = await buildService();
    await expect(service.execute(validInput())).rejects.toThrow(
      "LIFECYCLE_EVENT_NOT_STATE_EVIDENCE",
    );
    expect(operations.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        receptionState: "received",
        businessDecisionState: "rejected",
        commitState: "pending",
        rejectionReasonCode: "LIFECYCLE_EVENT_NOT_STATE_EVIDENCE",
      }),
    );
  });
});
