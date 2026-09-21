import { Inject, Injectable } from "@nestjs/common";
import type {
  ContainerCargoComplianceScope,
  GetContainerCargoComplianceScopePort,
} from "../get-container-cargo-compliance-scope.port";
import {
  CONTAINER_CARGO_ALLOCATION_REPOSITORY,
  type ContainerCargoAllocationRepository,
} from "../domain/container-cargo-allocation.repository";

@Injectable()
export class GetContainerCargoComplianceScopeService implements GetContainerCargoComplianceScopePort {
  constructor(
    @Inject(CONTAINER_CARGO_ALLOCATION_REPOSITORY)
    private readonly repository: ContainerCargoAllocationRepository,
  ) {}

  execute(input: {
    tenantId: string;
    containerRecordId: string;
  }): Promise<ContainerCargoComplianceScope | null> {
    return this.repository.findActiveComplianceScope(input);
  }
}
