import type {
  ContainerCargoAllocationResult,
  ReplaceContainerCargoAllocationsCommand,
} from "./domain/container-cargo-allocation";

export const REPLACE_CONTAINER_CARGO_ALLOCATIONS = Symbol(
  "ReplaceContainerCargoAllocations",
);

export interface ReplaceContainerCargoAllocationsPort {
  execute(
    command: ReplaceContainerCargoAllocationsCommand,
  ): Promise<ContainerCargoAllocationResult>;
}

export type {
  ContainerCargoAllocationInput,
  ContainerCargoAllocationResult,
  ReplaceContainerCargoAllocationsCommand,
} from "./domain/container-cargo-allocation";
