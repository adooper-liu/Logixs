import { describe, expect, it } from "vitest";
import type { DeadLetterItem } from "../api/deadLetters";
import {
  DEAD_LETTER_COLUMN_KEYS,
  assertDeadLetterRowSafe,
  toDeadLetterRow,
} from "./deadLetterQueueContract";

const item: DeadLetterItem = {
  id: "dl-1",
  eventId: "evt-1",
  eventType: "stuffed",
  aggregateType: "container",
  aggregateId: "c1",
  payloadRef: "canonical-event/evt-1",
  payloadHash: "a".repeat(64),
  attemptCount: 3,
  lastErrorCode: "timeout",
  failureCategory: "transient_technical",
  ownerQueue: "lifecycle-control-outbox",
  deadLetteredAt: "2026-09-13T00:00:00.000Z",
  occurredAt: "2026-09-13T00:00:00.000Z",
  causationId: null,
  traceId: "trace-1",
};

describe("toDeadLetterRow", () => {
  it("只投影受控引用与失败摘要", () => {
    const row = toDeadLetterRow(item);
    expect(Object.keys(row)).toEqual(["id", ...DEAD_LETTER_COLUMN_KEYS]);
    expect(row.objectRef).toBe("container/c1");
    expect(row.failureSummary).toBe("timeout · transient_technical");
    expect(row).not.toHaveProperty("payload");
    expect(JSON.stringify(row)).not.toContain("a".repeat(64));
    expect(() => assertDeadLetterRowSafe(row)).not.toThrow();
  });

  it("Inbox 行也只投影受控引用", () => {
    const row = toDeadLetterRow({
      ...item,
      id: "in-1",
      eventId: "msg-1",
      eventType: "lifecycle-control-inbox",
      aggregateType: "inbox",
      aggregateId: "msg-1",
      payloadRef: "inbox/in-1",
      ownerQueue: "lifecycle-control-inbox",
    });
    expect(row.objectRef).toBe("inbox/msg-1");
    expect(row.payloadRef).toBe("inbox/in-1");
    expect(JSON.stringify(row)).not.toContain("a".repeat(64));
    expect(() => assertDeadLetterRowSafe(row)).not.toThrow();
  });
});
