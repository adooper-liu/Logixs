import { describe, expect, it } from "vitest";
import {
  assertReplayCommand,
  buildReplayOutbox,
  buildReplayRequest,
  compareReplayIdempotency,
  decideReplayDeadLetter,
  hashReplayRequest,
  resolveReplayPayload,
  type StoredOutboxMessage,
} from "./outbox-replay";

const ORIGINAL: StoredOutboxMessage = {
  id: "dl-1",
  tenantId: "t1",
  ownerModule: "lifecycle-control",
  eventId: "evt-1",
  eventType: "stuffed",
  eventVersion: 1,
  aggregateType: "container",
  aggregateId: "c1",
  payloadRef: "canonical-event/evt-1",
  payloadHash: "a".repeat(64),
  state: "dead_letter",
  attemptCount: 3,
  occurredAt: new Date("2026-09-12T10:00:00.000Z"),
  idempotencyKey: "key-1",
  causationId: null,
  traceId: "trace-old",
};

const PAYLOAD = {
  payloadRef: ORIGINAL.payloadRef,
  payloadHash: ORIGINAL.payloadHash,
};

function replayDraft() {
  return buildReplayOutbox({
    original: ORIGINAL,
    replayEventId: "evt-replay",
    commandIdempotencyKey: "replay-1",
    requestedAt: new Date("2026-09-13T00:00:00.000Z"),
    traceId: "trace-new",
    ...PAYLOAD,
  });
}

describe("decideReplayDeadLetter", () => {
  it("跨租户拒绝", () => {
    expect(
      decideReplayDeadLetter({
        state: "dead_letter",
        tenantId: "t1",
        commandTenantId: "other",
      }),
    ).toMatchObject({ kind: "reject", code: "AUTHORIZATION_SCOPE_DENIED" });
  });

  it("非死信拒绝", () => {
    expect(
      decideReplayDeadLetter({
        state: "pending",
        tenantId: "t1",
        commandTenantId: "t1",
      }),
    ).toMatchObject({ kind: "reject", code: "BUSINESS_STATE_VIOLATION" });
  });

  it("死信且同租户可通过", () => {
    expect(
      decideReplayDeadLetter({
        state: "dead_letter",
        tenantId: "t1",
        commandTenantId: "t1",
      }),
    ).toEqual({ kind: "ok" });
  });
});

describe("buildReplayOutbox", () => {
  it("新 eventId、causationId 指向原事件，载荷不变", () => {
    const replay = replayDraft();
    expect(replay.eventId).toBe("evt-replay");
    expect(replay.causationId).toBe("evt-1");
    expect(replay.payloadRef).toBe(ORIGINAL.payloadRef);
    expect(replay.payloadHash).toBe(ORIGINAL.payloadHash);
  });

  it("禁止复用原 eventId", () => {
    expect(() =>
      buildReplayOutbox({
        original: ORIGINAL,
        replayEventId: "evt-1",
        commandIdempotencyKey: "replay-1",
        requestedAt: new Date(),
        traceId: "trace-new",
        ...PAYLOAD,
      }),
    ).toThrow("VALIDATION_FORMAT");
  });
});

describe("assertReplayCommand / resolveReplayPayload / hash", () => {
  it("拒绝空原因或只给一半载荷", () => {
    expect(() =>
      assertReplayCommand({
        reasonCode: " ",
        targetConsumerVersion: "v1",
        idempotencyKey: "k1",
        requestedBy: "op-1",
      }),
    ).toThrow("VALIDATION_FORMAT");
    expect(() =>
      assertReplayCommand({
        reasonCode: "manual_replay",
        targetConsumerVersion: "v1",
        idempotencyKey: "k1",
        requestedBy: "op-1",
        payloadRef: "canonical-event/new",
      }),
    ).toThrow("VALIDATION_FORMAT");
    expect(() =>
      assertReplayCommand({
        reasonCode: "manual_replay",
        targetConsumerVersion: "v1",
        idempotencyKey: "k1",
        requestedBy: "op-1",
        payloadRef: "canonical-event/new",
        payloadHash: "not-a-hash",
      }),
    ).toThrow("VALIDATION_FORMAT");
  });

  it("未给修正则沿用原载荷；修正后标记 corrected", () => {
    expect(resolveReplayPayload({ original: ORIGINAL })).toEqual({
      payloadRef: ORIGINAL.payloadRef,
      payloadHash: ORIGINAL.payloadHash,
      corrected: false,
    });
    const corrected = resolveReplayPayload({
      original: ORIGINAL,
      payloadRef: "canonical-event/new",
      payloadHash: "b".repeat(64),
    });
    expect(corrected.corrected).toBe(true);
    expect(corrected.payloadRef).toBe("canonical-event/new");
  });

  it("同键同哈希 replay，异哈希或空存储冲突", () => {
    const hash = hashReplayRequest({
      reasonCode: "manual_replay",
      targetConsumerVersion: "consumer-v1",
      ...PAYLOAD,
    });
    expect(compareReplayIdempotency(hash, hash)).toBe("replay");
    expect(compareReplayIdempotency("c".repeat(64), hash)).toBe("conflict");
    expect(compareReplayIdempotency(null, hash)).toBe("conflict");
    expect(compareReplayIdempotency("", hash)).toBe("conflict");
  });

  it("重放请求带 requestHash", () => {
    const requestHash = hashReplayRequest({
      reasonCode: "manual_replay",
      targetConsumerVersion: "consumer-v1",
      ...PAYLOAD,
    });
    const request = buildReplayRequest({
      originalId: ORIGINAL.id,
      replay: replayDraft(),
      targetConsumerVersion: "consumer-v1",
      requestedBy: "op-1",
      reasonCode: "manual_replay",
      requestedAt: new Date("2026-09-13T00:00:00.000Z"),
      commandIdempotencyKey: "replay-1",
      requestHash,
    });
    expect(request.requestHash).toBe(requestHash);
  });
});
