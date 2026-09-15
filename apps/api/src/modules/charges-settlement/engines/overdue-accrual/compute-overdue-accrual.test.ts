import { describe, expect, it } from "vitest";
import {
  computeOverdueAccrual,
  type AccrualLineInput,
  type RateTier,
} from "./compute-overdue-accrual";

function line(overrides: Partial<AccrualLineInput> = {}): AccrualLineInput {
  return {
    standardId: "dem",
    chargeType: "demurrage",
    lastFreeDay: new Date("2026-09-20T00:00:00.000Z"),
    asOf: new Date("2026-09-23T16:00:00.000Z"),
    tiers: [
      { fromDay: 1, toDay: 2, amount: "100.00", currency: "USD" },
      { fromDay: 3, toDay: null, amount: "200.00", currency: "USD" },
    ],
    ...overrides,
  };
}

describe("computeOverdueAccrual", () => {
  it("按每个计费日命中的阶梯求和，不写成总天数乘单一费率", () => {
    const decision = computeOverdueAccrual({
      purpose: "estimate",
      lines: [line()],
    });
    expect(decision.kind).toBe("apply");
    if (decision.kind !== "apply") return;
    expect(decision.purpose).toBe("estimate");
    expect(decision.lines).toHaveLength(1);
    expect(decision.lines[0]?.amount).toBe("400.00");
    expect(decision.lines[0]?.chargeDays).toBe(3);
    expect(decision.lines[0]?.daily.map((item) => item.rate)).toEqual([
      "100.00",
      "100.00",
      "200.00",
    ]);
    expect(decision.totals).toEqual([{ currency: "USD", amount: "400.00" }]);
  });

  it("预计与应计公式相同，只换标签", () => {
    const estimated = computeOverdueAccrual({
      purpose: "estimate",
      lines: [line()],
    });
    const accrued = computeOverdueAccrual({
      purpose: "accrual",
      lines: [line()],
    });
    expect(estimated.kind).toBe("apply");
    expect(accrued.kind).toBe("apply");
    if (estimated.kind !== "apply" || accrued.kind !== "apply") return;
    expect(accrued.purpose).toBe("accrual");
    expect(accrued.lines[0]?.amount).toBe(estimated.lines[0]?.amount);
    expect(accrued.lines[0]?.daily).toEqual(estimated.lines[0]?.daily);
  });

  it("免费期内金额为 0.00，不套默认费率", () => {
    const decision = computeOverdueAccrual({
      purpose: "accrual",
      lines: [line({ asOf: new Date("2026-09-20T12:00:00.000Z") })],
    });
    expect(decision.kind).toBe("apply");
    if (decision.kind !== "apply") return;
    expect(decision.lines[0]?.amount).toBe("0.00");
    expect(decision.lines[0]?.chargeDays).toBe(0);
    expect(decision.lines[0]?.daily).toEqual([]);
  });

  it("分项列出，不合成一个滞港费", () => {
    const storageTiers: RateTier[] = [
      { fromDay: 1, toDay: null, amount: "50.00", currency: "USD" },
    ];
    const decision = computeOverdueAccrual({
      purpose: "estimate",
      lines: [
        line(),
        line({
          standardId: "sto",
          chargeType: "storage",
          lastFreeDay: new Date("2026-09-18T00:00:00.000Z"),
          tiers: storageTiers,
        }),
      ],
    });
    expect(decision.kind).toBe("apply");
    if (decision.kind !== "apply") return;
    expect(decision.lines.map((item) => item.chargeType)).toEqual([
      "demurrage",
      "storage",
    ]);
    expect(decision.lines.map((item) => item.amount)).toEqual([
      "400.00",
      "250.00",
    ]);
    expect(decision.totals).toEqual([{ currency: "USD", amount: "650.00" }]);
  });

  it("计费日无阶梯则失败，不跳过", () => {
    expect(
      computeOverdueAccrual({
        purpose: "estimate",
        lines: [
          line({
            tiers: [
              { fromDay: 1, toDay: 2, amount: "100.00", currency: "USD" },
            ],
          }),
        ],
      }),
    ).toMatchObject({
      kind: "reject",
      code: "BUSINESS_PRECONDITION_FAILED",
    });
  });

  it("缺少阶梯则失败，不准默认日费率", () => {
    expect(
      computeOverdueAccrual({
        purpose: "estimate",
        lines: [line({ tiers: [] })],
      }),
    ).toMatchObject({
      kind: "reject",
      code: "BUSINESS_PRECONDITION_FAILED",
    });
  });

  it("未注册计费目的则失败", () => {
    expect(
      computeOverdueAccrual({
        purpose: "invoice",
        lines: [line()],
      }),
    ).toMatchObject({
      kind: "reject",
      code: "BUSINESS_PRECONDITION_FAILED",
    });
  });
});
