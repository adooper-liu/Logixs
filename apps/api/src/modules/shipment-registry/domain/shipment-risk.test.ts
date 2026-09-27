import { describe, expect, it } from "vitest";
import {
  shipmentRisk,
  shipmentRiskSortValue,
  type ShipmentRiskInput,
} from "./shipment-risk";

const NOW = new Date("2026-09-27T12:00:00Z");

describe("shipmentRisk", () => {
  it("多条截止里取最早的那条，并说明是哪一类", () => {
    const risk = shipmentRisk(
      {
        deadlines: [
          { kind: "eta", at: new Date("2026-10-02T00:00:00Z") },
          { kind: "task_due", at: new Date("2026-09-28T09:00:00Z") },
        ],
        pendingGapCount: 0,
        openExceptionCount: 0,
        unassignedExceptionCount: 0,
      },
      NOW,
    );

    expect(risk.nearestDeadline).toEqual({
      kind: "task_due",
      at: new Date("2026-09-28T09:00:00Z"),
    });
    expect(risk.overdue).toBe(false);
  });

  it("已经过去的截止算逾期，不会被当成没有截止而排到后面", () => {
    const risk = shipmentRisk(
      {
        deadlines: [{ kind: "eta", at: new Date("2026-09-25T00:00:00Z") }],
        pendingGapCount: 0,
        openExceptionCount: 0,
        unassignedExceptionCount: 0,
      },
      NOW,
    );

    expect(risk.overdue).toBe(true);
    expect(risk.reasons).toContain("overdue_deadline");
    // 逾期必须排在所有未逾期之前
    expect(shipmentRiskSortValue(risk)).toBeLessThan(
      shipmentRiskSortValue(
        shipmentRisk(
          {
            deadlines: [{ kind: "eta", at: new Date("2026-09-28T00:00:00Z") }],
            pendingGapCount: 0,
            openExceptionCount: 0,
            unassignedExceptionCount: 0,
          },
          NOW,
        ),
      ),
    );
  });

  it("没有截止不等于没有风险，但排序上不得抢先于有时限的票", () => {
    const noDeadline = shipmentRisk(
      {
        deadlines: [],
        pendingGapCount: 3,
        openExceptionCount: 0,
        unassignedExceptionCount: 0,
      },
      NOW,
    );
    const farDeadline = shipmentRisk(
      {
        deadlines: [{ kind: "eta", at: new Date("2026-12-31T00:00:00Z") }],
        pendingGapCount: 0,
        openExceptionCount: 0,
        unassignedExceptionCount: 0,
      },
      NOW,
    );

    // 仍然进队列（有待补就是风险），且说清是待补
    expect(noDeadline.nearestDeadline).toBeNull();
    expect(noDeadline.reasons).toEqual(["pending_gaps"]);
    // 但"没有时限"不能被当成"最紧急"，必须排在有时限的后面
    expect(shipmentRiskSortValue(noDeadline)).toBeGreaterThan(
      shipmentRiskSortValue(farDeadline),
    );
  });

  it("待补只说待补，不冒充阻断或逾期", () => {
    const risk = shipmentRisk(
      {
        deadlines: [],
        pendingGapCount: 2,
        openExceptionCount: 0,
        unassignedExceptionCount: 0,
      },
      NOW,
    );

    expect(risk.reasons).toEqual(["pending_gaps"]);
    expect(risk.overdue).toBe(false);
  });

  it("未归属 Shipment 的异常单独说明，不混作没有异常", () => {
    const risk = shipmentRisk(
      {
        deadlines: [],
        pendingGapCount: 0,
        openExceptionCount: 0,
        unassignedExceptionCount: 2,
      },
      NOW,
    );

    expect(risk.reasons).toEqual(["unassigned_exceptions"]);
  });

  it("既无截止也无缺口无异常时不制造理由", () => {
    const risk = shipmentRisk(
      {
        deadlines: [],
        pendingGapCount: 0,
        openExceptionCount: 0,
        unassignedExceptionCount: 0,
      },
      NOW,
    );

    expect(risk.reasons).toEqual([]);
    expect(risk.nearestDeadline).toBeNull();
    expect(risk.overdue).toBe(false);
  });

  it("理由按紧迫度排序：逾期 > 异常 > 待补，便于界面按重要度呈现", () => {
    const risk = shipmentRisk(
      {
        deadlines: [{ kind: "task_due", at: new Date("2026-09-26T00:00:00Z") }],
        pendingGapCount: 1,
        openExceptionCount: 1,
        unassignedExceptionCount: 1,
      },
      NOW,
    );

    expect(risk.reasons).toEqual([
      "overdue_deadline",
      "open_exceptions",
      "unassigned_exceptions",
      "pending_gaps",
    ]);
  });
});

describe("shipmentRiskSortValue", () => {
  it("有截止返回截止时刻，没有截止返回正无穷，保证无时限的永远排在后面", () => {
    const input: ShipmentRiskInput = {
      deadlines: [{ kind: "eta", at: new Date("2026-09-28T00:00:00Z") }],
      pendingGapCount: 0,
      openExceptionCount: 0,
      unassignedExceptionCount: 0,
    };

    expect(shipmentRiskSortValue(shipmentRisk(input, NOW))).toBe(
      new Date("2026-09-28T00:00:00Z").getTime(),
    );
    expect(
      shipmentRiskSortValue(shipmentRisk({ ...input, deadlines: [] }, NOW)),
    ).toBe(Number.POSITIVE_INFINITY);
  });
});
