import { describe, expect, it } from "vitest";
import {
  assertInboxReplayPayload,
  buildInboxReplayRequest,
  buildReplayInbox,
  decideReplayInboxDeadLetter,
  parseInboxPayloadRef,
  resolveInboxReplayPayload,
  type StoredInboxDeadLetter,
} from "./inbox-replay";

const ORIGINAL: StoredInboxDeadLetter = {
  id: "in-1",
  tenantId: "t1",
  consumerName: "lifecycle-control-inbox",
  messageId: "11111111-1111-4111-8111-111111111111",
  payloadHash: "a".repeat(64),
  payloadJson: { containerId: "c1" },
  state: "dead_letter",
  attemptCount: 3,
  lastErrorCode: "timeout",
  failureCategory: "transient_technical",
  ownerQueue: "lifecycle-control-inbox",
  deadLetteredAt: new Date("2026-09-13T00:00:00.000Z"),
  receivedAt: new Date("2026-09-12T10:00:00.000Z"),
  causationId: null,
  traceId: "trace-old",
};

const REPLAY_ID = "33333333-3333-4333-8333-333333333333";
const REPLAY_MESSAGE_ID = "44444444-4444-4444-8444-444444444444";

describe("decideReplayInboxDeadLetter", () => {
  it("跨租户拒绝", () => {
    expect(
      decideReplayInboxDeadLetter({
        state: "dead_letter",
        tenantId: "t1",
        commandTenantId: "other",
      }),
    ).toMatchObject({ kind: "reject", code: "AUTHORIZATION_SCOPE_DENIED" });
  });

  it("非死信拒绝", () => {
    expect(
      decideReplayInboxDeadLetter({
        state: "processed",
        tenantId: "t1",
        commandTenantId: "t1",
      }),
    ).toMatchObject({ kind: "reject", code: "BUSINESS_STATE_VIOLATION" });
  });

  it("死信且同租户可通过", () => {
    expect(
      decideReplayInboxDeadLetter({
        state: "dead_letter",
        tenantId: "t1",
        commandTenantId: "t1",
      }),
    ).toEqual({ kind: "ok" });
  });
});

describe("buildReplayInbox", () => {
  it("新 received 不复用 messageId，causationId 指向原消息", () => {
    const replay = buildReplayInbox({
      original: ORIGINAL,
      replayId: REPLAY_ID,
      replayMessageId: REPLAY_MESSAGE_ID,
      requestedAt: new Date("2026-09-13T01:00:00.000Z"),
      traceId: "trace-new",
    });
    expect(replay.state).toBe("received");
    expect(replay.messageId).toBe(REPLAY_MESSAGE_ID);
    expect(replay.causationId).toBe(ORIGINAL.messageId);
    expect(replay.payloadHash).toBe(ORIGINAL.payloadHash);
    expect(replay.payloadJson).toEqual({ containerId: "c1" });
    expect(replay.attemptCount).toBe(0);
  });

  it("复用原 messageId 拒绝", () => {
    expect(() =>
      buildReplayInbox({
        original: ORIGINAL,
        replayId: REPLAY_ID,
        replayMessageId: ORIGINAL.messageId,
        requestedAt: new Date(),
        traceId: "trace-new",
      }),
    ).toThrow("VALIDATION_FORMAT");
  });

  it("缺少载荷拒绝", () => {
    expect(() => assertInboxReplayPayload(null)).toThrow(
      "BUSINESS_STATE_VIOLATION",
    );
  });

  it("修正载荷写入新 hash，仍用新 messageId", () => {
    const replay = buildReplayInbox({
      original: ORIGINAL,
      replayId: REPLAY_ID,
      replayMessageId: REPLAY_MESSAGE_ID,
      requestedAt: new Date("2026-09-13T01:00:00.000Z"),
      traceId: "trace-new",
      payloadHash: "b".repeat(64),
      payloadJson: { containerId: "c2" },
    });
    expect(replay.messageId).toBe(REPLAY_MESSAGE_ID);
    expect(replay.causationId).toBe(ORIGINAL.messageId);
    expect(replay.payloadHash).toBe("b".repeat(64));
    expect(replay.payloadJson).toEqual({ containerId: "c2" });
  });
});

describe("resolveInboxReplayPayload", () => {
  it("无修正时用原载荷", () => {
    expect(resolveInboxReplayPayload({ original: ORIGINAL })).toEqual({
      payloadRef: "inbox/in-1",
      payloadHash: ORIGINAL.payloadHash,
      payloadJson: { containerId: "c1" },
      corrected: false,
    });
  });

  it("引用另一 Inbox 时标记 corrected", () => {
    const source = {
      id: "in-2",
      consumerName: ORIGINAL.consumerName,
      payloadHash: "b".repeat(64),
      payloadJson: { containerId: "c2" },
    };
    expect(
      resolveInboxReplayPayload({
        original: ORIGINAL,
        payloadRef: "inbox/in-2",
        payloadHash: source.payloadHash,
        source,
      }),
    ).toEqual({
      payloadRef: "inbox/in-2",
      payloadHash: source.payloadHash,
      payloadJson: { containerId: "c2" },
      corrected: true,
    });
  });

  it("payloadRef 不是 inbox/{id} 拒绝", () => {
    expect(() => parseInboxPayloadRef("canonical-event/x")).toThrow(
      "VALIDATION_FORMAT",
    );
  });

  it("缺源行或哈希不一致拒绝", () => {
    expect(() =>
      resolveInboxReplayPayload({
        original: ORIGINAL,
        payloadRef: "inbox/in-2",
        payloadHash: "b".repeat(64),
      }),
    ).toThrow("VALIDATION_FORMAT");
    expect(() =>
      resolveInboxReplayPayload({
        original: ORIGINAL,
        payloadRef: "inbox/in-2",
        payloadHash: "c".repeat(64),
        source: {
          id: "in-2",
          consumerName: ORIGINAL.consumerName,
          payloadHash: "b".repeat(64),
          payloadJson: { containerId: "c2" },
        },
      }),
    ).toThrow("VALIDATION_FORMAT");
  });
});

describe("buildInboxReplayRequest", () => {
  it("记录新 Inbox 引用且不改原死信 id", () => {
    const replay = buildReplayInbox({
      original: ORIGINAL,
      replayId: REPLAY_ID,
      replayMessageId: REPLAY_MESSAGE_ID,
      requestedAt: new Date("2026-09-13T01:00:00.000Z"),
      traceId: "trace-new",
    });
    const request = buildInboxReplayRequest({
      originalId: ORIGINAL.id,
      replay,
      targetConsumerVersion: "consumer-v1",
      requestedBy: "op-1",
      reasonCode: "manual_replay",
      requestedAt: replay.receivedAt,
      commandIdempotencyKey: "replay-1",
      requestHash: "b".repeat(64),
    });
    expect(request.deadLetterId).toBe(ORIGINAL.id);
    expect(request.replayedInboxId).toBe(REPLAY_ID);
    expect(request.replayedMessageId).toBe(REPLAY_MESSAGE_ID);
  });
});
