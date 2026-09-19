import { Module } from "@nestjs/common";
import { DocumentRecordsModule } from "../document-records";
import { LifecycleControlModule } from "../lifecycle-control";
import { ShipmentRegistryModule } from "../shipment-registry";
import { IngestTrackingEyesEventService } from "./application/ingest-trackingeyes-event.service";
import { PROVIDER_EVENT_INGESTION_REPOSITORY } from "./domain/provider-event-ingestion.repository";
import { INGEST_TRACKINGEYES_EVENT } from "./ingest-trackingeyes-event.port";
import { PrismaProviderEventIngestionRepository } from "./infrastructure/prisma-provider-event-ingestion.repository";

@Module({
  imports: [
    DocumentRecordsModule,
    LifecycleControlModule,
    ShipmentRegistryModule,
  ],
  providers: [
    IngestTrackingEyesEventService,
    {
      provide: PROVIDER_EVENT_INGESTION_REPOSITORY,
      useClass: PrismaProviderEventIngestionRepository,
    },
    {
      provide: INGEST_TRACKINGEYES_EVENT,
      useExisting: IngestTrackingEyesEventService,
    },
  ],
  exports: [IngestTrackingEyesEventService, INGEST_TRACKINGEYES_EVENT],
})
export class OceanPortVisibilityModule {}
