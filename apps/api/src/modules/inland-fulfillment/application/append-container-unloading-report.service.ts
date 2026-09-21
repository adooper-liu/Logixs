import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AppendContainerUnloadingReportPort } from "../append-container-unloading-report.port";
import {
  ContainerUnloadingReportConflictError,
  ContainerUnloadingReportNotFoundError,
  ContainerUnloadingReportValidationError,
  normalizeContainerUnloadingReportCommand,
  type AppendContainerUnloadingReportCommand,
} from "../domain/container-unloading-report";
import {
  CONTAINER_UNLOADING_REPORT_REPOSITORY,
  type ContainerUnloadingReportRepository,
} from "../domain/container-unloading-report.repository";

@Injectable()
export class AppendContainerUnloadingReportService implements AppendContainerUnloadingReportPort {
  constructor(
    @Inject(CONTAINER_UNLOADING_REPORT_REPOSITORY)
    private readonly repository: ContainerUnloadingReportRepository,
  ) {}

  async execute(command: AppendContainerUnloadingReportCommand) {
    let normalized;
    try {
      normalized = normalizeContainerUnloadingReportCommand(command);
    } catch (error) {
      if (error instanceof ContainerUnloadingReportValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    try {
      return await this.repository.append(normalized);
    } catch (error) {
      if (error instanceof ContainerUnloadingReportNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof ContainerUnloadingReportConflictError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
