import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { ReplaceContainerCargoAllocationsPort } from "../replace-container-cargo-allocations.port";
import {
  ContainerCargoAllocationConflictError,
  ContainerCargoAllocationNotFoundError,
  ContainerCargoAllocationValidationError,
  normalizeReplaceContainerCargoAllocationsCommand,
  type ContainerCargoAllocationResult,
  type ReplaceContainerCargoAllocationsCommand,
} from "../domain/container-cargo-allocation";
import {
  CONTAINER_CARGO_ALLOCATION_REPOSITORY,
  type ContainerCargoAllocationRepository,
} from "../domain/container-cargo-allocation.repository";

@Injectable()
export class ReplaceContainerCargoAllocationsService implements ReplaceContainerCargoAllocationsPort {
  constructor(
    @Inject(CONTAINER_CARGO_ALLOCATION_REPOSITORY)
    private readonly repository: ContainerCargoAllocationRepository,
  ) {}

  async execute(
    command: ReplaceContainerCargoAllocationsCommand,
  ): Promise<ContainerCargoAllocationResult> {
    let normalized;
    try {
      normalized = normalizeReplaceContainerCargoAllocationsCommand(command);
    } catch (error) {
      if (error instanceof ContainerCargoAllocationValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    try {
      return await this.repository.replace(normalized);
    } catch (error) {
      if (error instanceof ContainerCargoAllocationNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof ContainerCargoAllocationConflictError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
