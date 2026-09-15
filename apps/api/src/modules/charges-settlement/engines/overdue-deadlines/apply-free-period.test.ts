import { describe, expect, it } from "vitest";
import { applyFreePeriod } from "./apply-free-period";

describe("applyFreePeriod", () => {
  it("含首日：5 个自然日从 16 日到 20 日", () => {
    const result = applyFreePeriod({
      startAt: new Date("2026-09-16T08:00:00.000Z"),
      freeDays: 5,
      basis: "calendar_days",
      includeStartDay: true,
    });
    expect(result.kind).toBe("apply");
    if (result.kind === "apply") {
      expect(result.lastFreeDay.toISOString()).toBe("2026-09-20T00:00:00.000Z");
    }
  });

  it("不含首日：5 天加在起算日之后", () => {
    const result = applyFreePeriod({
      startAt: new Date("2026-09-16T08:00:00.000Z"),
      freeDays: 5,
      basis: "calendar_days",
      includeStartDay: false,
    });
    expect(result.kind).toBe("apply");
    if (result.kind === "apply") {
      expect(result.lastFreeDay.toISOString()).toBe("2026-09-21T00:00:00.000Z");
    }
  });

  it("未注册日历基准失败，不套默认", () => {
    expect(
      applyFreePeriod({
        startAt: new Date("2026-09-16T00:00:00.000Z"),
        freeDays: 7,
        basis: "business_days",
        includeStartDay: true,
      }),
    ).toMatchObject({
      kind: "reject",
      code: "BUSINESS_PRECONDITION_FAILED",
    });
  });
});
