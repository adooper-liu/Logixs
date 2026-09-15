import { formatMinorUnits, isIsoCurrency, parseMinorUnits } from "./money";

const UTC_DAY_MS = 86_400_000;
const REGISTERED_PURPOSES = ["estimate", "accrual"] as const;

export type AccrualPurpose = (typeof REGISTERED_PURPOSES)[number];

export type RateTier = {
  fromDay: number;
  toDay: number | null;
  amount: string;
  currency: string;
};

export type AccrualLineInput = {
  standardId: string;
  chargeType: string;
  lastFreeDay: Date;
  asOf: Date;
  tiers: RateTier[];
};

export type AccrualDay = {
  date: Date;
  dayNumber: number;
  rate: string;
  amount: string;
};

export type AccrualLine = {
  standardId: string;
  chargeType: string;
  lastFreeDay: Date;
  firstChargeDay: Date | null;
  lastChargeDay: Date | null;
  chargeDays: number;
  currency: string;
  amount: string;
  daily: AccrualDay[];
};

export type AccrualTotal = {
  currency: string;
  amount: string;
};

export type AccrualDecision =
  | {
      kind: "apply";
      purpose: AccrualPurpose;
      lines: AccrualLine[];
      totals: AccrualTotal[];
    }
  | {
      kind: "reject";
      code: "BUSINESS_PRECONDITION_FAILED" | "VALIDATION_REQUIRED";
      message: string;
    };

export function utcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function addCalendarDays(date: Date, days: number): Date {
  return new Date(utcDay(date).getTime() + days * UTC_DAY_MS);
}

export function isAccrualPurpose(value: string): value is AccrualPurpose {
  return (REGISTERED_PURPOSES as readonly string[]).includes(value);
}

export function validateRateTiers(
  tiers: RateTier[],
):
  | { kind: "ok"; currency: string }
  | Extract<AccrualDecision, { kind: "reject" }> {
  if (tiers.length === 0) {
    return {
      kind: "reject",
      code: "BUSINESS_PRECONDITION_FAILED",
      message: "缺少费率阶梯",
    };
  }
  const currency = tiers[0]?.currency ?? "";
  if (!isIsoCurrency(currency)) {
    return {
      kind: "reject",
      code: "BUSINESS_PRECONDITION_FAILED",
      message: "币种必须是三位 ISO 4217 代码",
    };
  }
  for (const [index, tier] of tiers.entries()) {
    if (!Number.isInteger(tier.fromDay) || tier.fromDay < 1) {
      return {
        kind: "reject",
        code: "BUSINESS_PRECONDITION_FAILED",
        message: "阶梯起始日必须是从 1 起的整数",
      };
    }
    if (
      tier.toDay !== null &&
      (!Number.isInteger(tier.toDay) || tier.toDay < tier.fromDay)
    ) {
      return {
        kind: "reject",
        code: "BUSINESS_PRECONDITION_FAILED",
        message: "阶梯结束日必须为空或大于等于起始日",
      };
    }
    if (tier.currency !== currency) {
      return {
        kind: "reject",
        code: "BUSINESS_PRECONDITION_FAILED",
        message: "同一标准的阶梯币种必须相同",
      };
    }
    const parsed = parseMinorUnits(tier.amount);
    if (parsed.kind === "reject") return parsed;
    for (const other of tiers.slice(index + 1)) {
      if (tiersOverlap(tier, other)) {
        return {
          kind: "reject",
          code: "BUSINESS_PRECONDITION_FAILED",
          message: "费率阶梯区间不能重叠",
        };
      }
    }
  }
  return { kind: "ok", currency };
}

export function computeOverdueAccrual(input: {
  purpose: string;
  lines: AccrualLineInput[];
}): AccrualDecision {
  if (!isAccrualPurpose(input.purpose)) {
    return {
      kind: "reject",
      code: "BUSINESS_PRECONDITION_FAILED",
      message: `计费目的 ${input.purpose} 未注册`,
    };
  }
  if (input.lines.length === 0) {
    return {
      kind: "reject",
      code: "VALIDATION_REQUIRED",
      message: "没有可计费的费用标准",
    };
  }

  const lines: AccrualLine[] = [];
  for (const line of input.lines) {
    const accrued = accrueLine(line);
    if (accrued.kind === "reject") return accrued;
    lines.push(accrued.line);
  }

  return {
    kind: "apply",
    purpose: input.purpose,
    lines,
    totals: sumByCurrency(lines),
  };
}

function accrueLine(
  line: AccrualLineInput,
):
  | { kind: "apply"; line: AccrualLine }
  | Extract<AccrualDecision, { kind: "reject" }> {
  if (!line.standardId.trim() || !line.chargeType.trim()) {
    return {
      kind: "reject",
      code: "VALIDATION_REQUIRED",
      message: "缺少标准或费用类型",
    };
  }
  const tiers = validateRateTiers(line.tiers);
  if (tiers.kind !== "ok") return tiers;

  const lastFreeDay = utcDay(line.lastFreeDay);
  const asOfDay = utcDay(line.asOf);
  const daily: AccrualDay[] = [];
  let totalCents = 0n;
  let dayNumber = 1;
  let chargeDay = addCalendarDays(lastFreeDay, 1);

  while (chargeDay.getTime() <= asOfDay.getTime()) {
    const tier = findTier(line.tiers, dayNumber);
    if (!tier) {
      return {
        kind: "reject",
        code: "BUSINESS_PRECONDITION_FAILED",
        message: `计费第 ${dayNumber} 日没有费率阶梯`,
      };
    }
    const parsed = parseMinorUnits(tier.amount);
    if (parsed.kind === "reject") return parsed;
    daily.push({
      date: chargeDay,
      dayNumber,
      rate: tier.amount,
      amount: tier.amount,
    });
    totalCents += parsed.cents;
    dayNumber += 1;
    chargeDay = addCalendarDays(chargeDay, 1);
  }

  return {
    kind: "apply",
    line: {
      standardId: line.standardId,
      chargeType: line.chargeType,
      lastFreeDay,
      firstChargeDay: daily[0]?.date ?? null,
      lastChargeDay: daily.at(-1)?.date ?? null,
      chargeDays: daily.length,
      currency: tiers.currency,
      amount: formatMinorUnits(totalCents),
      daily,
    },
  };
}

function findTier(tiers: RateTier[], dayNumber: number): RateTier | null {
  const hits = tiers.filter((tier) => {
    if (dayNumber < tier.fromDay) return false;
    if (tier.toDay === null) return true;
    return dayNumber <= tier.toDay;
  });
  return hits.length === 1 ? hits[0]! : null;
}

function tiersOverlap(left: RateTier, right: RateTier): boolean {
  const leftEnd = left.toDay ?? Number.POSITIVE_INFINITY;
  const rightEnd = right.toDay ?? Number.POSITIVE_INFINITY;
  return left.fromDay <= rightEnd && right.fromDay <= leftEnd;
}

function sumByCurrency(lines: AccrualLine[]): AccrualTotal[] {
  const totals = new Map<string, bigint>();
  for (const line of lines) {
    const parsed = parseMinorUnits(line.amount);
    if (parsed.kind === "reject") continue;
    totals.set(line.currency, (totals.get(line.currency) ?? 0n) + parsed.cents);
  }
  return [...totals.entries()].map(([currency, cents]) => ({
    currency,
    amount: formatMinorUnits(cents),
  }));
}
