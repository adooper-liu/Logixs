export const GET_CONTAINER_DISPATCH_READINESS = Symbol.for(
  "logix.GetContainerDispatchReadiness",
);

export interface ContainerDispatchReadinessResult {
  confirmed: boolean;
  reasonCode:
    | "LIFECYCLE_EVENT_PENDING_DISPATCH_SNAPSHOT"
    | "LIFECYCLE_EVENT_PENDING_DISPATCH_SNAPSHOT_STALE"
    | "LIFECYCLE_EVENT_PENDING_DISPATCH_EVIDENCE"
    | null;
  snapshotId: string | null;
}

export interface GetContainerDispatchReadinessPort {
  execute(input: {
    tenantId: string;
    containerRecordId: string;
    evidenceRefs: string[];
  }): Promise<ContainerDispatchReadinessResult>;
}
