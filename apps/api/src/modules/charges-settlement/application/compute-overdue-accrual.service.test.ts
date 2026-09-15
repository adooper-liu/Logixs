import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { OVERDUE_STANDARD_REPOSITORY } from "../domain/overdue-standard.repository";
import { ComputeOverdueAccrualService } from "./compute-overdue-accrual.service";

const standard = {
  id: "dem",
  portId: "port-1",
  shippingCompanyId: "line-1",
  freightForwarderId: "ff-1",
  chargeType: "demurrage",
  freeDays: 5,
  freeDaysBasis: "calendar_days",
  calculationBasis: "arrival",
  includeStartDay: true,
  effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
  effectiveTo: null,
  transportMode: null,
  terminalId: null,
};

const tiers = [
  {
    standardId: "dem",
    fromDay: 1,
    toDay: 2,
    amount: "100.00",
    currency: "USD",
  },
  {
    standardId: "dem",
    fromDay: 3,
    toDay: null,
    amount: "200.00",
    currency: "USD",
  },
];

describe("ComputeOverdueAccrualService", () => {
  it("用免费期末日和阶梯逐日求和，不写成总天数乘单一费率", async () => {
    const module = await Test.createTestingModule({
      providers: [
        ComputeOverdueAccrualService,
        {
          provide: OVERDUE_STANDARD_REPOSITORY,
          useValue: {
            listByTenant: vi.fn().mockResolvedValue([standard]),
            listRateTiers: vi.fn().mockResolvedValue(tiers),
          },
        },
      ],
    }).compile();
    const service = module.get(ComputeOverdueAccrualService);
    const decision = await service.execute({
      tenantId: "t1",
      purpose: "estimate",
      query: {
        portId: "port-1",
        shippingCompanyId: "line-1",
        freightForwarderId: "ff-1",
        referenceAt: new Date("2026-09-16T08:00:00.000Z"),
      },
      clocks: {
        arrivalAt: new Date("2026-09-16T08:00:00.000Z"),
        dischargeAt: null,
        pickupAt: null,
      },
      asOf: new Date("2026-09-23T16:00:00.000Z"),
    });
    expect(decision.kind).toBe("apply");
    if (decision.kind !== "apply") return;
    expect(decision.purpose).toBe("estimate");
    expect(decision.lines[0]?.amount).toBe("400.00");
    expect(decision.lines[0]?.daily.map((item) => item.rate)).toEqual([
      "100.00",
      "100.00",
      "200.00",
    ]);
  });

  it("命中标准但无阶梯则失败，不准默认日费率", async () => {
    const module = await Test.createTestingModule({
      providers: [
        ComputeOverdueAccrualService,
        {
          provide: OVERDUE_STANDARD_REPOSITORY,
          useValue: {
            listByTenant: vi.fn().mockResolvedValue([standard]),
            listRateTiers: vi.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();
    const service = module.get(ComputeOverdueAccrualService);
    await expect(
      service.execute({
        tenantId: "t1",
        purpose: "accrual",
        query: {
          portId: "port-1",
          shippingCompanyId: "line-1",
          freightForwarderId: "ff-1",
          referenceAt: new Date("2026-09-16T08:00:00.000Z"),
        },
        clocks: {
          arrivalAt: new Date("2026-09-16T08:00:00.000Z"),
          dischargeAt: null,
          pickupAt: null,
        },
        asOf: new Date("2026-09-23T00:00:00.000Z"),
      }),
    ).resolves.toMatchObject({
      kind: "reject",
      code: "BUSINESS_PRECONDITION_FAILED",
    });
  });
});
