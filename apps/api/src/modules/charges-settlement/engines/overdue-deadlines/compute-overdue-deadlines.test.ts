import { describe, expect, it } from "vitest";
import {
  computeOverdueDeadlines,
  type OverdueStandard,
} from "./compute-overdue-deadlines";

function standard(
  overrides: Partial<OverdueStandard> &
    Pick<
      OverdueStandard,
      "id" | "chargeType" | "freeDays" | "calculationBasis"
    >,
): OverdueStandard {
  return {
    portId: "port-1",
    shippingCompanyId: "line-1",
    freightForwarderId: "ff-1",
    freeDaysBasis: "calendar_days",
    includeStartDay: true,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: null,
    transportMode: null,
    terminalId: null,
    ...overrides,
  };
}

const query = {
  portId: "port-1",
  shippingCompanyId: "line-1",
  freightForwarderId: "ff-1",
  referenceAt: new Date("2026-09-16T08:00:00.000Z"),
};

const clocks = {
  arrivalAt: new Date("2026-09-16T08:00:00.000Z"),
  dischargeAt: new Date("2026-09-16T12:00:00.000Z"),
  pickupAt: null as Date | null,
};

describe("computeOverdueDeadlines", () => {
  it("无命中则失败，不默认免费天数", () => {
    const decision = computeOverdueDeadlines({
      standards: [
        standard({
          id: "other",
          chargeType: "demurrage",
          freeDays: 7,
          calculationBasis: "arrival",
          portId: "port-x",
        }),
      ],
      query,
      clocks,
    });
    expect(decision).toMatchObject({
      kind: "reject",
      code: "BUSINESS_PRECONDITION_FAILED",
    });
  });

  it("多种费用取最小最晚提柜日和最晚还箱日", () => {
    const decision = computeOverdueDeadlines({
      standards: [
        standard({
          id: "dem",
          chargeType: "demurrage",
          freeDays: 5,
          calculationBasis: "arrival",
        }),
        standard({
          id: "sto",
          chargeType: "storage",
          freeDays: 3,
          calculationBasis: "discharge",
        }),
        standard({
          id: "det",
          chargeType: "detention",
          freeDays: 4,
          calculationBasis: "pickup",
        }),
        standard({
          id: "dd",
          chargeType: "dnd",
          freeDays: 7,
          calculationBasis: "arrival",
        }),
      ],
      query,
      clocks,
    });
    expect(decision.kind).toBe("apply");
    if (decision.kind !== "apply") return;
    expect(decision.deadlines.latestPickupAt?.toISOString()).toBe(
      "2026-09-18T00:00:00.000Z",
    );
    expect(decision.deadlines.latestReturnAt?.toISOString()).toBe(
      "2026-09-21T00:00:00.000Z",
    );
    expect(decision.deadlines.matchedStandardIds).toHaveLength(4);
  });

  it("船司不一致不命中", () => {
    const decision = computeOverdueDeadlines({
      standards: [
        standard({
          id: "dem",
          chargeType: "demurrage",
          freeDays: 5,
          calculationBasis: "arrival",
          shippingCompanyId: "line-2",
        }),
      ],
      query,
      clocks,
    });
    expect(decision.kind).toBe("reject");
  });

  it("滞箱在已有提柜时用提柜日起算，不用最晚提柜日", () => {
    const decision = computeOverdueDeadlines({
      standards: [
        standard({
          id: "det",
          chargeType: "detention",
          freeDays: 4,
          calculationBasis: "pickup",
        }),
      ],
      query,
      clocks: {
        ...clocks,
        pickupAt: new Date("2026-09-17T06:00:00.000Z"),
      },
    });
    expect(decision.kind).toBe("apply");
    if (decision.kind !== "apply") return;
    expect(decision.deadlines.latestPickupAt).toBeNull();
    expect(decision.deadlines.latestReturnAt?.toISOString()).toBe(
      "2026-09-20T00:00:00.000Z",
    );
  });
});
