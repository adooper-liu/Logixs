import type { RecordLifecycleDateFactService } from "./application/record-lifecycle-date-fact.service";

export const RECORD_LIFECYCLE_DATE_FACT = Symbol.for(
  "logix.RecordLifecycleDateFact",
);

export type RecordLifecycleDateFactPort = Pick<
  RecordLifecycleDateFactService,
  "execute"
>;
