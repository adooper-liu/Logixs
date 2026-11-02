import { describe, expect, it, vi } from "vitest";
import { ComputeStagedOverdueDeadlinesService } from "./compute-staged-overdue-deadlines.service";
import type { ComputeStagedOverdueInput } from "../compute-staged-overdue-deadlines.port";

function input(): ComputeStagedOverdueInput {
  return {
    tenantId: "tenant-a",
    query: {
      portId: "port",
      shippingCompanyId: "line",
      freightForwarderId: "ff",
      referenceAt: new Date("2026-11-01T00:00:00Z"),
    },
    calendarBasis: "UTC/calendar_days",
    facts: {
      estimatedArrival: {
        at: new Date("2026-11-01T00:00:00Z"),
        sourceRef: "eta:1",
        sourceVersion: "1",
      },
      estimatedDischarge: null,
      estimatedPickup: null,
      actualArrival: null,
      actualDischarge: null,
      actualPickup: null,
    },
  };
}
const standard = {
  id: "dem",
  portId: "port",
  shippingCompanyId: "line",
  freightForwarderId: "ff",
  chargeType: "demurrage",
  freeDays: 5,
  freeDaysBasis: "calendar_days",
  calculationBasis: "arrival",
  includeStartDay: true,
  effectiveFrom: new Date("2026-01-01Z"),
  effectiveTo: null,
  transportMode: null,
  terminalId: null,
};

describe("ComputeStagedOverdueDeadlinesService", () => {
  it("computes through the staged core using tenant-scoped standards", async () => {
    const repository = {
      listByTenant: vi.fn(async (tenant: string) =>
        tenant === "tenant-a" ? [standard] : [],
      ),
    };
    const service = new ComputeStagedOverdueDeadlinesService(
      repository as never,
    );
    const result = await service.execute(input());
    expect(result.pickup.date?.toISOString()).toBe("2026-11-05T00:00:00.000Z");
    expect(result.pickup.nature).toBe("estimated");
    expect(
      (await service.execute({ ...input(), tenantId: "other" })).pickup.issues,
    ).toContain("NO_MATCHING_STANDARD");
  });
  it("reports no standards and missing bindings independently without fabricated dates", async () => {
    const service = new ComputeStagedOverdueDeadlinesService({
      listByTenant: async () => [],
    } as never);
    const result = await service.execute({
      ...input(),
      query: null,
      calendarBasis: null,
    });
    expect(result.pickup.date).toBeNull();
    expect(result.pickup.issues).toEqual(
      expect.arrayContaining([
        "NO_MATCHING_STANDARD",
        "MISSING_MATCH_BINDING",
        "MISSING_CALENDAR_BINDING",
      ]),
    );
  });
  it("does not downgrade unsupported local calendars to UTC", async () => {
    const service = new ComputeStagedOverdueDeadlinesService({
      listByTenant: async () => [standard],
    } as never);
    const result = await service.execute({
      ...input(),
      calendarBasis: "America/New_York/calendar_days",
    });
    expect(result.pickup.date).toBeNull();
    expect(result.pickup.issues).toContain("UNSUPPORTED_CALENDAR");
  });
});
