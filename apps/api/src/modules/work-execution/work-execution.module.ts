import {
  Inject,
  Injectable,
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import type { NodeTaskState } from "@logix/contracts";
import { DocumentRecordsModule } from "../document-records";
import { IdentityModule, DevIdentityMiddleware } from "../identity";
import { ShipmentRegistryModule } from "../shipment-registry";
import { ClaimWorkOrderService } from "./application/claim-work-order.service";
import { CompleteWorkOrderService } from "./application/complete-work-order.service";
import { CreateNodeTaskService } from "./application/create-node-task.service";
import { GetNodeTaskService } from "./application/get-node-task.service";
import { ListNodeTasksService } from "./application/list-node-tasks.service";
import { ListExternalWorkItemsService } from "./application/list-external-work-items.service";
import { ProjectExternalWorkItemsService } from "./application/project-external-work-items.service";
import { ListObjectTaskActivityService } from "./application/list-object-task-activity.service";
import { ReconcileAppliedLifecycleFactService } from "./application/reconcile-applied-lifecycle-fact.service";
import { CREATE_NODE_TASK } from "./create-node-task.port";
import { WORK_CLIENT_OPERATION_REPOSITORY } from "./domain/client-operation.repository";
import {
  WORK_EXECUTION_REPOSITORY,
  type WorkExecutionRepository,
} from "./domain/work-execution.repository";
import { EXTERNAL_WORK_ITEM_REPOSITORY } from "./domain/external-work-item.repository";
import { LIST_OBJECT_TASK_ACTIVITY } from "./list-object-task-activity.port";
import { PrismaWorkClientOperationRepository } from "./infrastructure/prisma-client-operation.repository";
import { PrismaWorkExecutionRepository } from "./infrastructure/prisma-work-execution.repository";
import { TaskAssistantClaimExecutionAdapter } from "./infrastructure/task-assistant-claim-execution.adapter";
import { PrismaTaskCollaborationWriteContext } from "./infrastructure/prisma-task-collaboration-write-context";
import { PrismaExternalWorkItemRepository } from "./infrastructure/prisma-external-work-item.repository";
import { PROJECT_EXTERNAL_WORK_ITEMS } from "./project-external-work-items.port";
import { RECONCILE_APPLIED_LIFECYCLE_FACT } from "./reconcile-applied-lifecycle-fact.port";
import { WorkExecutionController } from "./presentation/work-execution.controller";
import { TASK_COLLABORATION_WRITE_CONTEXT } from "./task-collaboration-write-context.port";
import { TASK_ASSISTANT_CLAIM_EXECUTION } from "./task-assistant-claim-execution.port";

export const TASK_COLLABORATION_CONTEXT = Symbol.for(
  "logix.TaskCollaborationContext",
);

export interface TaskCollaborationContext {
  taskId: string;
  state: NodeTaskState;
  containerId: string;
  assigneeActorIds: string[];
}

export interface TaskCollaborationContextPort {
  resolve(input: {
    tenantId: string;
    taskId: string;
    subjectRef: { kind: "container"; id: string };
  }): Promise<TaskCollaborationContext | null>;
}

@Injectable()
export class WorkExecutionTaskCollaborationContext implements TaskCollaborationContextPort {
  constructor(
    @Inject(WORK_EXECUTION_REPOSITORY)
    private readonly repository: WorkExecutionRepository,
  ) {}

  async resolve(input: {
    tenantId: string;
    taskId: string;
    subjectRef: { kind: "container"; id: string };
  }): Promise<TaskCollaborationContext | null> {
    const bundle = await this.repository.findTaskInTenant({
      tenantId: input.tenantId,
      taskId: input.taskId,
    });
    if (!bundle?.task.containerId) return null;
    if (bundle.task.containerId !== input.subjectRef.id) return null;

    const assigneeActorIds = [
      ...new Set(
        bundle.workOrders
          .map(({ assigneeId }) => assigneeId?.trim() ?? "")
          .filter((actorId) => actorId.length > 0 && actorId.length <= 128),
      ),
    ].sort();
    return {
      taskId: bundle.task.id,
      state: bundle.task.state,
      containerId: bundle.task.containerId,
      assigneeActorIds,
    };
  }
}

@Module({
  imports: [IdentityModule, DocumentRecordsModule, ShipmentRegistryModule],
  controllers: [WorkExecutionController],
  providers: [
    CreateNodeTaskService,
    GetNodeTaskService,
    ListNodeTasksService,
    ListExternalWorkItemsService,
    ProjectExternalWorkItemsService,
    ListObjectTaskActivityService,
    CompleteWorkOrderService,
    ClaimWorkOrderService,
    ReconcileAppliedLifecycleFactService,
    WorkExecutionTaskCollaborationContext,
    PrismaTaskCollaborationWriteContext,
    TaskAssistantClaimExecutionAdapter,
    {
      provide: WORK_EXECUTION_REPOSITORY,
      useClass: PrismaWorkExecutionRepository,
    },
    {
      provide: EXTERNAL_WORK_ITEM_REPOSITORY,
      useClass: PrismaExternalWorkItemRepository,
    },
    {
      provide: WORK_CLIENT_OPERATION_REPOSITORY,
      useClass: PrismaWorkClientOperationRepository,
    },
    { provide: CREATE_NODE_TASK, useExisting: CreateNodeTaskService },
    {
      provide: PROJECT_EXTERNAL_WORK_ITEMS,
      useExisting: ProjectExternalWorkItemsService,
    },
    {
      provide: LIST_OBJECT_TASK_ACTIVITY,
      useExisting: ListObjectTaskActivityService,
    },
    {
      provide: RECONCILE_APPLIED_LIFECYCLE_FACT,
      useExisting: ReconcileAppliedLifecycleFactService,
    },
    {
      provide: TASK_COLLABORATION_CONTEXT,
      useExisting: WorkExecutionTaskCollaborationContext,
    },
    {
      provide: TASK_COLLABORATION_WRITE_CONTEXT,
      useExisting: PrismaTaskCollaborationWriteContext,
    },
    {
      provide: TASK_ASSISTANT_CLAIM_EXECUTION,
      useExisting: TaskAssistantClaimExecutionAdapter,
    },
  ],
  exports: [
    CREATE_NODE_TASK,
    PROJECT_EXTERNAL_WORK_ITEMS,
    LIST_OBJECT_TASK_ACTIVITY,
    ListObjectTaskActivityService,
    RECONCILE_APPLIED_LIFECYCLE_FACT,
    TASK_COLLABORATION_CONTEXT,
    TASK_COLLABORATION_WRITE_CONTEXT,
    TASK_ASSISTANT_CLAIM_EXECUTION,
  ],
})
export class WorkExecutionModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(DevIdentityMiddleware).forRoutes(WorkExecutionController);
  }
}
