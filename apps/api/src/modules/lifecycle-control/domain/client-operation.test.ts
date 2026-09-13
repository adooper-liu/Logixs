import { describe, expect, it } from "vitest";
import {
  buildBoundaryRejectedClientOperation,
  buildCommittedClientOperation,
  buildRejectedClientOperation,
  decideClientIdempotency,
  parseClientActionCode,
} from "./client-operation";

const NOW = new Date("2026-09-13T00:00:00.000Z");
const BASE = {
  id: "op-1",
  tenantId: "t1",
  actorType: "user",
  actorId: "op-1",
  targetId: "c1",
  correlationId: "corr-1",
  traceId: "trace-1",
  idempotencyKey: "key-1",
  requestHash: "a".repeat(64),
  now: NOW,
};

describe("parseClientActionCode / decideClientIdempotency", () => {
  it("只受理 lifecycle.apply_event", () => {
    expect(parseClientActionCode("lifecycle.apply_event")).toBe(
      "lifecycle.apply_event",
    );
    expect(() => parseClientActionCode("work.complete")).toThrow(
      "VALIDATION_FORMAT",
    );
  });

  it("同哈希复用，异哈希冲突", () => {
    expect(decideClientIdempotency("aa", "aa")).toBe("reuse");
    expect(decideClientIdempotency("aa", "bb")).toBe("conflict");
  });
});

describe("三阶段记录", () => {
  it("成功一次写满 received/accepted/committed", () => {
    const record = buildCommittedClientOperation({
      ...BASE,
      resultRefs: [{ entityType: "container", entityId: "c1" }],
    });
    expect(record.receptionState).toBe("received");
    expect(record.businessDecisionState).toBe("accepted");
    expect(record.commitState).toBe("committed");
    expect(record.committedAt).toEqual(NOW);
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

  it("边界拒绝不进入业务裁决", () => {
    const record = buildBoundaryRejectedClientOperation({
      ...BASE,
      rejectionReasonCode: "AUTHORIZATION_SCOPE_DENIED",
    });
    expect(record.receptionState).toBe("boundary_rejected");
    expect(record.businessDecisionState).toBe("pending");
  });
});
