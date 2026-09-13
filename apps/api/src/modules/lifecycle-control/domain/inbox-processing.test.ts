import { describe, expect, it } from "vitest";
import {
  beginInboxProcessing,
  completeInboxProcessed,
  isInboxClaimable,
  parseInboxClaimLimit,
} from "./inbox-processing";

const NOW = new Date("2026-09-13T00:00:00.000Z");

describe("parseInboxClaimLimit", () => {
  it("默认 50，拒绝越界", () => {
    expect(parseInboxClaimLimit(undefined)).toBe(50);
    expect(parseInboxClaimLimit("10")).toBe(10);
    expect(() => parseInboxClaimLimit("0")).toThrow("VALIDATION_FORMAT");
    expect(() => parseInboxClaimLimit("201")).toThrow("VALIDATION_FORMAT");
    expect(() => parseInboxClaimLimit("1.5")).toThrow("VALIDATION_FORMAT");
  });
});

describe("isInboxClaimable", () => {
  it("received 与到期 retry_wait 可领，processed/dead_letter 不可领", () => {
    expect(isInboxClaimable({ state: "received", lease: null, now: NOW })).toBe(
      true,
    );
    expect(
      isInboxClaimable({ state: "retry_wait", lease: null, now: NOW }),
    ).toBe(true);
    expect(
      isInboxClaimable({
        state: "retry_wait",
        lease: null,
        nextAttemptAt: new Date("2026-09-13T00:01:00.000Z"),
        now: NOW,
      }),
    ).toBe(false);
    expect(
      isInboxClaimable({ state: "processed", lease: null, now: NOW }),
    ).toBe(false);
    expect(
      isInboxClaimable({ state: "dead_letter", lease: null, now: NOW }),
    ).toBe(false);
  });

  it("活跃租约不可领，过期或无租约的 processing 可接管", () => {
    expect(
      isInboxClaimable({
        state: "processing",
        lease: {
          owner: "service:logix-outbox-publisher",
          lockedAt: NOW,
          expiresAt: new Date("2026-09-13T00:00:30.000Z"),
        },
        now: NOW,
      }),
    ).toBe(false);
    expect(
      isInboxClaimable({
        state: "processing",
        lease: {
          owner: "service:logix-outbox-publisher",
          lockedAt: new Date("2026-09-12T23:59:00.000Z"),
          expiresAt: NOW,
        },
        now: NOW,
      }),
    ).toBe(true);
    expect(
      isInboxClaimable({
        state: "processing",
        lease: null,
        now: NOW,
      }),
    ).toBe(true);
  });
});

describe("beginInboxProcessing", () => {
  it("领取后 attempt+1 并写入租约", () => {
    const next = beginInboxProcessing({
      attemptCount: 0,
      owner: "service:logix-outbox-publisher",
      now: NOW,
      leaseSeconds: 30,
    });
    expect(next.state).toBe("processing");
    expect(next.attemptCount).toBe(1);
    expect(next.lease.owner).toBe("service:logix-outbox-publisher");
    expect(next.lease.expiresAt.toISOString()).toBe("2026-09-13T00:00:30.000Z");
  });

  it("拒绝空 owner", () => {
    expect(() =>
      beginInboxProcessing({
        attemptCount: 0,
        owner: "  ",
        now: NOW,
      }),
    ).toThrow("VALIDATION_FORMAT");
  });
});

describe("completeInboxProcessed", () => {
  it("写入 processed 与 processedAt", () => {
    expect(completeInboxProcessed({ processedAt: NOW })).toEqual({
      state: "processed",
      processedAt: NOW,
    });
  });

  it("拒绝无效时间", () => {
    expect(() =>
      completeInboxProcessed({ processedAt: new Date("not-a-date") }),
    ).toThrow("VALIDATION_FORMAT");
  });
});
