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
import {
  CustomsClearanceCaseConflictError,
  CustomsClearanceCaseValidationError,
  normalizeCustomsClearanceCaseCommand,
  type CustomsClearanceCaseRecord,
  type ReplaceCustomsClearanceCaseCommand,
} from "../domain/customs-clearance-case";
import {
  CUSTOMS_CLEARANCE_CASE_REPOSITORY,
  type CustomsClearanceCaseRepository,
} from "../domain/customs-clearance-case.repository";
import type { ReplaceCustomsClearanceCasePort } from "../replace-customs-clearance-case.port";

@Injectable()
export class ReplaceCustomsClearanceCaseService implements ReplaceCustomsClearanceCasePort {
  constructor(
    @Inject(ASSERT_CONTAINER_TENANT)
    private readonly assertContainerTenant: AssertContainerTenantPort,
    @Inject(CUSTOMS_CLEARANCE_CASE_REPOSITORY)
    private readonly repository: CustomsClearanceCaseRepository,
  ) {}

  async execute(
    command: ReplaceCustomsClearanceCaseCommand,
  ): Promise<CustomsClearanceCaseRecord> {
    try {
      const normalized = normalizeCustomsClearanceCaseCommand(command);
      await this.assertContainerTenant.execute({
        tenantId: normalized.tenantId,
        containerId: normalized.containerRecordId,
      });
      return await this.repository.replace(normalized);
    } catch (error) {
      if (error instanceof CustomsClearanceCaseValidationError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof CustomsClearanceCaseConflictError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
