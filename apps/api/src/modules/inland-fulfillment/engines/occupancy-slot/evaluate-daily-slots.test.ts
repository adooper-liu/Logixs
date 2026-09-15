import { describe, expect, it } from "vitest";
import {
  evaluateDailySlots,
  occupancyDayKey,
  WAREHOUSE_RESOURCE_ID,
} from "./evaluate-daily-slots";

describe("evaluateDailySlots", () => {
  it("按日限额减已占用得到余量，不算方案", () => {
    const day = new Date("2026-09-16T08:00:00.000Z");
    const decision = evaluateDailySlots({
      days: [day],
      resources: [
        {
          resourceId: WAREHOUSE_RESOURCE_ID,
          dailyLimit: 10,
          occupiedByDay: { [occupancyDayKey(day)]: 3 },
        },
        {
          resourceId: "fleet-a",
          dailyLimit: 15,
          occupiedByDay: { [occupancyDayKey(day)]: 2 },
        },
      ],
    });
    expect(decision.kind).toBe("apply");
    if (decision.kind !== "apply") return;
    expect(decision.slots).toHaveLength(1);
    expect(decision.slots[0]?.remaining).toEqual({
      warehouse: 7,
      "fleet-a": 13,
    });
  });

  it("日限额为负则失败，不静默当 0", () => {
    expect(
      evaluateDailySlots({
        days: [new Date("2026-09-16T00:00:00.000Z")],
        resources: [
          {
            resourceId: WAREHOUSE_RESOURCE_ID,
            dailyLimit: -1,
            occupiedByDay: {},
          },
        ],
      }),
    ).toMatchObject({
      kind: "reject",
      code: "BUSINESS_PRECONDITION_FAILED",
    });
  });

  it("各日余量互不影响，缺占用记为 0", () => {
    const dayOne = new Date("2026-09-16T00:00:00.000Z");
    const dayTwo = new Date("2026-09-17T00:00:00.000Z");
    const decision = evaluateDailySlots({
      days: [dayOne, dayTwo],
      resources: [
        {
          resourceId: WAREHOUSE_RESOURCE_ID,
          dailyLimit: 10,
          occupiedByDay: { [occupancyDayKey(dayOne)]: 10 },
        },
      ],
    });
    expect(decision.kind).toBe("apply");
    if (decision.kind !== "apply") return;
    expect(decision.slots.map((slot) => slot.remaining.warehouse)).toEqual([
      0, 10,
    ]);
  });

  it("资源标识重复则失败", () => {
    expect(
      evaluateDailySlots({
        days: [new Date("2026-09-16T00:00:00.000Z")],
        resources: [
          {
            resourceId: "fleet-a",
            dailyLimit: 1,
            occupiedByDay: {},
          },
          {
            resourceId: "fleet-a",
            dailyLimit: 2,
            occupiedByDay: {},
          },
        ],
      }),
    ).toMatchObject({
      kind: "reject",
      code: "BUSINESS_PRECONDITION_FAILED",
    });
  });
});
