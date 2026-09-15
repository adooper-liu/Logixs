import type {
  AccrualDecision,
  AccrualPurpose,
} from "./engines/overdue-accrual";
import type {
  ClockFacts,
  OverdueMatchQuery,
} from "./engines/overdue-deadlines";

export const COMPUTE_OVERDUE_ACCRUAL = Symbol.for(
  "logix.ComputeOverdueAccrual",
);

export type ComputeOverdueAccrualInput = {
  tenantId: string;
  purpose: AccrualPurpose | string;
  query: OverdueMatchQuery;
  clocks: ClockFacts;
  asOf: Date;
};

export type ComputeOverdueAccrualPort = {
  execute(input: ComputeOverdueAccrualInput): Promise<AccrualDecision>;
};
