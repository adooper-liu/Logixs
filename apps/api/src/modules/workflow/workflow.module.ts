import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import {
  IdentityModule,
  DevIdentityMiddleware,
  DevServiceIdentityMiddleware,
} from "../identity";
import { EnsureOutboxPublishScheduleService } from "./application/ensure-outbox-publish-schedule.service";
import { EnsureOutboxPublishSystemScheduleService } from "./application/ensure-outbox-publish-system-schedule.service";
import { WORKFLOW_SCHEDULE } from "./domain/workflow-schedule.port";
import { TemporalScheduleAdapter } from "./infrastructure/temporal-schedule.adapter";
import { OutboxPublishScheduleController } from "./presentation/outbox-publish-schedule.controller";
import { OutboxPublishSystemScheduleController } from "./presentation/outbox-publish-system-schedule.controller";
import { WorkflowController } from "./workflow.controller";
import { WorkflowService } from "./workflow.service";

@Module({
  imports: [IdentityModule],
  controllers: [
    WorkflowController,
    OutboxPublishScheduleController,
    OutboxPublishSystemScheduleController,
  ],
  providers: [
    WorkflowService,
    EnsureOutboxPublishScheduleService,
    EnsureOutboxPublishSystemScheduleService,
    { provide: WORKFLOW_SCHEDULE, useClass: TemporalScheduleAdapter },
  ],
  exports: [WorkflowService],
})
export class WorkflowModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(DevIdentityMiddleware)
      .forRoutes(WorkflowController, OutboxPublishScheduleController);
    consumer
      .apply(DevServiceIdentityMiddleware)
      .forRoutes(OutboxPublishSystemScheduleController);
  }
}
