export const GET_CONTAINER_STUFFING_READINESS = Symbol.for(
  "logix.GetContainerStuffingReadiness",
);

export interface ContainerStuffingReadinessResult {
  confirmed: boolean;
  reasonCode:
    | "LIFECYCLE_EVENT_PENDING_STUFFING_SNAPSHOT"
    | "LIFECYCLE_EVENT_PENDING_STUFFING_SNAPSHOT_STALE"
    | "LIFECYCLE_EVENT_PENDING_STUFFING_EVIDENCE"
    | null;
  snapshotId: string | null;
}

export interface GetContainerStuffingReadinessPort {
  execute(input: {
    tenantId: string;
    containerRecordId: string;
    evidenceRefs: string[];
  }): Promise<ContainerStuffingReadinessResult>;
}
