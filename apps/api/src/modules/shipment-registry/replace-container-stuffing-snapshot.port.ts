import type {
  ContainerStuffingSnapshotRecord,
  ReplaceContainerStuffingSnapshotCommand,
} from "./domain/container-stuffing-snapshot";

export const REPLACE_CONTAINER_STUFFING_SNAPSHOT = Symbol.for(
  "logix.ReplaceContainerStuffingSnapshot",
);

export interface ReplaceContainerStuffingSnapshotPort {
  execute(
    command: ReplaceContainerStuffingSnapshotCommand,
  ): Promise<ContainerStuffingSnapshotRecord>;
}
