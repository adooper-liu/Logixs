import type {
  ClockFacts,
  OverdueDecision,
  OverdueMatchQuery,
} from "./engines/overdue-deadlines";

export const COMPUTE_OVERDUE_DEADLINES = Symbol.for(
  "logix.ComputeOverdueDeadlines",
);

export type ComputeOverdueDeadlinesInput = {
  tenantId: string;
  query: OverdueMatchQuery;
  clocks: ClockFacts;
};

export type ComputeOverdueDeadlinesPort = {
  execute(input: ComputeOverdueDeadlinesInput): Promise<OverdueDecision>;
};
