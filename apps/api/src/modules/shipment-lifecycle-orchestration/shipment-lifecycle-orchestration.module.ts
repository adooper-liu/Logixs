import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { DocumentRecordsModule } from "../document-records";
import { DevIdentityMiddleware, IdentityModule } from "../identity";
import { LifecycleControlModule } from "../lifecycle-control";
import { MasterDataModule } from "../master-data";
import { ShipmentRegistryModule } from "../shipment-registry";
import { ReplaceContainerStuffingAndReplayService } from "./application/replace-container-stuffing-and-replay.service";
import { ContainerStuffingCommandController } from "./presentation/container-stuffing-command.controller";
import { ReplaceContainerDispatchAndReplayService } from "./application/replace-container-dispatch-and-replay.service";
import { ContainerDispatchCommandController } from "./presentation/container-dispatch-command.controller";
import { AcceptShipmentHandoffService } from "./application/accept-shipment-handoff.service";
import { PreflightShipmentHandoffService } from "./application/preflight-shipment-handoff.service";
import { ShipmentHandoffController } from "./presentation/shipment-handoff.controller";
import { AcceptInternalShipmentHandoffService } from "./application/accept-internal-shipment-handoff.service";
import { AcceptInternalShipmentHandoffBatchService } from "./application/accept-internal-shipment-handoff-batch.service";
import { ListInternalShipmentHandoffCandidatesService } from "./application/list-internal-shipment-handoff-candidates.service";
import { CompleteShipmentPendingFactsService } from "./application/complete-shipment-pending-facts.service";
import { CompleteShipmentPendingCargoService } from "./application/complete-shipment-pending-cargo.service";
import { BindShipmentPendingSkuService } from "./application/bind-shipment-pending-sku.service";
import { CompleteShipmentPendingDocumentsService } from "./application/complete-shipment-pending-documents.service";
import {
  ACCEPT_SHIPMENT_HANDOFF,
  PREFLIGHT_SHIPMENT_HANDOFF,
} from "./shipment-handoff.port";

@Module({
  imports: [
    DocumentRecordsModule,
    IdentityModule,
    LifecycleControlModule,
    MasterDataModule,
    ShipmentRegistryModule,
  ],
  controllers: [
    ContainerStuffingCommandController,
    ContainerDispatchCommandController,
    ShipmentHandoffController,
  ],
  providers: [
    ReplaceContainerStuffingAndReplayService,
    ReplaceContainerDispatchAndReplayService,
    PreflightShipmentHandoffService,
    AcceptShipmentHandoffService,
    ListInternalShipmentHandoffCandidatesService,
    AcceptInternalShipmentHandoffService,
    AcceptInternalShipmentHandoffBatchService,
    CompleteShipmentPendingFactsService,
    CompleteShipmentPendingCargoService,
    BindShipmentPendingSkuService,
    CompleteShipmentPendingDocumentsService,
    {
      provide: PREFLIGHT_SHIPMENT_HANDOFF,
      useExisting: PreflightShipmentHandoffService,
    },
    {
      provide: ACCEPT_SHIPMENT_HANDOFF,
      useExisting: AcceptShipmentHandoffService,
    },
  ],
  exports: [PREFLIGHT_SHIPMENT_HANDOFF, ACCEPT_SHIPMENT_HANDOFF],
})
export class ShipmentLifecycleOrchestrationModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(DevIdentityMiddleware)
      .forRoutes(
        ContainerStuffingCommandController,
        ContainerDispatchCommandController,
        ShipmentHandoffController,
      );
  }
}
