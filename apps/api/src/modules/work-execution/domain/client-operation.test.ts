import { describe, expect, it } from "vitest";
import {
  buildCommittedClientOperation,
  buildRejectedClientOperation,
  decideClientIdempotency,
  defaultClaimIdempotencyKey,
  defaultCompleteIdempotencyKey,
  hashClaimRequest,
  hashCompleteRequest,
  parseClaimIdempotencyKey,
  parseCompleteIdempotencyKey,
  WORK_CLAIM_ACTION,
  WORK_COMPLETE_ACTION,
} from "./client-operation";

const NOW = new Date("2026-09-13T00:00:00.000Z");
const BASE = {
  id: "op-1",
  tenantId: "t1",
  actorType: "user",
  actorId: "op-1",
  targetId: "w1",
  correlationId: "corr-1",
  traceId: "trace-1",
  idempotencyKey: "key-1",
  requestHash: "a".repeat(64),
  now: NOW,
};

describe("complete ClientOperation", () => {
  it("默认幂等键按工单，空串回退默认", () => {
    expect(defaultCompleteIdempotencyKey("w1")).toBe("work-order:w1:complete");
    expect(parseCompleteIdempotencyKey("  ", "w1")).toBe(
      "work-order:w1:complete",
    );
    expect(parseCompleteIdempotencyKey("custom-key", "w1")).toBe("custom-key");
  });

  it("哈希只覆盖工单与排序后的证据", () => {
    expect(
      hashCompleteRequest({
        workOrderId: "w1",
        evidenceRefs: ["b", "a"],
      }),
    ).toBe(
      hashCompleteRequest({
        workOrderId: "w1",
        evidenceRefs: ["a", "b"],
      }),
    );
    expect(
      decideClientIdempotency(
        hashCompleteRequest({ workOrderId: "w1", evidenceRefs: [] }),
        hashCompleteRequest({ workOrderId: "w1", evidenceRefs: ["a"] }),
      ),
    ).toBe("conflict");
  });

  it("领取默认幂等键按工单，空串回退默认", () => {
    expect(defaultClaimIdempotencyKey("w1")).toBe("work-order:w1:claim");
    expect(parseClaimIdempotencyKey("  ", "w1")).toBe("work-order:w1:claim");
    expect(hashClaimRequest({ workOrderId: "w1" })).toHaveLength(64);
  });

  it("成功记录 actionCode 为工单完成", () => {
    const record = buildCommittedClientOperation({
      ...BASE,
      resultRefs: [{ entityType: "work_order", entityId: "w1" }],
    });
    expect(record.actionCode).toBe(WORK_COMPLETE_ACTION);
    expect(
      buildCommittedClientOperation({
        ...BASE,
        actionCode: WORK_CLAIM_ACTION,
        resultRefs: [{ entityType: "work_order", entityId: "w1" }],
      }).actionCode,
    ).toBe(WORK_CLAIM_ACTION);
    expect(record.receptionState).toBe("received");
    expect(record.businessDecisionState).toBe("accepted");
    expect(record.commitState).toBe("committed");
  });

  it("业务拒绝不标 committed", () => {
    const record = buildRejectedClientOperation({
      ...BASE,
      rejectionReasonCode: "EVIDENCE_REQUIRED",
    });
    expect(record.businessDecisionState).toBe("rejected");
    expect(record.commitState).toBe("pending");
    expect(record.committedAt).toBeNull();
  });
});
