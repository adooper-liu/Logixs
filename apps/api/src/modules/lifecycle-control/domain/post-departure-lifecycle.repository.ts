import type { StartPostDepartureLifecycleCommandV2 } from "@logix/contracts";

export const POST_DEPARTURE_LIFECYCLE_REPOSITORY = Symbol(
  "PostDepartureLifecycleRepository",
);

export interface InitializePostDepartureLifecycleInput {
  tenantId: string;
  command: StartPostDepartureLifecycleCommandV2;
  completeInbox: {
    id: string;
    owner: string;
    processedAt: Date;
  };
}

export interface InitializePostDepartureLifecycleResult {
  shipmentId: string;
  canonicalEventId: string;
  relationshipVersion: number;
  lifecycleVersion: number;
  containerCount: number;
  initialized: boolean;
}

export interface PostDepartureLifecycleRepository {
  initialize(
    input: InitializePostDepartureLifecycleInput,
  ): Promise<InitializePostDepartureLifecycleResult>;
}
