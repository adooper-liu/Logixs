import {
  Module,
  forwardRef,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { DocumentRecordsModule } from "../document-records";
import { IdentityModule, DevIdentityMiddleware } from "../identity";
import { LifecycleControlModule } from "../lifecycle-control";
import { ShipmentRegistryModule } from "../shipment-registry";
import { ClaimWorkOrderService } from "./application/claim-work-order.service";
import { CompleteWorkOrderService } from "./application/complete-work-order.service";
import { CreateNodeTaskService } from "./application/create-node-task.service";
import { GetNodeTaskService } from "./application/get-node-task.service";
import { ListNodeTasksService } from "./application/list-node-tasks.service";
import { ListObjectTaskActivityService } from "./application/list-object-task-activity.service";
import { CREATE_NODE_TASK } from "./create-node-task.port";
import { WORK_CLIENT_OPERATION_REPOSITORY } from "./domain/client-operation.repository";
import { WORK_EXECUTION_REPOSITORY } from "./domain/work-execution.repository";
import { LIST_OBJECT_TASK_ACTIVITY } from "./list-object-task-activity.port";
import { PrismaWorkClientOperationRepository } from "./infrastructure/prisma-client-operation.repository";
import { PrismaWorkExecutionRepository } from "./infrastructure/prisma-work-execution.repository";
import { WorkExecutionController } from "./presentation/work-execution.controller";

@Module({
  imports: [
    IdentityModule,
    DocumentRecordsModule,
    ShipmentRegistryModule,
    forwardRef(() => LifecycleControlModule),
  ],
  controllers: [WorkExecutionController],
  providers: [
    CreateNodeTaskService,
    GetNodeTaskService,
    ListNodeTasksService,
    ListObjectTaskActivityService,
    CompleteWorkOrderService,
    ClaimWorkOrderService,
    {
      provide: WORK_EXECUTION_REPOSITORY,
      useClass: PrismaWorkExecutionRepository,
    },
    {
      provide: WORK_CLIENT_OPERATION_REPOSITORY,
      useClass: PrismaWorkClientOperationRepository,
    },
    { provide: CREATE_NODE_TASK, useExisting: CreateNodeTaskService },
    {
      provide: LIST_OBJECT_TASK_ACTIVITY,
      useExisting: ListObjectTaskActivityService,
    },
  ],
  exports: [
    CreateNodeTaskService,
    CREATE_NODE_TASK,
    LIST_OBJECT_TASK_ACTIVITY,
    ListObjectTaskActivityService,
  ],
})
export class WorkExecutionModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(DevIdentityMiddleware).forRoutes(WorkExecutionController);
  }
}
