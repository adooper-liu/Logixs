import { HttpException, HttpStatus } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { APPLY_LIFECYCLE_EVENT } from "../apply-lifecycle-event.port";
import { CLIENT_OPERATION_REPOSITORY } from "../domain/client-operation.repository";
import { hashInboxApplyPayload, parseInboxApplyPayload } from "../domain/inbox-apply-payload";
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
  apply?: ReturnType<typeof vi.fn>;
}) {
  const operations = {
    findByIdempotency:
      overrides?.findByIdempotency ?? vi.fn().mockResolvedValue(null),
    insert: overrides?.insert ?? vi.fn().mockResolvedValue(undefined),
    findById: vi.fn(),
  };
  const apply = {
    execute:
      overrides?.apply ??
      vi.fn().mockResolvedValue({
        containerId: "c1",
        eventCode: "stuffed",
        applied: true,
        completedNodes: [],
        resultingStatus: null,
        activatedNodeCode: null,
        activatedNodeTaskId: null,
      }),
  };
  const module = await Test.createTestingModule({
    providers: [
      SubmitClientOperationService,
      { provide: CLIENT_OPERATION_REPOSITORY, useValue: operations },
      { provide: APPLY_LIFECYCLE_EVENT, useValue: apply },
    ],
  }).compile();
  return {
    service: module.get(SubmitClientOperationService),
    operations,
    apply,
  };
}

describe("SubmitClientOperationService", () => {
  it("成功一次返回 received/accepted/committed", async () => {
    const { service, operations, apply } = await buildService();
    const result = await service.execute(validInput());
    expect(apply.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        containerId: "c1",
        eventCode: "stuffed",
        tenantId: "t1",
      }),
    );
    expect(operations.insert).toHaveBeenCalled();
    expect(result.receptionState).toBe("received");
    expect(result.businessDecisionState).toBe("accepted");
    expect(result.commitState).toBe("committed");
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
    expect(reuse.apply.execute).not.toHaveBeenCalled();

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

  it("业务拒绝保存 rejected 且不标 committed", async () => {
    const { service, operations } = await buildService({
      apply: vi
        .fn()
        .mockRejectedValue(
          new HttpException("EVIDENCE_REQUIRED", HttpStatus.UNPROCESSABLE_ENTITY),
        ),
    });
    await expect(service.execute(validInput())).rejects.toThrow(
      "EVIDENCE_REQUIRED",
    );
    expect(operations.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        receptionState: "received",
        businessDecisionState: "rejected",
        commitState: "pending",
        rejectionReasonCode: "EVIDENCE_REQUIRED",
      }),
    );
  });
});
