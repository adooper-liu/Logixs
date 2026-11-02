import { applyFreePeriod } from "./apply-free-period";
import {
  matchOverdueStandards,
  type OverdueMatchQuery,
  type OverdueStandard,
} from "./compute-overdue-deadlines";
import {
  CHARGE_DEADLINE_CONSTRAINT,
  isCalculationBasis,
  isOverdueChargeType,
} from "./overdue-charge-types";

export type StagedDateFact = {
  at: Date;
  sourceRef: string;
  sourceVersion: string;
};
export type StagedOverdueInput = {
  standards: OverdueStandard[];
  query: OverdueMatchQuery;
  facts: {
    estimatedArrival: StagedDateFact | null;
    estimatedDischarge: StagedDateFact | null;
    estimatedPickup: StagedDateFact | null;
    actualArrival: StagedDateFact | null;
    actualDischarge: StagedDateFact | null;
    actualPickup: StagedDateFact | null;
  };
  calendarBasis: "UTC/calendar_days";
  previousPickupDeadline?: { date: Date; calculationRef: string } | null;
};
export type StagedOverdueStage =
  "before_arrival" | "after_arrival" | "after_pickup";
export type StagedDeadlineSummary = {
  state: "complete" | "incomplete" | "not_applicable" | "historical";
  date: Date | null;
  nature: "estimated" | "planned" | "historical" | null;
  limitingStandardIds: string[];
  issues: string[];
  calculationRef?: string;
};
export type StagedDeadlineItem = {
  standardId: string;
  constrainsPickup: boolean;
  constrainsReturn: boolean;
  sourceRef: string | null;
  sourceVersion: string | null;
  nature: "estimated" | "planned" | null;
  date: Date | null;
  issues: string[];
};
export type StagedOverdueResult = {
  stage: StagedOverdueStage;
  items: StagedDeadlineItem[];
  pickup: StagedDeadlineSummary;
  return: StagedDeadlineSummary;
};

export function computeStagedOverdueDeadlines(
  input: StagedOverdueInput,
): StagedOverdueResult {
  const stage: StagedOverdueStage = input.facts.actualPickup
    ? "after_pickup"
    : input.facts.actualArrival || input.facts.actualDischarge
      ? "after_arrival"
      : "before_arrival";
  const failed = (issue: string): StagedOverdueResult => ({
    stage,
    items: [],
    pickup:
      stage === "after_pickup" ? historicalPickup(input) : incomplete([issue]),
    return: incomplete([issue]),
  });
  if (input.calendarBasis !== "UTC/calendar_days")
    return failed("UNSUPPORTED_CALENDAR");
  if (
    !input.query.portId.trim() ||
    !input.query.shippingCompanyId.trim() ||
    !input.query.freightForwarderId.trim() ||
    !validDate(input.query.referenceAt)
  ) {
    return failed("INVALID_MATCH_QUERY");
  }
  // Invalid actual facts must not silently fall back to the pre-arrival stage.
  if (
    [
      input.facts.actualArrival,
      input.facts.actualDischarge,
      input.facts.actualPickup,
    ].some((fact) => fact !== null && !validFact(fact))
  )
    return failed("INVALID_START_FACT");
  if (
    input.standards.some(
      (standard) =>
        !validDate(standard.effectiveFrom) ||
        (standard.effectiveTo !== null &&
          (!validDate(standard.effectiveTo) ||
            standard.effectiveTo < standard.effectiveFrom)),
    )
  ) {
    return failed("INVALID_STANDARD_PERIOD");
  }
  const matched = matchOverdueStandards(input.standards, input.query);
  if (!matched.length) return failed("NO_MATCHING_STANDARD");
  const items = matched.map((standard) => computeItem(standard, input, stage));
  const pickup =
    stage === "after_pickup"
      ? historicalPickup(input)
      : summarize(items, "constrainsPickup");
  const returned = summarize(items, "constrainsReturn");
  if (pickup.date && returned.date && returned.date < pickup.date) {
    returned.issues.push("RETURN_BEFORE_PICKUP_DEADLINE");
  }
  return { stage, items, pickup, return: returned };
}

