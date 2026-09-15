import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import type { OverdueStandard } from "../engines/overdue-deadlines";
import { OVERDUE_STANDARD_REPOSITORY } from "../domain/overdue-standard.repository";
import { ReplaceOverdueStandardsService } from "./replace-overdue-standards.service";

function standard(overrides: Partial<OverdueStandard> = {}): OverdueStandard {
  return {
    id: "s1",
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
    ...overrides,
  };
}

async function buildService(
  repository: Record<string, ReturnType<typeof vi.fn>>,
) {
  const module = await Test.createTestingModule({
    providers: [
      ReplaceOverdueStandardsService,
      { provide: OVERDUE_STANDARD_REPOSITORY, useValue: repository },
    ],
  }).compile();
  return module.get(ReplaceOverdueStandardsService);
}

describe("ReplaceOverdueStandardsService", () => {
  it("未注册费用类型则失败，不写库", async () => {
    const replaceAll = vi.fn();
    const service = await buildService({ replaceAll });
    await expect(
      service.execute({
        tenantId: "t1",
        actorId: "op-1",
        standards: [standard({ chargeType: "wharfage" })],
      }),
    ).rejects.toThrow("BUSINESS_PRECONDITION_FAILED");
    expect(replaceAll).not.toHaveBeenCalled();
  });

  it("未注册日历基准则失败", async () => {
    const replaceAll = vi.fn();
    const service = await buildService({ replaceAll });
    await expect(
      service.execute({
        tenantId: "t1",
        actorId: "op-1",
        standards: [standard({ freeDaysBasis: "business_days" })],
      }),
    ).rejects.toThrow("BUSINESS_PRECONDITION_FAILED");
    expect(replaceAll).not.toHaveBeenCalled();
  });

  it("注册齐全则整表替换", async () => {
    const replaceAll = vi.fn().mockResolvedValue(undefined);
    const service = await buildService({ replaceAll });
    await expect(
      service.execute({
        tenantId: "t1",
        actorId: "op-1",
        standards: [standard()],
      }),
    ).resolves.toEqual({ applied: true, count: 1 });
    expect(replaceAll).toHaveBeenCalledTimes(1);
  });

  it("阶梯金额不是定点两位小数则失败", async () => {
    const replaceAll = vi.fn();
    const service = await buildService({ replaceAll });
    await expect(
      service.execute({
        tenantId: "t1",
        actorId: "op-1",
        standards: [
          {
            ...standard(),
            tiers: [
              { fromDay: 1, toDay: null, amount: "100", currency: "USD" },
            ],
          },
        ],
      }),
    ).rejects.toThrow("BUSINESS_PRECONDITION_FAILED");
    expect(replaceAll).not.toHaveBeenCalled();
  });
});
