import { Inject, Injectable } from "@nestjs/common";
import { AssertContainerTenantService } from "./assert-container-tenant.service";
import type { ContainerDispatchSnapshotRecord } from "../domain/container-dispatch-snapshot";
import {
  CONTAINER_DISPATCH_SNAPSHOT_REPOSITORY,
  type ContainerDispatchSnapshotRepository,
} from "../domain/container-dispatch-snapshot.repository";

@Injectable()
export class GetContainerDispatchSnapshotService {
  constructor(
    private readonly assertContainerTenant: AssertContainerTenantService,
    @Inject(CONTAINER_DISPATCH_SNAPSHOT_REPOSITORY)
    private readonly repository: ContainerDispatchSnapshotRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    containerRecordId: string;
  }): Promise<ContainerDispatchSnapshotRecord | null> {
    await this.assertContainerTenant.execute({
      tenantId: input.tenantId,
      containerId: input.containerRecordId,
    });
    return this.repository.findCurrent(input);
  }
}
