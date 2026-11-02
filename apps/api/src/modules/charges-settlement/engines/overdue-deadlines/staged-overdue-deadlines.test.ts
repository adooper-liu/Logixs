import { describe, expect, it } from "vitest";
import type { OverdueStandard } from "./compute-overdue-deadlines";
import {
  computeStagedOverdueDeadlines,
  type StagedOverdueInput,
} from "./staged-overdue-deadlines";

function fact(day: string) {
  return {
    at: new Date(`${day}T00:00:00Z`),
    sourceRef: `fact:${day}`,
    sourceVersion: "1",
  };
}

function standard(overrides: Partial<OverdueStandard> = {}): OverdueStandard {
  return {
    id: "dem",
    portId: "port",
    shippingCompanyId: "carrier",
    freightForwarderId: "forwarder",
    chargeType: "demurrage",
    freeDays: 5,
    freeDaysBasis: "calendar_days",
    calculationBasis: "arrival",
    includeStartDay: true,
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    effectiveTo: null,
    transportMode: null,
    terminalId: null,
    ...overrides,
  };
}

function input(): StagedOverdueInput {
  return {
    standards: [standard()],
    calendarBasis: "UTC/calendar_days",
    query: {
      portId: "port",
      shippingCompanyId: "carrier",
      freightForwarderId: "forwarder",
      referenceAt: new Date("2026-11-01T00:00:00Z"),
    },
    facts: {
      estimatedArrival: fact("2026-11-01"),
      estimatedDischarge: null,
      estimatedPickup: null,
      actualArrival: null,
      actualDischarge: null,
      actualPickup: null,
    },
    previousPickupDeadline: null,
  };
}

const iso = (date: Date | null) => date?.toISOString() ?? null;

