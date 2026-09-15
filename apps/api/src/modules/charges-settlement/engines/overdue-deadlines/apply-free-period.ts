import type { FreeDaysBasis } from "./overdue-charge-types";

const UTC_DAY_MS = 86_400_000;

export function utcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function addCalendarDays(date: Date, days: number): Date {
  return new Date(utcDay(date).getTime() + days * UTC_DAY_MS);
}

export type ApplyFreePeriodReject = {
  kind: "reject";
  code: "BUSINESS_PRECONDITION_FAILED";
  message: string;
};

export function applyFreePeriod(input: {
  startAt: Date;
  freeDays: number;
  basis: string;
  includeStartDay: boolean;
}): { kind: "apply"; lastFreeDay: Date } | ApplyFreePeriodReject {
  if (!Number.isInteger(input.freeDays) || input.freeDays < 0) {
    return {
      kind: "reject",
      code: "BUSINESS_PRECONDITION_FAILED",
      message: "免费天数必须是大于等于 0 的整数",
    };
  }
  if (input.basis !== "calendar_days") {
    return {
      kind: "reject",
      code: "BUSINESS_PRECONDITION_FAILED",
      message: `免费期日历基准 ${input.basis} 未注册`,
    };
  }
  void (input.basis as FreeDaysBasis);
  const offset = input.includeStartDay ? input.freeDays - 1 : input.freeDays;
  return {
    kind: "apply",
    lastFreeDay: addCalendarDays(input.startAt, offset),
  };
}
