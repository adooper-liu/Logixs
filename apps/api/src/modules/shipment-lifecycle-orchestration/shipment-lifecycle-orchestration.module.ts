import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { DocumentRecordsModule } from "../document-records";
import { DevIdentityMiddleware, IdentityModule } from "../identity";
import { LifecycleControlModule } from "../lifecycle-control";
import { ShipmentRegistryModule } from "../shipment-registry";
import { ReplaceContainerStuffingAndReplayService } from "./application/replace-container-stuffing-and-replay.service";
import { ContainerStuffingCommandController } from "./presentation/container-stuffing-command.controller";

@Module({
  imports: [
    DocumentRecordsModule,
    IdentityModule,
    LifecycleControlModule,
    ShipmentRegistryModule,
  ],
  controllers: [ContainerStuffingCommandController],
  providers: [ReplaceContainerStuffingAndReplayService],
})
export class ShipmentLifecycleOrchestrationModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(DevIdentityMiddleware)
      .forRoutes(ContainerStuffingCommandController);
  }
}
