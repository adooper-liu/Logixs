import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { CustomsComplianceModule } from "../customs-compliance";
import { DocumentRecordsModule } from "../document-records";
import { DevIdentityMiddleware, IdentityModule } from "../identity";
import { LifecycleControlModule } from "../lifecycle-control";
import { ReplaceCustomsClearanceAndReplayService } from "./application/replace-customs-clearance-and-replay.service";
import { CustomsClearanceCommandController } from "./presentation/customs-clearance-command.controller";

@Module({
  imports: [
    CustomsComplianceModule,
    DocumentRecordsModule,
    IdentityModule,
    LifecycleControlModule,
  ],
  controllers: [CustomsClearanceCommandController],
  providers: [ReplaceCustomsClearanceAndReplayService],
})
export class CustomsLifecycleOrchestrationModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(DevIdentityMiddleware)
      .forRoutes(CustomsClearanceCommandController);
  }
}
