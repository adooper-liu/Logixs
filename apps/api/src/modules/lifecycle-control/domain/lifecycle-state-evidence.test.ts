import { describe, expect, it } from "vitest";
import type { LifecycleDateFactRecord } from "./lifecycle-date-fact";
import { decideLifecycleStateEvidence } from "./lifecycle-state-evidence";

const OCCURRED_AT = new Date("2026-09-19T01:00:00Z");
const EVIDENCE = "33333333-3333-4333-8333-333333333333";

function fact(
  overrides: Partial<LifecycleDateFactRecord> = {},
): LifecycleDateFactRecord {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    tenantId: "11111111-1111-4111-8111-111111111111",
    containerId: "22222222-2222-4222-8222-222222222223",
    nodeCode: "origin_departure",
    eventCode: "departed",
    timeKind: "actual",
    occurredAt: OCCURRED_AT,
    rawValue: OCCURRED_AT.toISOString(),
    sourceUtcOffset: "+00:00",
    ingestionChannel: "api",
    captureSource: "external_evidence",
    sourceSystem: "provider-adapter",
    authoritySystem: "carrier-a",
    provider: "provider-a",
    interfaceCode: "tracking",
    sourceEventId: "source-1",
    mappingVersion: "v1",
    verificationState: "verified",
    confidenceState: "confirmed",
    validity: "effective",
    authorityPolicyRef: "carrier-departure:1",
    evidenceRefs: [EVIDENCE],
    actorId: null,
    reasonCode: null,
    idempotencyKey: "source-1",
    payloadHash: "a".repeat(64),
    supersedesFactId: null,
    isCurrent: true,
    applicationState: "pending_application",
    applicationReasonCode: null,
    canonicalEventId: null,
    projectionVersion: 1,
    traceId: "trace-1",
    receivedAt: OCCURRED_AT,
    recordedAt: OCCURRED_AT,
    ...overrides,
    location: overrides.location ?? null,
  };
}

function decide(candidate: LifecycleDateFactRecord) {
  return decideLifecycleStateEvidence({
    fact: candidate,
    tenantId: candidate.tenantId,
    containerId: candidate.containerId,
    eventCode: "departed",
    occurredAt: OCCURRED_AT,
    evidenceRefs: [EVIDENCE],
  });
}

describe("decideLifecycleStateEvidence", () => {
  it("只接受已核验、已确认且命中来源策略的实际事实", () => {
    expect(decide(fact())).toEqual({
      kind: "accept",
      authorityPolicyRef: "carrier-departure:1",
    });
  });

  it("预计或未确认事实不能成为状态证据", () => {
    expect(decide(fact({ timeKind: "estimated" }))).toEqual({
      kind: "reject",
      reasonCode: "LIFECYCLE_EVENT_NOT_STATE_EVIDENCE",
    });
    expect(decide(fact({ confidenceState: "provisional" }))).toEqual({
      kind: "reject",
      reasonCode: "LIFECYCLE_EVENT_NOT_STATE_EVIDENCE",
    });
  });

  it("事实缺少服务端来源策略裁决时拒绝", () => {
    expect(decide(fact({ authorityPolicyRef: null }))).toEqual({
      kind: "reject",
      reasonCode: "LIFECYCLE_SOURCE_NOT_AUTHORIZED",
    });
  });

  it("货柜、事件、时间或证据不匹配时拒绝", () => {
    expect(
      decideLifecycleStateEvidence({
        fact: fact(),
        tenantId: "11111111-1111-4111-8111-111111111111",
        containerId: "99999999-9999-4999-8999-999999999999",
        eventCode: "departed",
        occurredAt: OCCURRED_AT,
        evidenceRefs: [EVIDENCE],
      }),
    ).toEqual({
      kind: "reject",
      reasonCode: "LIFECYCLE_GUARD_NOT_SATISFIED",
    });
  });
});
