import type { EvaluateLifecycleDateAuthorityService } from "./application/evaluate-lifecycle-date-authority.service";

export const EVALUATE_LIFECYCLE_DATE_AUTHORITY = Symbol.for(
  "logix.EvaluateLifecycleDateAuthority",
);

export type EvaluateLifecycleDateAuthorityPort = Pick<
  EvaluateLifecycleDateAuthorityService,
  "execute"
>;
