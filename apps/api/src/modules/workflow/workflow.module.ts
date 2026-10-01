import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { IdentityModule, DevServiceIdentityMiddleware } from "../identity";
import { EnsureOutboxPublishSystemScheduleService } from "./application/ensure-outbox-publish-system-schedule.service";
import { WORKFLOW_SCHEDULE } from "./domain/workflow-schedule.port";
import { TemporalScheduleAdapter } from "./infrastructure/temporal-schedule.adapter";
import { OutboxPublishSystemScheduleController } from "./presentation/outbox-publish-system-schedule.controller";

@Module({
  imports: [IdentityModule],
  controllers: [OutboxPublishSystemScheduleController],
  providers: [
    EnsureOutboxPublishSystemScheduleService,
    { provide: WORKFLOW_SCHEDULE, useClass: TemporalScheduleAdapter },
  ],
})
export class WorkflowModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(DevServiceIdentityMiddleware)
      .forRoutes(OutboxPublishSystemScheduleController);
  }
}
