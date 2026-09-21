import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { DocumentRecordsModule } from "../document-records";
import { IdentityModule, DevIdentityMiddleware } from "../identity";
import { InlandFulfillmentModule } from "../inland-fulfillment";
import { LifecycleControlModule } from "../lifecycle-control";
import { ReplaceWarehouseDeliveryInstructionAndReplayService } from "./application/replace-warehouse-delivery-instruction-and-replay.service";
import { WarehouseDeliveryInstructionCommandController } from "./presentation/warehouse-delivery-instruction-command.controller";

@Module({
  imports: [
    IdentityModule,
    DocumentRecordsModule,
    InlandFulfillmentModule,
    LifecycleControlModule,
  ],
  controllers: [WarehouseDeliveryInstructionCommandController],
  providers: [ReplaceWarehouseDeliveryInstructionAndReplayService],
})
export class InlandLifecycleOrchestrationModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(DevIdentityMiddleware)
      .forRoutes(WarehouseDeliveryInstructionCommandController);
  }
}