function computeItem(
  standard: OverdueStandard,
  input: StagedOverdueInput,
  stage: StagedOverdueStage,
): StagedDeadlineItem {
  const knownType = isOverdueChargeType(standard.chargeType);
  const constraint = isOverdueChargeType(standard.chargeType)
    ? CHARGE_DEADLINE_CONSTRAINT[standard.chargeType]
    : { constrainsPickup: true, constrainsReturn: true };
  const item: StagedDeadlineItem = {
    standardId: standard.id,
    ...constraint,
    sourceRef: null,
    sourceVersion: null,
    nature: null,
    date: null,
    issues: [],
  };
  if (!knownType) {
    item.issues.push("UNKNOWN_CHARGE_TYPE");
    return item;
  }
  if (!isCalculationBasis(standard.calculationBasis)) {
    item.issues.push("UNKNOWN_CALCULATION_BASIS");
    return item;
  }
  if (standard.freeDaysBasis !== "calendar_days") {
    item.issues.push("UNSUPPORTED_DAY_BASIS");
    return item;
  }
  if (!Number.isSafeInteger(standard.freeDays) || standard.freeDays < 0) {
    item.issues.push("INVALID_FREE_DAYS");
    return item;
  }
  const basis = standard.calculationBasis;
  const actual =
    basis === "pickup" ? stage === "after_pickup" : stage !== "before_arrival";
  const fact =
    basis === "arrival"
      ? actual
        ? input.facts.actualArrival
        : input.facts.estimatedArrival
      : basis === "discharge"
        ? actual
          ? input.facts.actualDischarge
          : input.facts.estimatedDischarge
        : actual
          ? input.facts.actualPickup
          : input.facts.estimatedPickup;
  item.nature = actual ? "planned" : "estimated";
  if (!fact) {
    item.issues.push(
      `MISSING_${actual ? "ACTUAL" : "ESTIMATED"}_${basis.toUpperCase()}`,
    );
    return item;
  }
  if (!validFact(fact)) {
    item.issues.push("INVALID_START_FACT");
    return item;
  }
  item.sourceRef = fact.sourceRef;
  item.sourceVersion = fact.sourceVersion;
  const period = applyFreePeriod({
    startAt: fact.at,
    freeDays: standard.freeDays,
    basis: standard.freeDaysBasis,
    includeStartDay: standard.includeStartDay,
  });
  if (period.kind === "reject" || !validDate(period.lastFreeDay)) {
    item.issues.push("INVALID_FREE_PERIOD");
    return item;
  }
  item.date = period.lastFreeDay;
  return item;
}

function summarize(
  items: StagedDeadlineItem[],
  target: "constrainsPickup" | "constrainsReturn",
): StagedDeadlineSummary {
  const relevant = items.filter((item) => item[target]);
  if (!relevant.length)
    return {
      state: "not_applicable",
      date: null,
      nature: null,
      limitingStandardIds: [],
      issues: [],
    };
  const issues = [...new Set(relevant.flatMap((item) => item.issues))];
  if (issues.length) return incomplete(issues);
  const earliest = relevant.reduce<Date | null>(
    (date, item) =>
      !date || (item.date && item.date < date) ? item.date : date,
    null,
  );
  return {
    state: "complete",
    date: earliest ? new Date(earliest) : null,
    nature: relevant.some((item) => item.nature === "estimated")
      ? "estimated"
      : "planned",
    limitingStandardIds: relevant
      .filter((item) => item.date?.getTime() === earliest?.getTime())
      .map((item) => item.standardId),
    issues: [],
  };
}

function historicalPickup(input: StagedOverdueInput): StagedDeadlineSummary {
  const previous = input.previousPickupDeadline;
  if (!previous) return incomplete(["MISSING_PICKUP_HISTORY"]);
  if (!validDate(previous.date) || !previous.calculationRef.trim())
    return incomplete(["INVALID_PICKUP_HISTORY"]);
  return {
    state: "historical",
    date: new Date(previous.date),
    nature: "historical",
    limitingStandardIds: [],
    issues: [],
    calculationRef: previous.calculationRef,
  };
}

function incomplete(issues: string[]): StagedDeadlineSummary {
  return {
    state: "incomplete",
    date: null,
    nature: null,
    limitingStandardIds: [],
    issues: [...issues],
  };
}
function validDate(date: Date): boolean {
  return date instanceof Date && Number.isFinite(date.getTime());
}
function validFact(fact: StagedDateFact): boolean {
  return (
    validDate(fact.at) &&
    Boolean(fact.sourceRef.trim() && fact.sourceVersion.trim())
  );
}
