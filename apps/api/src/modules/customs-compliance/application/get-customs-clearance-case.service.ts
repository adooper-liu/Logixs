import { Inject, Injectable } from "@nestjs/common";
import {
  ASSERT_CONTAINER_TENANT,
  type AssertContainerTenantPort,
} from "../../shipment-registry";
import type { CustomsClearanceCaseRecord } from "../domain/customs-clearance-case";
import {
  CUSTOMS_CLEARANCE_CASE_REPOSITORY,
  type CustomsClearanceCaseRepository,
} from "../domain/customs-clearance-case.repository";

@Injectable()
export class GetCustomsClearanceCaseService {
  constructor(
    @Inject(ASSERT_CONTAINER_TENANT)
    private readonly assertContainerTenant: AssertContainerTenantPort,
    @Inject(CUSTOMS_CLEARANCE_CASE_REPOSITORY)
    private readonly repository: CustomsClearanceCaseRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    containerRecordId: string;
  }): Promise<CustomsClearanceCaseRecord | null> {
    await this.assertContainerTenant.execute({
      tenantId: input.tenantId,
      containerId: input.containerRecordId,
    });
    return this.repository.findCurrent(input);
  }
}
