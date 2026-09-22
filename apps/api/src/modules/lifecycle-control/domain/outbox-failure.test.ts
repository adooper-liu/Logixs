import { describe, expect, it } from "vitest";
import {
  OutboxDeliveryError,
  classifyOutboxDeliveryError,
  decideOutboxFailure,
} from "./outbox-failure";

const NOW = new Date("2026-09-13T00:00:00.000Z");
const CREATED = new Date("2026-09-13T00:00:00.000Z");

describe("classifyOutboxDeliveryError", () => {
  it("已知码保留分类，未知 Error 视为 unknown_code", () => {
    expect(
      classifyOutboxDeliveryError(new OutboxDeliveryError("timeout")),
    ).toEqual({
      errorCode: "timeout",
      failureCategory: "transient_technical",
    });
    expect(classifyOutboxDeliveryError(new Error("broker down"))).toEqual({
      errorCode: "unknown_code",
      failureCategory: "unknown_code",
    });
    expect(
      classifyOutboxDeliveryError(new OutboxDeliveryError("not_a_known_code")),
    ).toEqual({
      errorCode: "unknown_code",
      failureCategory: "unknown_code",
    });
  });
});

describe("decideOutboxFailure", () => {
  it("可重试失败进入 retry_wait，首次退避 5 秒", () => {
    expect(
      decideOutboxFailure({
        attemptCount: 1,
        createdAt: CREATED,
        now: NOW,
        error: new OutboxDeliveryError("timeout"),
      }),
    ).toEqual({
      state: "retry_wait",
      nextAttemptAt: new Date("2026-09-13T00:00:05.000Z"),
      lastErrorCode: "timeout",
      failureCategory: "transient_technical",
    });
  });

  it("第二次可重试退避 10 秒", () => {
    const decision = decideOutboxFailure({
      attemptCount: 2,
      createdAt: CREATED,
      now: NOW,
      error: new OutboxDeliveryError("network_error"),
    });
    expect(decision).toMatchObject({
      state: "retry_wait",
      lastErrorCode: "network_error",
    });
    if (decision.state === "retry_wait") {
      expect(decision.nextAttemptAt.toISOString()).toBe(
        "2026-09-13T00:00:10.000Z",
      );
    }
  });

  it.each(["task_not_initialized", "concurrency_conflict"])(
    "%s 保持可重试，不提前进入死信",
    (errorCode) => {
      expect(
        decideOutboxFailure({
          attemptCount: 1,
          createdAt: CREATED,
          now: NOW,
          error: new OutboxDeliveryError(errorCode),
        }),
      ).toMatchObject({
        state: "retry_wait",
        lastErrorCode: errorCode,
        failureCategory: "dependency",
      });
    },
  );

  it("不可重试或次数用尽进入 dead_letter", () => {
    expect(
      decideOutboxFailure({
        attemptCount: 1,
        createdAt: CREATED,
        now: NOW,
        error: new OutboxDeliveryError("business_rejected"),
      }),
    ).toMatchObject({
      state: "dead_letter",
      lastErrorCode: "business_rejected",
      failureCategory: "business",
      ownerQueue: "lifecycle-control-outbox",
      deadLetteredAt: NOW,
    });
    expect(
      decideOutboxFailure({
        attemptCount: 3,
        createdAt: CREATED,
        now: NOW,
        error: new OutboxDeliveryError("timeout"),
      }),
    ).toMatchObject({
      state: "dead_letter",
      lastErrorCode: "timeout",
    });
  });

  it("超过总时限进入 dead_letter", () => {
    expect(
      decideOutboxFailure({
        attemptCount: 1,
        createdAt: new Date("2026-09-12T23:54:59.000Z"),
        now: NOW,
        error: new OutboxDeliveryError("timeout"),
      }),
    ).toMatchObject({
      state: "dead_letter",
      lastErrorCode: "timeout",
    });
  });
});
