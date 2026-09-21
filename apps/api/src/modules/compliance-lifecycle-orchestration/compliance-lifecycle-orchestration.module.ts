import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { ComplianceManagementModule } from "../compliance-management";
import { DevIdentityMiddleware, IdentityModule } from "../identity";
import { LifecycleControlModule } from "../lifecycle-control";
import { WorkExecutionModule } from "../work-execution";
import { AssessCargoReadyAndProjectService } from "./application/assess-cargo-ready-and-project.service";
import { DecideCargoReadyAndReplayService } from "./application/decide-cargo-ready-and-replay.service";
import { CargoReadyDecisionController } from "./presentation/cargo-ready-decision.controller";

@Module({
  imports: [
    ComplianceManagementModule,
    IdentityModule,
    LifecycleControlModule,
    WorkExecutionModule,
  ],
  controllers: [CargoReadyDecisionController],
  providers: [
    AssessCargoReadyAndProjectService,
    DecideCargoReadyAndReplayService,
  ],
})
export class ComplianceLifecycleOrchestrationModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(DevIdentityMiddleware)
      .forRoutes(CargoReadyDecisionController);
  }
}