describe("computeStagedOverdueDeadlines", () => {
  it("recalculates estimated pickup from the supplied ETA version without changing input", () => {
    const command = input();
    const snapshot = structuredClone(command);
    const first = computeStagedOverdueDeadlines(command);
    expect(first.stage).toBe("before_arrival");
    expect(first.pickup).toMatchObject({
      state: "complete",
      nature: "estimated",
      limitingStandardIds: ["dem"],
    });
    expect(iso(first.pickup.date)).toBe("2026-11-05T00:00:00.000Z");
    expect(first.items[0]).toMatchObject({
      sourceRef: "fact:2026-11-01",
      sourceVersion: "1",
      nature: "estimated",
    });
    command.facts.estimatedArrival = {
      ...fact("2026-11-02"),
      sourceVersion: "2",
    };
    expect(iso(computeStagedOverdueDeadlines(command).pickup.date)).toBe(
      "2026-11-06T00:00:00.000Z",
    );
    command.facts.estimatedArrival = snapshot.facts.estimatedArrival;
    expect(command).toEqual(snapshot);
    expect(first.return.state).toBe("not_applicable");
  });

  it("uses ATA after arrival and does not substitute it for missing actual discharge", () => {
    const command = input();
    command.facts.actualArrival = fact("2026-11-03");
    command.standards.push(
      standard({
        id: "storage",
        chargeType: "storage",
        calculationBasis: "discharge",
        freeDays: 3,
      }),
    );
    command.standards.push(
      standard({ id: "dnd", chargeType: "dnd", freeDays: 10 }),
    );
    command.facts.estimatedDischarge = fact("2026-11-04");
    const result = computeStagedOverdueDeadlines(command);
    expect(result.stage).toBe("after_arrival");
    expect(result.pickup).toMatchObject({ state: "incomplete", date: null });
    expect(result.pickup.issues).toContain("MISSING_ACTUAL_DISCHARGE");
    expect(
      iso(result.items.find((item) => item.standardId === "dem")!.date),
    ).toBe("2026-11-07T00:00:00.000Z");
    expect(result.return).toMatchObject({
      state: "complete",
      nature: "planned",
    });
    expect(iso(result.return.date)).toBe("2026-11-12T00:00:00.000Z");
  });

  it("requires explicit estimated pickup rather than silently using ETA or latest pickup", () => {
    const command = input();
    command.standards.push(
      standard({
        id: "det",
        chargeType: "detention",
        calculationBasis: "pickup",
        freeDays: 4,
      }),
    );
    const missing = computeStagedOverdueDeadlines(command);
    expect(missing.pickup.state).toBe("complete");
    expect(missing.return).toMatchObject({ state: "incomplete", date: null });
    expect(missing.return.issues).toContain("MISSING_ESTIMATED_PICKUP");
    command.facts.estimatedPickup = fact("2026-11-04");
    const supplied = computeStagedOverdueDeadlines(command);
    expect(supplied.return.nature).toBe("estimated");
    expect(iso(supplied.return.date)).toBe("2026-11-07T00:00:00.000Z");
  });

  it("preserves historical pickup and recalculates detention from actual pickup, not later ETA", () => {
    const command = input();
    command.facts.actualArrival = fact("2026-11-02");
    command.facts.actualPickup = fact("2026-11-06");
    command.previousPickupDeadline = {
      date: new Date("2026-11-05T00:00:00Z"),
      calculationRef: "calculation:old",
    };
    command.standards.push(
      standard({
        id: "det",
        chargeType: "detention",
        calculationBasis: "pickup",
        freeDays: 4,
      }),
    );
    command.standards.push(
      standard({ id: "dnd", chargeType: "dnd", freeDays: 12 }),
    );
    const result = computeStagedOverdueDeadlines(command);
    expect(result.stage).toBe("after_pickup");
    expect(result.pickup).toMatchObject({
      state: "historical",
      nature: "historical",
      calculationRef: "calculation:old",
    });
    expect(iso(result.pickup.date)).toBe("2026-11-05T00:00:00.000Z");
    expect(iso(result.return.date)).toBe("2026-11-09T00:00:00.000Z");
    expect(result.return.nature).toBe("planned");
    expect(
      iso(result.items.find((item) => item.standardId === "dnd")!.date),
    ).toBe("2026-11-13T00:00:00.000Z");
    command.facts.estimatedArrival = fact("2026-11-20");
    expect(iso(computeStagedOverdueDeadlines(command).return.date)).toBe(
      "2026-11-09T00:00:00.000Z",
    );
    command.previousPickupDeadline = null;
    const absent = computeStagedOverdueDeadlines(command);
    expect(absent.pickup.date).toBeNull();
    expect(absent.pickup.issues).toContain("MISSING_PICKUP_HISTORY");
  });

  it("retains all equally restrictive standards and reports a contradictory return date without clamping", () => {
    const command = input();
    command.standards.push(standard({ id: "storage", chargeType: "storage" }));
    command.standards.push(
      standard({
        id: "det",
        chargeType: "detention",
        calculationBasis: "pickup",
        freeDays: 1,
      }),
    );
    command.facts.estimatedPickup = fact("2026-11-02");
    const result = computeStagedOverdueDeadlines(command);
    expect(result.pickup.limitingStandardIds).toEqual(["dem", "storage"]);
    expect(iso(result.return.date)).toBe("2026-11-02T00:00:00.000Z");
    expect(result.return.issues).toContain("RETURN_BEFORE_PICKUP_DEADLINE");
  });

  it("returns missing standards rather than defaulting free days", () => {
    const command = input();
    command.standards = [];
    const result = computeStagedOverdueDeadlines(command);
    for (const deadline of [result.pickup, result.return]) {
      expect(deadline).toMatchObject({ state: "incomplete", date: null });
      expect(deadline.issues).toContain("NO_MATCHING_STANDARD");
    }
  });

  it.each([
    ["workday", { freeDaysBasis: "business_days" }, "UNSUPPORTED_DAY_BASIS"],
    ["negative days", { freeDays: -1 }, "INVALID_FREE_DAYS"],
    ["fractional days", { freeDays: 1.5 }, "INVALID_FREE_DAYS"],
    ["unknown type", { chargeType: "other" }, "UNKNOWN_CHARGE_TYPE"],
    [
      "unknown start",
      { calculationBasis: "other" },
      "UNKNOWN_CALCULATION_BASIS",
    ],
  ] as const)(
    "does not produce a deadline for %s",
    (_label, override, issue) => {
      const command = input();
      command.standards = [standard(override)];
      const result = computeStagedOverdueDeadlines(command);
      expect(result.pickup.date).toBeNull();
      expect(result.pickup.issues).toContain(issue);
    },
  );

  it.each(["INVALID_MATCH_QUERY", "UNSUPPORTED_CALENDAR"])(
    "retains independent pickup history when recomputation fails with %s",
    (issue) => {
      const command = input();
      command.facts.actualPickup = fact("2026-11-06");
      command.previousPickupDeadline = {
        date: new Date("2026-11-05T00:00:00Z"),
        calculationRef: "calculation:old",
      };
      if (issue === "INVALID_MATCH_QUERY")
        command.query.freightForwarderId = "";
      else
        command.calendarBasis =
          "unsupported" as StagedOverdueInput["calendarBasis"];
      const result = computeStagedOverdueDeadlines(command);
      expect(result.pickup).toMatchObject({
        state: "historical",
        calculationRef: "calculation:old",
      });
      expect(iso(result.pickup.date)).toBe("2026-11-05T00:00:00.000Z");
      expect(result.return.date).toBeNull();
      expect(result.return.issues).toContain(issue);
    },
  );

  it("rejects unsupported calendar declarations rather than silently using UTC", () => {
    const command = input();
    command.calendarBasis =
      "America/New_York/calendar_days" as StagedOverdueInput["calendarBasis"];
    const result = computeStagedOverdueDeadlines(command);
    expect(result.pickup.issues).toContain("UNSUPPORTED_CALENDAR");
    expect(result.pickup.date).toBeNull();
  });

  it("rejects invalid selected dates and missing matching identity", () => {
    const command = input();
    command.facts.estimatedArrival = {
      ...fact("2026-11-01"),
      at: new Date("invalid"),
    };
    expect(computeStagedOverdueDeadlines(command).pickup.issues).toContain(
      "INVALID_START_FACT",
    );
    command.query.portId = "";
    expect(computeStagedOverdueDeadlines(command).pickup.issues).toContain(
      "INVALID_MATCH_QUERY",
    );
  });

  it("does not treat a past ETA as actual arrival or mutate frozen inputs", () => {
    const command = input();
    command.facts.estimatedArrival = fact("2020-01-01");
    Object.freeze(command.facts);
    Object.freeze(command.standards[0]);
    Object.freeze(command.standards);
    Object.freeze(command);
    const result = computeStagedOverdueDeadlines(command);
    expect(result.stage).toBe("before_arrival");
    expect(iso(result.pickup.date)).toBe("2020-01-05T00:00:00.000Z");
  });
});
