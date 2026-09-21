import type {
  ContainerStuffingSnapshotRecord,
  NormalizedContainerStuffingSnapshotCommand,
} from "./container-stuffing-snapshot";

export const CONTAINER_STUFFING_SNAPSHOT_REPOSITORY = Symbol(
  "ContainerStuffingSnapshotRepository",
);

export interface ContainerStuffingSnapshotRepository {
  findCurrent(input: {
    tenantId: string;
    containerRecordId: string;
  }): Promise<ContainerStuffingSnapshotRecord | null>;
  replace(
    command: NormalizedContainerStuffingSnapshotCommand,
  ): Promise<ContainerStuffingSnapshotRecord>;
}
