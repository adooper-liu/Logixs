import type {
  ContainerDispatchSnapshotRecord,
  NormalizedContainerDispatchSnapshotCommand,
} from "./container-dispatch-snapshot";

export const CONTAINER_DISPATCH_SNAPSHOT_REPOSITORY = Symbol(
  "CONTAINER_DISPATCH_SNAPSHOT_REPOSITORY",
);

export interface ContainerDispatchSnapshotRepository {
  findCurrent(input: {
    tenantId: string;
    containerRecordId: string;
  }): Promise<ContainerDispatchSnapshotRecord | null>;
  replace(
    command: NormalizedContainerDispatchSnapshotCommand,
  ): Promise<ContainerDispatchSnapshotRecord>;
}
