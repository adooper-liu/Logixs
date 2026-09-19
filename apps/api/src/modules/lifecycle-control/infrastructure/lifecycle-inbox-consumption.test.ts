import { describe, expect, it, vi } from "vitest";
import {
  LIFECYCLE_DATE_FACT_INBOX_KIND,
  hashLifecycleDateFactInboxPayload,
} from "@logix/contracts/lifecycle-date-fact-inbox";
import {
  hashInboxApplyPayload,
  parseInboxApplyPayload,
} from "../domain/inbox-apply-payload";
import { LifecycleInboxConsumption } from "./lifecycle-inbox-consumption";

describe("LifecycleInboxConsumption", () => {
  it("把导入日期消息交给统一日期事实用例且不授予来源权威", async () => {
    const recordLifecycleDateFact = {
      execute: vi
        .fn()
        .mockResolvedValue({ applicationState: "review_required" }),
    };
    const payload = {
      kind: LIFECYCLE_DATE_FACT_INBOX_KIND,
      command: {
        tenantId: "22222222-2222-4222-8222-222222222222",
        containerId: "33333333-3333-4333-8333-333333333333",
        nodeCode: "customs_clearance" as const,
        eventCode: "container_customs_completed" as const,
        timeKind: "actual" as const,
        occurredAt: "2026-04-09T20:58:00.000Z",
        rawValue: "2026-04-09 22:58:00",
        sourceUtcOffset: "+02:00",
        ingestionChannel: "file_import" as const,
        captureSource: "controlled_import" as const,
        sourceSystem: "legacy-lms",
        authoritySystem: "customs-authority",
        verificationState: "pending" as const,
        confidenceState: "unknown" as const,
        validity: "effective" as const,
        evidenceRefs: ["11111111-1111-4111-8111-111111111111"],
        idempotencyKey: "import-date-fact:1",
        traceId: "import:1",
      },
    };
    const consumer = new LifecycleInboxConsumption(
      recordLifecycleDateFact as never,
    );

    await consumer.consume({
      id: "inbox-1",
      tenantId: payload.command.tenantId,
      consumerName: "lifecycle-control-inbox",
      messageId: "11111111-1111-4111-8111-111111111111",
      payloadHash: hashLifecycleDateFactInboxPayload(payload),
      payloadJson: payload,
      state: "processing",
      attemptCount: 1,
      lease: {
        owner: "worker-1",
        lockedAt: new Date("2026-09-18T10:00:00Z"),
        expiresAt: new Date("2026-09-18T10:01:00Z"),
      },
      traceId: "import:1",
      receivedAt: new Date("2026-09-18T10:00:00Z"),
    });

    expect(recordLifecycleDateFact.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        ingestionChannel: "file_import",
        completeInbox: expect.objectContaining({
          id: "inbox-1",
          owner: "worker-1",
        }),
      }),
    );
  });

  it("旧 Inbox 直推事件缺少日期事实时进入业务拒绝", async () => {
    const payload = {
      containerId: "33333333-3333-4333-8333-333333333333",
      eventCode: "stuffed",
      occurredAt: "2026-09-18T10:00:00.000Z",
      evidenceRefs: ["11111111-1111-4111-8111-111111111111"],
      idempotencyKey: "legacy-direct-apply:1",
    };
    const recordLifecycleDateFact = { execute: vi.fn() };
    const consumer = new LifecycleInboxConsumption(
      recordLifecycleDateFact as never,
    );

    await expect(
      consumer.consume({
        id: "inbox-legacy",
        tenantId: "22222222-2222-4222-8222-222222222222",
        consumerName: "lifecycle-control-inbox",
        messageId: "44444444-4444-4444-8444-444444444444",
        payloadHash: hashInboxApplyPayload(parseInboxApplyPayload(payload)),
        payloadJson: payload,
        state: "processing",
        attemptCount: 1,
        lease: {
          owner: "worker-1",
          lockedAt: new Date("2026-09-18T10:00:00Z"),
          expiresAt: new Date("2026-09-18T10:01:00Z"),
        },
        traceId: "legacy:1",
        receivedAt: new Date("2026-09-18T10:00:00Z"),
      }),
    ).rejects.toMatchObject({
      errorCode: "business_rejected",
      message: expect.stringContaining("LIFECYCLE_EVENT_NOT_STATE_EVIDENCE"),
    });
    expect(recordLifecycleDateFact.execute).not.toHaveBeenCalled();
  });
});
