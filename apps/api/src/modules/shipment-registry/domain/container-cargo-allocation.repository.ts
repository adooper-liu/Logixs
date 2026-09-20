import type {
  ContainerCargoAllocationResult,
  NormalizedReplaceContainerCargoAllocationsCommand,
} from "./container-cargo-allocation";

export const CONTAINER_CARGO_ALLOCATION_REPOSITORY = Symbol(
  "ContainerCargoAllocationRepository",
);

export interface ContainerCargoAllocationRepository {
  replace(
    command: NormalizedReplaceContainerCargoAllocationsCommand,
  ): Promise<ContainerCargoAllocationResult>;
}
