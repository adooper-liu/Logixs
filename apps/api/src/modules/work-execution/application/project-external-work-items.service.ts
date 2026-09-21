import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from "@nestjs/common";
import {
  ASSERT_CONTAINER_TENANT,
  type AssertContainerTenantPort,
} from "../../shipment-registry";
import type { ProjectExternalWorkItemsPort } from "../project-external-work-items.port";
import {
  ExternalWorkItemValidationError,
  normalizeExternalWorkItemProjection,
  type ProjectExternalWorkItemsCommand,
} from "../domain/external-work-item";
import {
  EXTERNAL_WORK_ITEM_REPOSITORY,
  ExternalWorkItemConflictError,
  type ExternalWorkItemRepository,
} from "../domain/external-work-item.repository";

@Injectable()
export class ProjectExternalWorkItemsService implements ProjectExternalWorkItemsPort {
  constructor(
    @Inject(ASSERT_CONTAINER_TENANT)
    private readonly assertContainerTenant: AssertContainerTenantPort,
    @Inject(EXTERNAL_WORK_ITEM_REPOSITORY)
    private readonly repository: ExternalWorkItemRepository,
  ) {}

  async execute(input: ProjectExternalWorkItemsCommand) {
    try {
      const normalized = normalizeExternalWorkItemProjection(input);
      await this.assertContainerTenant.execute({
        tenantId: normalized.tenantId,
        containerId: normalized.containerId,
      });
      return await this.repository.replaceProjection(normalized);
    } catch (error) {
      if (error instanceof ExternalWorkItemValidationError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof ExternalWorkItemConflictError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
