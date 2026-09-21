import { Inject, Injectable } from "@nestjs/common";
import { AssertContainerTenantService } from "./assert-container-tenant.service";
import type { ContainerStuffingSnapshotRecord } from "../domain/container-stuffing-snapshot";
import {
  CONTAINER_STUFFING_SNAPSHOT_REPOSITORY,
  type ContainerStuffingSnapshotRepository,
} from "../domain/container-stuffing-snapshot.repository";

@Injectable()
export class GetContainerStuffingSnapshotService {
  constructor(
    private readonly assertContainerTenant: AssertContainerTenantService,
    @Inject(CONTAINER_STUFFING_SNAPSHOT_REPOSITORY)
    private readonly repository: ContainerStuffingSnapshotRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    containerRecordId: string;
  }): Promise<ContainerStuffingSnapshotRecord | null> {
    await this.assertContainerTenant.execute({
      tenantId: input.tenantId,
      containerId: input.containerRecordId,
    });
    return this.repository.findCurrent(input);
  }
}
