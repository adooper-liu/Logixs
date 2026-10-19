import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { DocumentRecordsModule } from "../document-records";
import { DevIdentityMiddleware, IdentityModule } from "../identity";
import { WorkExecutionModule } from "../work-execution";
import { ListTaskCollaborationService } from "./application/list-task-collaboration.service";
import { PostTaskCollaborationService } from "./application/post-task-collaboration.service";
import { TASK_COLLABORATION_CLOCK } from "./application/task-collaboration-clock";
import { TASK_COLLABORATION_REPOSITORY } from "./domain/task-collaboration.repository";
import { PrismaTaskCollaborationRepository } from "./infrastructure/prisma-task-collaboration.repository";
import { TaskCollaborationController } from "./presentation/task-collaboration.controller";

@Module({
  imports: [IdentityModule, WorkExecutionModule, DocumentRecordsModule],
  controllers: [TaskCollaborationController],
  providers: [
    ListTaskCollaborationService,
    PostTaskCollaborationService,
    {
      provide: TASK_COLLABORATION_CLOCK,
      useValue: () => new Date(),
    },
    {
      provide: TASK_COLLABORATION_REPOSITORY,
      useClass: PrismaTaskCollaborationRepository,
    },
  ],
})
export class TaskCollaborationModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(DevIdentityMiddleware)
      .forRoutes(TaskCollaborationController);
  }
}
