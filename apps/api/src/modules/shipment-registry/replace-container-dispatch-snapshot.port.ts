import type {
  ContainerDispatchSnapshotRecord,
  ReplaceContainerDispatchSnapshotCommand,
} from "./domain/container-dispatch-snapshot";

export const REPLACE_CONTAINER_DISPATCH_SNAPSHOT = Symbol.for(
  "logix.ReplaceContainerDispatchSnapshot",
);

export interface ReplaceContainerDispatchSnapshotPort {
  execute(
    command: ReplaceContainerDispatchSnapshotCommand,
  ): Promise<ContainerDispatchSnapshotRecord>;
}
