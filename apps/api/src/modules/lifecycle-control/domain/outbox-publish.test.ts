import { describe, expect, it } from "vitest";
import {
  beginOutboxPublishing,
  completeOutboxPublished,
  isOutboxClaimable,
  parseDrainRounds,
  parsePublishBatchLimit,
  shouldContinueOutboxDrain,
} from "./outbox-publish";

const NOW = new Date("2026-09-13T00:00:00.000Z");

describe("parsePublishBatchLimit", () => {
  it("默认 50，拒绝越界", () => {
    expect(parsePublishBatchLimit(undefined)).toBe(50);
    expect(parsePublishBatchLimit("10")).toBe(10);
    expect(() => parsePublishBatchLimit("0")).toThrow("VALIDATION_FORMAT");
    expect(() => parsePublishBatchLimit("201")).toThrow("VALIDATION_FORMAT");
    expect(() => parsePublishBatchLimit("1.5")).toThrow("VALIDATION_FORMAT");
  });
});

describe("parseDrainRounds / shouldContinueOutboxDrain", () => {
  it("默认 5 轮，拒绝越界", () => {
    expect(parseDrainRounds(undefined)).toBe(5);
    expect(parseDrainRounds("3")).toBe(3);
    expect(() => parseDrainRounds("0")).toThrow("VALIDATION_FORMAT");
    expect(() => parseDrainRounds("21")).toThrow("VALIDATION_FORMAT");
  });

  it("有领取且未到上限则继续，领完或到上限则停", () => {
    expect(
      shouldContinueOutboxDrain({ claimed: 2, round: 1, maxRounds: 5 }),
    ).toBe(true);
    expect(
      shouldContinueOutboxDrain({ claimed: 0, round: 1, maxRounds: 5 }),
    ).toBe(false);
    expect(
      shouldContinueOutboxDrain({ claimed: 2, round: 5, maxRounds: 5 }),
    ).toBe(false);
  });
});

describe("isOutboxClaimable", () => {
  it("pending 与 retry_wait 可领，published/dead_letter 不可领", () => {
    expect(
      isOutboxClaimable({
        state: "pending",
        lease: null,
        nextAttemptAt: null,
        now: NOW,
      }),
    ).toBe(true);
    expect(
      isOutboxClaimable({
        state: "retry_wait",
        lease: null,
        nextAttemptAt: null,
        now: NOW,
      }),
    ).toBe(true);
    expect(
      isOutboxClaimable({
        state: "published",
        lease: null,
        nextAttemptAt: null,
        now: NOW,
      }),
    ).toBe(false);
    expect(
      isOutboxClaimable({
        state: "dead_letter",
        lease: null,
        nextAttemptAt: null,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("活跃租约不可领，过期或无租约的 publishing 可接管", () => {
    expect(
      isOutboxClaimable({
        state: "publishing",
        lease: {
          owner: "op-1",
          lockedAt: NOW,
          expiresAt: new Date("2026-09-13T00:00:30.000Z"),
        },
        nextAttemptAt: null,
        now: NOW,
      }),
    ).toBe(false);
    expect(
      isOutboxClaimable({
        state: "publishing",
        lease: {
          owner: "op-1",
          lockedAt: new Date("2026-09-12T23:59:00.000Z"),
          expiresAt: NOW,
        },
        nextAttemptAt: null,
        now: NOW,
      }),
    ).toBe(true);
    expect(
      isOutboxClaimable({
        state: "publishing",
        lease: null,
        nextAttemptAt: null,
        now: NOW,
      }),
    ).toBe(true);
  });

  it("未到 nextAttemptAt 不可领", () => {
    expect(
      isOutboxClaimable({
        state: "pending",
        lease: null,
        nextAttemptAt: new Date("2026-09-13T00:01:00.000Z"),
        now: NOW,
      }),
    ).toBe(false);
  });
});

describe("beginOutboxPublishing / completeOutboxPublished", () => {
  it("领取后 attempt+1 并写入租约", () => {
    const next = beginOutboxPublishing({
      attemptCount: 0,
      owner: "op-1",
      now: NOW,
      leaseSeconds: 30,
    });
    expect(next.state).toBe("publishing");
    expect(next.attemptCount).toBe(1);
    expect(next.lease.owner).toBe("op-1");
    expect(next.lease.expiresAt.toISOString()).toBe("2026-09-13T00:00:30.000Z");
  });

  it("published 必须带 broker reference", () => {
    expect(() =>
      completeOutboxPublished({
        brokerReference: "  ",
        publishedAt: NOW,
      }),
    ).toThrow("VALIDATION_FORMAT");
    expect(
      completeOutboxPublished({
        brokerReference: "stub:evt-1",
        publishedAt: NOW,
      }),
    ).toEqual({
      state: "published",
      brokerReference: "stub:evt-1",
      publishedAt: NOW,
    });
  });
});
