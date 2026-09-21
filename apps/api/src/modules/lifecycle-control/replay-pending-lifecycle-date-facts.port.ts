export const REPLAY_PENDING_LIFECYCLE_DATE_FACTS = Symbol(
  "ReplayPendingLifecycleDateFacts",
);

export interface ReplayPendingLifecycleDateFactsInput {
  tenantId: string;
  containerId: string;
  limit?: number;
}

export interface ReplayPendingLifecycleDateFactsResult {
  claimed: number;
  applied: number;
  pending: number;
  rejected: number;
}

export interface ReplayPendingLifecycleDateFactsPort {
  execute(
    input: ReplayPendingLifecycleDateFactsInput,
  ): Promise<ReplayPendingLifecycleDateFactsResult>;
}
