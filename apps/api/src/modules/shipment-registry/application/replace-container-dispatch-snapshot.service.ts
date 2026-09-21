import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ContainerDispatchSnapshotConflictError,
  ContainerDispatchSnapshotNotFoundError,
  ContainerDispatchSnapshotValidationError,
  normalizeContainerDispatchSnapshotCommand,
  type ContainerDispatchSnapshotRecord,
  type ReplaceContainerDispatchSnapshotCommand,
} from "../domain/container-dispatch-snapshot";
import {
  CONTAINER_DISPATCH_SNAPSHOT_REPOSITORY,
  type ContainerDispatchSnapshotRepository,
} from "../domain/container-dispatch-snapshot.repository";
import type { ReplaceContainerDispatchSnapshotPort } from "../replace-container-dispatch-snapshot.port";

@Injectable()
export class ReplaceContainerDispatchSnapshotService implements ReplaceContainerDispatchSnapshotPort {
  constructor(
    @Inject(CONTAINER_DISPATCH_SNAPSHOT_REPOSITORY)
    private readonly repository: ContainerDispatchSnapshotRepository,
  ) {}

  async execute(
    command: ReplaceContainerDispatchSnapshotCommand,
  ): Promise<ContainerDispatchSnapshotRecord> {
    let normalized;
    try {
      normalized = normalizeContainerDispatchSnapshotCommand(command);
    } catch (error) {
      if (error instanceof ContainerDispatchSnapshotValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    try {
      return await this.repository.replace(normalized);
    } catch (error) {
      if (error instanceof ContainerDispatchSnapshotNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof ContainerDispatchSnapshotConflictError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
