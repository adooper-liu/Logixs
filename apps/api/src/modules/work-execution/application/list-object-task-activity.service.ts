import { Inject, Injectable } from "@nestjs/common";
import {
  projectNextActions,
  projectTaskActivities,
} from "../domain/object-task-activity";
import {
  WORK_EXECUTION_REPOSITORY,
  type WorkExecutionRepository,
} from "../domain/work-execution.repository";
import type {
  ListObjectTaskActivityPort,
  ObjectTaskTarget,
} from "../list-object-task-activity.port";

const ASSERT_CONTAINER_TENANT = Symbol.for("logix.AssertContainerTenant");

interface AssertContainerTenantPort {
  execute(input: { containerId: string; tenantId: string }): Promise<void>;
}

@Injectable()
export class ListObjectTaskActivityService implements ListObjectTaskActivityPort {
  constructor(
    @Inject(WORK_EXECUTION_REPOSITORY)
    private readonly repository: WorkExecutionRepository,
    @Inject(ASSERT_CONTAINER_TENANT)
    private readonly assertContainerTenant: AssertContainerTenantPort,
  ) {}

  async execute(input: {
    tenantId: string;
    containerId: string;
    atOrBefore: Date;
    take: number;
  }) {
    await this.assertContainerTenant.execute({
      containerId: input.containerId,
      tenantId: input.tenantId,
    });
    const tasks = await this.repository.listTasksByContainer({
      containerId: input.containerId,
      take: 200,
    });
    const workOrderIds = tasks.flatMap((task) =>
      task.workOrders.map((workOrder) => workOrder.id),
    );
    const operations =
      await this.repository.listCommittedWorkActivityOperations({
        tenantId: input.tenantId,
        workOrderIds,
        atOrBefore: input.atOrBefore,
        take: input.take,
      });
    return {
      activities: projectTaskActivities(tasks, operations).filter(
        (item) => item.occurredAt <= input.atOrBefore,
      ),
      nextActions: projectNextActions(tasks),
      targets: tasks.flatMap((bundle) => {
        const containerId = bundle.task.containerId;
        if (!containerId) return [];
        return bundle.workOrders.map((workOrder) => ({
          containerId,
          taskId: bundle.task.id,
          workOrderId: workOrder.id,
        }));
      }),
    };
  }

  async resolveTarget(input: {
    tenantId: string;
    containerId: string;
    taskId: string;
    workOrderId?: string | null;
  }): Promise<ObjectTaskTarget | null> {
    await this.assertContainerTenant.execute({
      containerId: input.containerId,
      tenantId: input.tenantId,
    });
    const bundle = await this.repository.findTaskById(input.taskId);
    if (!bundle || bundle.task.containerId !== input.containerId) return null;
    const workOrderId = input.workOrderId?.trim() || null;
    if (
      workOrderId &&
      !bundle.workOrders.some((workOrder) => workOrder.id === workOrderId)
    ) {
      return null;
    }
    return {
      containerId: input.containerId,
      taskId: bundle.task.id,
      workOrderId,
    };
  }
}
