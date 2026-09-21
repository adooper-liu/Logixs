import { HttpException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { LifecycleDateFactRecord } from "../domain/lifecycle-date-fact";
import { ApproveLifecycleDateFactReviewService } from "./approve-lifecycle-date-fact-review.service";

const OPERATOR_ID = "11111111-1111-4111-8111-111111111111";
const REVIEWER_ID = "22222222-2222-4222-8222-222222222222";

function fact(
  overrides: Partial<LifecycleDateFactRecord> = {},
): LifecycleDateFactRecord {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    tenantId: "44444444-4444-4444-8444-444444444444",
    containerId: "55555555-5555-4555-8555-555555555555",
    nodeCode: "destination_arrival",
    eventCode: "arrived",
    timeKind: "actual",
    occurredAt: new Date("2026-09-20T10:00:00Z"),
    rawValue: "2026-09-20 18:00",
    sourceUtcOffset: "+08:00",
    ingestionChannel: "manual_ui",
    captureSource: "manual_backfill",
    sourceSystem: "logix.manual",
    authoritySystem: "carrier-a",
    provider: null,
    interfaceCode: null,
    sourceEventId: null,
    mappingVersion: null,
    verificationState: "pending",
    confidenceState: "unknown",
    validity: "effective",
    authorityPolicyRef: null,
    location: {
      locationType: "port",
      unlocode: "USLAX",
      timezone: "America/Los_Angeles",
    },
    evidenceRefs: ["66666666-6666-4666-8666-666666666666"],
    actorId: OPERATOR_ID,
    reasonCode: "manual_backfill",
    idempotencyKey: "initial-1",
    payloadHash: "hash",
    supersedesFactId: null,
    isCurrent: true,
    applicationState: "review_required",
    applicationReasonCode: "SOURCE_AUTHORITY_REVIEW_REQUIRED",
    canonicalEventId: null,
    projectionVersion: 4,
    traceId: "trace-initial",
    receivedAt: new Date("2026-09-20T10:01:00Z"),
    recordedAt: new Date("2026-09-20T10:01:00Z"),
    ...overrides,
  };
}

function command() {
  return {
    tenantId: fact().tenantId,
    factId: fact().id,
    reviewerId: REVIEWER_ID,
    traceId: "trace-review",
    actorCapabilities: ["evidence.review"],
    reasonCode: "date_fact_review_approved",
    expectedVersion: 4,
    idempotencyKey: "review-1",
  };
}

function setup(record = fact()) {
  const repository = { findById: vi.fn().mockResolvedValue(record) };
  const assertEvidence = { execute: vi.fn().mockResolvedValue(undefined) };
  const recordDateFact = {
    execute: vi.fn().mockResolvedValue({
      factId: "77777777-7777-4777-8777-777777777777",
      recordState: "recorded",
      applicationState: "applied",
      projectionVersion: 5,
    }),
  };
  return {
    service: new ApproveLifecycleDateFactReviewService(
      repository as never,
      assertEvidence as never,
      recordDateFact as never,
    ),
    repository,
    assertEvidence,
    recordDateFact,
  };
}

describe("ApproveLifecycleDateFactReviewService", () => {
  it("证据合格且复核人与录入人不同时追加确认版本", async () => {
    const context = setup();

    await expect(context.service.execute(command())).resolves.toMatchObject({
      applicationState: "applied",
      projectionVersion: 5,
    });

    expect(context.assertEvidence.execute).toHaveBeenCalledWith({
      tenantId: fact().tenantId,
      subjectType: "container",
      subjectId: fact().containerId,
      evidenceIds: fact().evidenceRefs,
    });
    expect(context.recordDateFact.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        occurredAt: "2026-09-20T10:00:00.000Z",
        verificationState: "verified",
        confidenceState: "confirmed",
        validity: "effective",
        supersedesFactId: fact().id,
        actorId: REVIEWER_ID,
        expectedVersion: 4,
        actorCapabilities: ["evidence.review"],
      }),
    );
  });

  it("禁止原录入人自批", async () => {
    const context = setup();

    await expect(
      context.service.execute({ ...command(), reviewerId: OPERATOR_ID }),
    ).rejects.toThrow("必须由另一名复核人批准");
    expect(context.assertEvidence.execute).not.toHaveBeenCalled();
  });

  it.each([
    { applicationState: "pending_application" as const },
    { timeKind: "estimated" as const },
  ])("拒绝已经离开待复核槽位的事实 %#", async (overrides) => {
    const context = setup(fact(overrides));

    await expect(context.service.execute(command())).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(context.recordDateFact.execute).not.toHaveBeenCalled();
  });

  it("相同幂等命令可在原事实被替代后继续交给统一写入链回放", async () => {
    const context = setup(fact({ isCurrent: false }));

    await context.service.execute(command());

    expect(context.recordDateFact.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        supersedesFactId: fact().id,
        idempotencyKey: "review-1",
      }),
    );
  });

  it("证据未核验时不追加确认版本", async () => {
    const context = setup();
    context.assertEvidence.execute.mockRejectedValue(
      new HttpException("EVIDENCE_REQUIRED", 422),
    );

    await expect(context.service.execute(command())).rejects.toThrow(
      "EVIDENCE_REQUIRED",
    );
    expect(context.recordDateFact.execute).not.toHaveBeenCalled();
  });
});
