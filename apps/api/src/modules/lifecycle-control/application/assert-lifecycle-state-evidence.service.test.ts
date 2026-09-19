import { HttpException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { LifecycleDateFactRecord } from "../domain/lifecycle-date-fact";
import { AssertLifecycleStateEvidenceService } from "./assert-lifecycle-state-evidence.service";

const FACT_ID = "22222222-2222-4222-8222-222222222222";
const EVIDENCE = "33333333-3333-4333-8333-333333333333";
const OCCURRED_AT = new Date("2026-09-19T01:00:00Z");

function fact(
  overrides: Partial<LifecycleDateFactRecord> = {},
): LifecycleDateFactRecord {
  return {
    id: FACT_ID,
    tenantId: "t1",
    containerId: "c1",
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
  };
}

function input() {
  return {
    domainFactId: FACT_ID,
    tenantId: "t1",
    containerId: "c1",
    eventCode: "departed" as const,
    occurredAt: OCCURRED_AT,
    evidenceRefs: [EVIDENCE],
  };
}

describe("AssertLifecycleStateEvidenceService", () => {
  it("从持久化事实返回节点和实际采用的来源策略", async () => {
    const repository = { findById: vi.fn().mockResolvedValue(fact()) };
    const service = new AssertLifecycleStateEvidenceService(
      repository as never,
    );

    await expect(service.execute(input())).resolves.toEqual({
      domainFactId: FACT_ID,
      nodeCode: "origin_departure",
      authorityPolicyRef: "carrier-departure:1",
    });
  });

  it("不存在或不具资格的事实返回稳定 422 错误", async () => {
    const missing = new AssertLifecycleStateEvidenceService({
      findById: vi.fn().mockResolvedValue(null),
    } as never);
    const untrusted = new AssertLifecycleStateEvidenceService({
      findById: vi.fn().mockResolvedValue(fact({ authorityPolicyRef: null })),
    } as never);

    const error = await missing.execute(input()).catch((reason) => reason);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(422);
    await expect(untrusted.execute(input())).rejects.toThrow(
      "LIFECYCLE_SOURCE_NOT_AUTHORIZED",
    );
  });
});
