import type {
  AppendLifecycleDateFactInput,
  AppendLifecycleDateFactResult,
  LifecycleDateApplicationState,
  LifecycleDateFactRecord,
} from "./lifecycle-date-fact";

export const LIFECYCLE_DATE_FACT_REPOSITORY = Symbol(
  "LifecycleDateFactRepository",
);

export interface LifecycleDateFactRepository {
  findById(factId: string): Promise<LifecycleDateFactRecord | null>;
  append(
    input: AppendLifecycleDateFactInput,
  ): Promise<AppendLifecycleDateFactResult>;
  updateApplication(input: {
    factId: string;
    state: LifecycleDateApplicationState;
    reasonCode: string | null;
    canonicalEventId: string | null;
  }): Promise<LifecycleDateFactRecord>;
  listCurrent(input: {
    tenantId: string;
    containerId: string;
  }): Promise<LifecycleDateFactRecord[]>;
  claimPendingApplications(input: {
    tenantId: string;
    containerId: string;
    owner: string;
    now: Date;
    leaseUntil: Date;
    limit: number;
  }): Promise<LifecycleDateFactRecord[]>;
  finishClaimedApplication(input: {
    factId: string;
    owner: string;
    state: Extract<
      LifecycleDateApplicationState,
      "pending_application" | "applied" | "rejected"
    >;
    reasonCode: string | null;
    canonicalEventId: string | null;
  }): Promise<LifecycleDateFactRecord>;
}
