import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { AiGovernanceModule } from "../ai-governance";
import { IdentityModule, DevIdentityMiddleware } from "../identity";
import { LifecycleControlModule } from "../lifecycle-control";
import { NotificationModule } from "../notification";
import { ShipmentRegistryModule } from "../shipment-registry";
import { WorkExecutionModule } from "../work-execution";
import { BuildAssistantObjectContextService } from "./application/build-assistant-object-context.service";
import { OpenAssistantSessionService } from "./application/open-assistant-session.service";
import { PostAssistantMessageService } from "./application/post-assistant-message.service";
import { OpsAssistantController } from "./presentation/ops-assistant.controller";

@Module({
  imports: [
    IdentityModule,
    NotificationModule,
    AiGovernanceModule,
    ShipmentRegistryModule,
    LifecycleControlModule,
    WorkExecutionModule,
  ],
  controllers: [OpsAssistantController],
  providers: [
    BuildAssistantObjectContextService,
    OpenAssistantSessionService,
    PostAssistantMessageService,
  ],
})
export class OpsAssistantModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(DevIdentityMiddleware).forRoutes(OpsAssistantController);
  }
}
