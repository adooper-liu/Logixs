import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ContainerStuffingSnapshotConflictError,
  ContainerStuffingSnapshotNotFoundError,
  ContainerStuffingSnapshotValidationError,
  normalizeContainerStuffingSnapshotCommand,
  type ContainerStuffingSnapshotRecord,
  type ReplaceContainerStuffingSnapshotCommand,
} from "../domain/container-stuffing-snapshot";
import {
  CONTAINER_STUFFING_SNAPSHOT_REPOSITORY,
  type ContainerStuffingSnapshotRepository,
} from "../domain/container-stuffing-snapshot.repository";
import type { ReplaceContainerStuffingSnapshotPort } from "../replace-container-stuffing-snapshot.port";

@Injectable()
export class ReplaceContainerStuffingSnapshotService implements ReplaceContainerStuffingSnapshotPort {
  constructor(
    @Inject(CONTAINER_STUFFING_SNAPSHOT_REPOSITORY)
    private readonly repository: ContainerStuffingSnapshotRepository,
  ) {}

  async execute(
    command: ReplaceContainerStuffingSnapshotCommand,
  ): Promise<ContainerStuffingSnapshotRecord> {
    let normalized;
    try {
      normalized = normalizeContainerStuffingSnapshotCommand(command);
    } catch (error) {
      if (error instanceof ContainerStuffingSnapshotValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    try {
      return await this.repository.replace(normalized);
    } catch (error) {
      if (error instanceof ContainerStuffingSnapshotNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof ContainerStuffingSnapshotConflictError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
