export const OVERDUE_CHARGE_TYPES = [
  "demurrage",
  "storage",
  "detention",
  "dnd",
] as const;

export type OverdueChargeType = (typeof OVERDUE_CHARGE_TYPES)[number];

export const CHARGE_DEADLINE_CONSTRAINT: Record<
  OverdueChargeType,
  { constrainsPickup: boolean; constrainsReturn: boolean }
> = {
  demurrage: { constrainsPickup: true, constrainsReturn: false },
  storage: { constrainsPickup: true, constrainsReturn: false },
  detention: { constrainsPickup: false, constrainsReturn: true },
  dnd: { constrainsPickup: true, constrainsReturn: true },
};

export const REGISTERED_CALCULATION_BASES = [
  "arrival",
  "discharge",
  "pickup",
] as const;

export type CalculationBasis = (typeof REGISTERED_CALCULATION_BASES)[number];

export const REGISTERED_FREE_DAY_BASES = ["calendar_days"] as const;

export type FreeDaysBasis = (typeof REGISTERED_FREE_DAY_BASES)[number];

export function isOverdueChargeType(value: string): value is OverdueChargeType {
  return (OVERDUE_CHARGE_TYPES as readonly string[]).includes(value);
}

export function isCalculationBasis(value: string): value is CalculationBasis {
  return (REGISTERED_CALCULATION_BASES as readonly string[]).includes(value);
}

export function isFreeDaysBasis(value: string): value is FreeDaysBasis {
  return (REGISTERED_FREE_DAY_BASES as readonly string[]).includes(value);
}
