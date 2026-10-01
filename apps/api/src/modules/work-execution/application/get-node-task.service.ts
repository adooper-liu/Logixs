import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
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
    rawTenantId: string,
  ): Promise<NodeTaskWithWorkOrders | null> {
    const tenantId = rawTenantId?.trim() ?? "";
    if (!tenantId) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 缺少租户",
        HttpStatus.FORBIDDEN,
      );
    }
    // 跨租户与不存在同形；无柜任务也以任务自身租户限定，不依赖可空的 containerId。
    const bundle = await this.repository.findTaskInTenant({
      taskId: id,
      tenantId,
    });
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
