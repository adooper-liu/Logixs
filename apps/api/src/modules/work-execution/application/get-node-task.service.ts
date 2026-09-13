import { Inject, Injectable } from "@nestjs/common";
import {
  WORK_EXECUTION_REPOSITORY,
  type NodeTaskWithWorkOrders,
  type WorkExecutionRepository,
} from "../domain/work-execution.repository";

const ASSERT_CONTAINER_TENANT = Symbol.for("logix.AssertContainerTenant");

interface AssertContainerTenantPort {
  execute(input: { containerId: string; tenantId: string }): Promise<void>;
}

@Injectable()
export class GetNodeTaskService {
  constructor(
    @Inject(WORK_EXECUTION_REPOSITORY)
    private readonly repository: WorkExecutionRepository,
    @Inject(ASSERT_CONTAINER_TENANT)
    private readonly assertContainerTenant: AssertContainerTenantPort,
  ) {}

  async execute(
    id: string,
    tenantId: string,
  ): Promise<NodeTaskWithWorkOrders | null> {
    const bundle = await this.repository.findTaskById(id);
    if (!bundle) return null;
    if (bundle.task.containerId) {
      await this.assertContainerTenant.execute({
        containerId: bundle.task.containerId,
        tenantId,
      });
    }
    return bundle;
  }
}
