import { describe, expect, it } from "vitest";
import {
  assertInboxPayloadHash,
  hashInboxApplyPayload,
  parseInboxApplyPayload,
  parseInboxMessagePayload,
} from "./inbox-apply-payload";
import {
  LIFECYCLE_DATE_FACT_INBOX_KIND,
  hashLifecycleDateFactInboxPayload,
} from "@logix/contracts/lifecycle-date-fact-inbox";
import { hashPostDepartureLifecycleCommand } from "@logix/contracts/post-departure-lifecycle";

const PAYLOAD = {
  containerId: "c1",
  eventCode: "stuffed",
  occurredAt: "2026-09-12T10:00:00.000Z",
  evidenceRefs: ["22222222-2222-4222-8222-222222222222"],
  idempotencyKey: "key-1",
};

describe("parseInboxApplyPayload / hash", () => {
  it("解析申请事件载荷并校验哈希", () => {
    const parsed = parseInboxApplyPayload(PAYLOAD);
    expect(parsed.containerId).toBe("c1");
    expect(parsed.eventCode).toBe("stuffed");
    const hash = hashInboxApplyPayload(parsed);
    expect(hash).toHaveLength(64);
    expect(assertInboxPayloadHash(parsed, hash)).toBe(hash);
  });

  it("缺字段或哈希不一致失败", () => {
    expect(() => parseInboxApplyPayload({})).toThrow("VALIDATION_FORMAT");
    const parsed = parseInboxApplyPayload(PAYLOAD);
    expect(() => assertInboxPayloadHash(parsed, "b".repeat(64))).toThrow(
      "payloadHash 与载荷不一致",
    );
  });

  it("解析并校验统一日期事实 Inbox 载荷", () => {
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

    const parsed = parseInboxMessagePayload(payload);
    expect(parsed).toEqual(payload);
    const hash = hashLifecycleDateFactInboxPayload(payload);
    expect(assertInboxPayloadHash(parsed, hash)).toBe(hash);
  });

  it("严格解析并校验 post-departure V2 命令", () => {
    const command = {
      shipmentId: "11111111-1111-4111-8111-111111111111",
      containerIds: ["container-1", "container-2"] as [string, ...string[]],
      flowDefinitionCode: "post_departure_ocean" as const,
      definitionVersion: 1,
      departureEventId: "22222222-2222-4222-8222-222222222222",
      relationshipVersion: 2,
      idempotencyKey: "handoff-2:post-departure",
      traceId: "trace-2",
    };

    const parsed = parseInboxMessagePayload(command);
    expect(parsed).toEqual({
      kind: "start_post_departure_lifecycle_v2",
      command,
    });
    expect(
      assertInboxPayloadHash(
        parsed,
        hashPostDepartureLifecycleCommand(command),
      ),
    ).toHaveLength(64);
    expect(() =>
      parseInboxMessagePayload({ ...command, unexpected: true }),
    ).toThrow("未知字段");
    expect(() =>
      parseInboxMessagePayload({
        ...command,
        containerIds: ["container-1", "container-1"],
      }),
    ).toThrow("不得重复");
  });
});
