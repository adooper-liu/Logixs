import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { OVERDUE_STANDARD_REPOSITORY } from "../domain/overdue-standard.repository";
import { ComputeOverdueDeadlinesService } from "./compute-overdue-deadlines.service";

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

describe("ComputeOverdueDeadlinesService", () => {
  it("按租户读标准后计算截止日，不带金额", async () => {
    const module = await Test.createTestingModule({
      providers: [
        ComputeOverdueDeadlinesService,
        {
          provide: OVERDUE_STANDARD_REPOSITORY,
          useValue: {
            listByTenant: vi.fn().mockResolvedValue([standard]),
          },
        },
      ],
    }).compile();
    const service = module.get(ComputeOverdueDeadlinesService);
    const decision = await service.execute({
      tenantId: "t1",
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
    });
    expect(decision.kind).toBe("apply");
    if (decision.kind !== "apply") return;
    expect(decision.deadlines.latestPickupAt?.toISOString()).toBe(
      "2026-09-20T00:00:00.000Z",
    );
    expect(decision.deadlines.latestReturnAt).toBeNull();
    expect(JSON.stringify(decision)).not.toMatch(/amount|rate|feeAmount/i);
  });

  it("租户下无命中标准则失败，不默认免费天数", async () => {
    const module = await Test.createTestingModule({
      providers: [
        ComputeOverdueDeadlinesService,
        {
          provide: OVERDUE_STANDARD_REPOSITORY,
          useValue: {
            listByTenant: vi.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();
    const service = module.get(ComputeOverdueDeadlinesService);
    await expect(
      service.execute({
        tenantId: "t1",
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
      }),
    ).resolves.toMatchObject({
      kind: "reject",
      code: "BUSINESS_PRECONDITION_FAILED",
    });
  });
});
