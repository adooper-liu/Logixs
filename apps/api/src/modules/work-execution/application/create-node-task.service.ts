import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { LifecycleNodeCode } from "@logix/contracts";
import { isLifecycleNodeCode } from "../domain/lifecycle-node-codes";

const ASSERT_CONTAINER_TENANT = Symbol.for("logix.AssertContainerTenant");

interface AssertContainerTenantPort {
  execute(input: { containerId: string; tenantId: string }): Promise<void>;
}
import {
  WORK_EXECUTION_REPOSITORY,
  type NodeTaskWithWorkOrders,
  type WorkExecutionRepository,
} from "../domain/work-execution.repository";

export interface CreateNodeTaskInput {
  flowInstanceId: string;
  nodeInstanceId: string;
  nodeCode: string;
  containerId?: string;
  tenantId?: string;
}

@Injectable()
export class CreateNodeTaskService {
  constructor(
    @Inject(WORK_EXECUTION_REPOSITORY)
    private readonly repository: WorkExecutionRepository,
    @Inject(ASSERT_CONTAINER_TENANT)
    private readonly assertContainerTenant: AssertContainerTenantPort,
  ) {}

  async execute(input: CreateNodeTaskInput): Promise<NodeTaskWithWorkOrders> {
    if (input.containerId && input.tenantId) {
      await this.assertContainerTenant.execute({
        containerId: input.containerId,
        tenantId: input.tenantId,
      });
    }
    if (!isLifecycleNodeCode(input.nodeCode)) {
      throw new HttpException(
        "VALIDATION_FORMAT: 未知节点码",
        HttpStatus.BAD_REQUEST,
      );
    }

    const existing = await this.repository.findTaskByNodeInstanceId(
      input.nodeInstanceId,
    );
    if (existing) return existing;

    const nodeCode: LifecycleNodeCode = input.nodeCode;
    return this.repository.createTaskWithRequiredWorkOrder({
      flowInstanceId: input.flowInstanceId,
      nodeInstanceId: input.nodeInstanceId,
      nodeCode,
      containerId: input.containerId ?? null,
      taskDefinitionKey: `node-${nodeCode}`,
      workOrderDefinitionKey: `wo-${nodeCode}`,
    });
  }
}
