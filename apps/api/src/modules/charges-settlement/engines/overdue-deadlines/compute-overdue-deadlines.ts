import { applyFreePeriod, utcDay } from "./apply-free-period";
import {
  CHARGE_DEADLINE_CONSTRAINT,
  isCalculationBasis,
  isOverdueChargeType,
  type CalculationBasis,
  type OverdueChargeType,
} from "./overdue-charge-types";

export type OverdueStandard = {
  id: string;
  portId: string;
  shippingCompanyId: string;
  freightForwarderId: string;
  chargeType: string;
  freeDays: number;
  freeDaysBasis: string;
  calculationBasis: string;
  includeStartDay: boolean;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  transportMode: string | null;
  terminalId: string | null;
};

export type OverdueMatchQuery = {
  portId: string;
  shippingCompanyId: string;
  freightForwarderId: string;
  transportMode?: string | null;
  terminalId?: string | null;
  referenceAt: Date;
};

export type ClockFacts = {
  arrivalAt: Date | null;
  dischargeAt: Date | null;
  pickupAt: Date | null;
};

export type OverdueDeadlines = {
  latestPickupAt: Date | null;
  latestReturnAt: Date | null;
  matchedStandardIds: string[];
  returnClampedToPickup: boolean;
};

export type OverdueDecision =
  | { kind: "apply"; deadlines: OverdueDeadlines }
  | {
      kind: "reject";
      code: "BUSINESS_PRECONDITION_FAILED" | "VALIDATION_REQUIRED";
      message: string;
    };

export function matchOverdueStandards(
  standards: OverdueStandard[],
  query: OverdueMatchQuery,
): OverdueStandard[] {
  const reference = query.referenceAt.getTime();
  return standards.filter((item) => {
    if (item.portId !== query.portId) return false;
    if (item.shippingCompanyId !== query.shippingCompanyId) return false;
    if (item.freightForwarderId !== query.freightForwarderId) return false;
    if (item.transportMode && item.transportMode !== query.transportMode) {
      return false;
    }
    if (item.terminalId && item.terminalId !== query.terminalId) return false;
    if (item.effectiveFrom.getTime() > reference) return false;
    if (item.effectiveTo && item.effectiveTo.getTime() < reference) {
      return false;
    }
    return true;
  });
}

export function computeOverdueDeadlines(input: {
  standards: OverdueStandard[];
  query: OverdueMatchQuery;
  clocks: ClockFacts;
}): OverdueDecision {
  if (
    !input.query.portId.trim() ||
    !input.query.shippingCompanyId.trim() ||
    !input.query.freightForwarderId.trim()
  ) {
    return {
      kind: "reject",
      code: "VALIDATION_REQUIRED",
      message: "缺少港口、船司或货代公司",
    };
  }

  const matched = matchOverdueStandards(input.standards, input.query);
  if (matched.length === 0) {
    return {
      kind: "reject",
      code: "BUSINESS_PRECONDITION_FAILED",
      message: "没有匹配的超期费用标准",
    };
  }

  const pickupCandidates: Date[] = [];
  for (const standard of matched) {
    const typed = readType(standard);
    if (typed.kind === "reject") return typed;
    if (!typed.constraint.constrainsPickup) continue;
    const start = resolveOverdueStart(standard, input.clocks, null);
    if (start.kind === "reject") return start;
    const lastFree = applyFreePeriod({
      startAt: start.at,
      freeDays: standard.freeDays,
      basis: standard.freeDaysBasis,
      includeStartDay: standard.includeStartDay,
    });
    if (lastFree.kind === "reject") return lastFree;
    pickupCandidates.push(lastFree.lastFreeDay);
  }

  const latestPickupAt =
    pickupCandidates.length > 0 ? minDate(pickupCandidates) : null;

  const returnCandidates: Date[] = [];
  for (const standard of matched) {
    const typed = readType(standard);
    if (typed.kind === "reject") return typed;
    if (!typed.constraint.constrainsReturn) continue;
    const start = resolveOverdueStart(standard, input.clocks, latestPickupAt);
    if (start.kind === "reject") return start;
    const lastFree = applyFreePeriod({
      startAt: start.at,
      freeDays: standard.freeDays,
      basis: standard.freeDaysBasis,
      includeStartDay: standard.includeStartDay,
    });
    if (lastFree.kind === "reject") return lastFree;
    returnCandidates.push(lastFree.lastFreeDay);
  }

  let latestReturnAt =
    returnCandidates.length > 0 ? minDate(returnCandidates) : null;
  let returnClampedToPickup = false;
  if (
    latestPickupAt &&
    latestReturnAt &&
    utcDay(latestReturnAt).getTime() < utcDay(latestPickupAt).getTime()
  ) {
    latestReturnAt = latestPickupAt;
    returnClampedToPickup = true;
  }

  return {
    kind: "apply",
    deadlines: {
      latestPickupAt,
      latestReturnAt,
      matchedStandardIds: matched.map((item) => item.id),
      returnClampedToPickup,
    },
  };
}

function readType(standard: OverdueStandard):
  | {
      kind: "ok";
      type: OverdueChargeType;
      constraint: (typeof CHARGE_DEADLINE_CONSTRAINT)[OverdueChargeType];
    }
  | Extract<OverdueDecision, { kind: "reject" }> {
  if (!isOverdueChargeType(standard.chargeType)) {
    return {
      kind: "reject",
      code: "BUSINESS_PRECONDITION_FAILED",
      message: `费用类型 ${standard.chargeType} 未注册`,
    };
  }
  return {
    kind: "ok",
    type: standard.chargeType,
    constraint: CHARGE_DEADLINE_CONSTRAINT[standard.chargeType],
  };
}

export function resolveOverdueStart(
  standard: OverdueStandard,
  clocks: ClockFacts,
  pickupFallback: Date | null,
): { kind: "ok"; at: Date } | Extract<OverdueDecision, { kind: "reject" }> {
  if (!isCalculationBasis(standard.calculationBasis)) {
    return {
      kind: "reject",
      code: "BUSINESS_PRECONDITION_FAILED",
      message: `起算基准 ${standard.calculationBasis} 未注册`,
    };
  }
  const basis: CalculationBasis = standard.calculationBasis;
  const at =
    basis === "arrival"
      ? clocks.arrivalAt
      : basis === "discharge"
        ? clocks.dischargeAt
        : (clocks.pickupAt ?? pickupFallback);
  if (!at) {
    return {
      kind: "reject",
      code: "BUSINESS_PRECONDITION_FAILED",
      message: `标准 ${standard.id} 缺少起算时刻 ${basis}`,
    };
  }
  return { kind: "ok", at };
}

function minDate(dates: Date[]): Date {
  return dates.reduce((earliest, item) =>
    item.getTime() < earliest.getTime() ? item : earliest,
  );
}
