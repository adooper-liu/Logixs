import { describe, expect, it, vi } from "vitest";
import type { LifecycleDateFactRecord } from "../domain/lifecycle-date-fact";
import { decodeDateReviewCursor } from "../domain/lifecycle-date-review-page";
import { ListLifecycleDateFactReviewsService } from "./list-lifecycle-date-fact-reviews.service";

function record(id: string, actorId = "operator-1"): LifecycleDateFactRecord {
  return {
    id,
    tenantId: "tenant-1",
    containerId: `container-${id}`,
    nodeCode: "container_stuffing",
    eventCode: "stuffed",
    timeKind: "actual",
    occurredAt: new Date("2026-09-20T00:00:00Z"),
    rawValue: "2026-09-20 08:00",
    sourceUtcOffset: "+08:00",
    ingestionChannel: "manual_ui",
    captureSource: "manual_backfill",
    sourceSystem: "logix.manual",
    authoritySystem: "ops-team",
    provider: null,
    interfaceCode: null,
    sourceEventId: null,
    mappingVersion: null,
    verificationState: "pending",
    confidenceState: "unknown",
    validity: "effective",
    authorityPolicyRef: null,
    location: null,
    evidenceRefs: ["evidence-1"],
    actorId,
    reasonCode: "manual",
    idempotencyKey: `key-${id}`,
    payloadHash: "hash",
    supersedesFactId: null,
    isCurrent: true,
    applicationState: "review_required",
    applicationReasonCode: "SOURCE_AUTHORITY_REVIEW_REQUIRED",
    canonicalEventId: null,
    projectionVersion: 2,
    traceId: "trace",
    receivedAt: new Date("2026-09-20T01:00:00Z"),
    recordedAt: new Date(`2026-09-20T01:00:0${id}Z`),
  };
}

describe("ListLifecycleDateFactReviewsService", () => {
  it("分页返回证据资格、允许动作与租户绑定 cursor", async () => {
    const rows = ["1", "2", "3"].map((id) => ({
      fact: record(id),
      orderNumber: `SO-${id}`,
      containerNumber: `MSCU-${id}`,
      currentProjectionVersion: 7,
    }));
    const repository = { listReviewRequired: vi.fn().mockResolvedValue(rows) };
    const evidence = {
      execute: vi.fn().mockResolvedValue([
        {
          id: "evidence-1",
          evidenceType: "document",
          authorityLevel: "operational",
          sourceType: "person",
          authoritySystem: "ops-team",
          verificationState: "verified",
          validity: "effective",
        },
      ]),
    };
    const service = new ListLifecycleDateFactReviewsService(
      repository as never,
      evidence as never,
    );

    const page = await service.execute({
      tenantId: "tenant-1",
      actorId: "reviewer-1",
      pageSize: "2",
    });

    expect(page.items).toHaveLength(2);
    expect(page.items[0]).toMatchObject({
      orderNumber: "SO-1",
      blockingReasons: [],
      allowedActions: ["approve"],
      evidence: [{ qualified: true }],
    });
    expect(page.pageInfo.hasNextPage).toBe(true);
    expect(decodeDateReviewCursor(page.pageInfo.nextCursor!)).toMatchObject({
      tenantId: "tenant-1",
      id: "2",
    });
    expect(repository.listReviewRequired).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      after: undefined,
      take: 3,
    });
  });

  it("自批或证据未核验时只读并给出阻塞原因", async () => {
    const repository = {
      listReviewRequired: vi.fn().mockResolvedValue([
        {
          fact: record("1", "reviewer-1"),
          orderNumber: "SO-1",
          containerNumber: null,
          currentProjectionVersion: 2,
        },
      ]),
    };
    const evidence = {
      execute: vi.fn().mockResolvedValue([
        {
          id: "evidence-1",
          evidenceType: "document",
          verificationState: "pending",
          validity: "effective",
        },
      ]),
    };
    const service = new ListLifecycleDateFactReviewsService(
      repository as never,
      evidence as never,
    );

    const page = await service.execute({
      tenantId: "tenant-1",
      actorId: "reviewer-1",
    });

    expect(page.items[0]?.allowedActions).toEqual([]);
    expect(page.items[0]?.blockingReasons).toEqual([
      "SELF_REVIEW_NOT_ALLOWED",
      "EVIDENCE_NOT_QUALIFIED",
    ]);
  });

  it("拒绝跨租户 cursor", async () => {
    const service = new ListLifecycleDateFactReviewsService(
      { listReviewRequired: vi.fn() } as never,
      { execute: vi.fn() } as never,
    );
    const cursor = Buffer.from(
      JSON.stringify({
        tenantId: "tenant-2",
        recordedAt: "2026-09-20T00:00:00Z",
        id: "1",
      }),
    ).toString("base64url");

    await expect(
      service.execute({ tenantId: "tenant-1", actorId: "r1", cursor }),
    ).rejects.toThrow("cursor 与过滤条件不匹配");
  });
});
