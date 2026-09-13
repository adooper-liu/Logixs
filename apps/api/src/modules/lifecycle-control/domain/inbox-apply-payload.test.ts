import { describe, expect, it } from "vitest";
import {
  assertInboxPayloadHash,
  hashInboxApplyPayload,
  parseInboxApplyPayload,
} from "./inbox-apply-payload";

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
});
