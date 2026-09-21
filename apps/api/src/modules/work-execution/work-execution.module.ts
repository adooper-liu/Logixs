import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
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
import { WORK_EXECUTION_REPOSITORY } from "./domain/work-execution.repository";
import { EXTERNAL_WORK_ITEM_REPOSITORY } from "./domain/external-work-item.repository";
import { LIST_OBJECT_TASK_ACTIVITY } from "./list-object-task-activity.port";
import { PrismaWorkClientOperationRepository } from "./infrastructure/prisma-client-operation.repository";
import { PrismaWorkExecutionRepository } from "./infrastructure/prisma-work-execution.repository";
import { PrismaExternalWorkItemRepository } from "./infrastructure/prisma-external-work-item.repository";
import { PROJECT_EXTERNAL_WORK_ITEMS } from "./project-external-work-items.port";
import { RECONCILE_APPLIED_LIFECYCLE_FACT } from "./reconcile-applied-lifecycle-fact.port";
import { WorkExecutionController } from "./presentation/work-execution.controller";

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
  ],
  exports: [
    CreateNodeTaskService,
    CREATE_NODE_TASK,
    PROJECT_EXTERNAL_WORK_ITEMS,
    LIST_OBJECT_TASK_ACTIVITY,
    ListObjectTaskActivityService,
    RECONCILE_APPLIED_LIFECYCLE_FACT,
  ],
})
export class WorkExecutionModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(DevIdentityMiddleware).forRoutes(WorkExecutionController);
  }
}
