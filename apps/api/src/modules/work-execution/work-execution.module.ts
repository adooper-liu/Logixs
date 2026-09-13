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
import { CompleteWorkOrderService } from "./application/complete-work-order.service";
import { CreateNodeTaskService } from "./application/create-node-task.service";
import { GetNodeTaskService } from "./application/get-node-task.service";
import { ListNodeTasksService } from "./application/list-node-tasks.service";
import { CREATE_NODE_TASK } from "./create-node-task.port";
import { WORK_EXECUTION_REPOSITORY } from "./domain/work-execution.repository";
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
    CompleteWorkOrderService,
    {
      provide: WORK_EXECUTION_REPOSITORY,
      useClass: PrismaWorkExecutionRepository,
    },
    { provide: CREATE_NODE_TASK, useExisting: CreateNodeTaskService },
  ],
  exports: [CreateNodeTaskService, CREATE_NODE_TASK],
})
export class WorkExecutionModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(DevIdentityMiddleware).forRoutes(WorkExecutionController);
  }
}
