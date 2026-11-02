import type {
  StagedOverdueInput,
  StagedOverdueResult,
} from "./engines/overdue-deadlines";

export const COMPUTE_STAGED_OVERDUE_DEADLINES = Symbol.for(
  "logix.ComputeStagedOverdueDeadlines",
);
export type ComputeStagedOverdueInput = Omit<
  StagedOverdueInput,
  "standards" | "query" | "calendarBasis"
> & {
  tenantId: string;
  query: StagedOverdueInput["query"] | null;
  calendarBasis: string | null;
};
export interface ComputeStagedOverdueDeadlinesPort {
  execute(input: ComputeStagedOverdueInput): Promise<StagedOverdueResult>;
}
