import type {
  ContainerCargoAllocationResult,
  NormalizedReplaceContainerCargoAllocationsCommand,
} from "./container-cargo-allocation";
import type { ContainerCargoComplianceScope } from "../get-container-cargo-compliance-scope.port";

export const CONTAINER_CARGO_ALLOCATION_REPOSITORY = Symbol(
  "ContainerCargoAllocationRepository",
);

export interface ContainerCargoAllocationRepository {
  replace(
    command: NormalizedReplaceContainerCargoAllocationsCommand,
  ): Promise<ContainerCargoAllocationResult>;
  findActiveComplianceScope(input: {
    tenantId: string;
    containerRecordId: string;
  }): Promise<ContainerCargoComplianceScope | null>;
}
