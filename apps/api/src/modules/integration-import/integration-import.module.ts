import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { config } from "../../config/env";
import { AiGovernanceModule } from "../ai-governance";
import { IdentityModule, DevIdentityMiddleware } from "../identity";
import { ShipmentRegistryModule } from "../shipment-registry";
import { LifecycleControlModule } from "../lifecycle-control";
import { MasterDataModule } from "../master-data";
import { DocumentRecordsModule } from "../document-records";
import { ShipmentLifecycleOrchestrationModule } from "../shipment-lifecycle-orchestration";
import { AcceptPostDepartureSourceCandidateService } from "./application/accept-post-departure-source-candidate.service";
import { CorrectPostDepartureSourceCandidateService } from "./application/correct-post-departure-source-candidate.service";
import { CompletePostDepartureCandidateCargoService } from "./application/complete-post-departure-candidate-cargo.service";
import { ConfirmMappingsService } from "./application/confirm-mappings.service";
import { CreateImportBatchService } from "./application/create-import-batch.service";
import { ExecuteImportService } from "./application/execute-import.service";
import { GetImportBatchService } from "./application/get-import-batch.service";
import { RunPrecheckService } from "./application/run-precheck.service";
import { PreflightPostDepartureSourcePackageService } from "./application/preflight-post-departure-source-package.service";
import { SavePostDepartureSourcePackageReviewService } from "./application/save-post-departure-source-package-review.service";
import { SearchPostDepartureReferencePortsService } from "./application/search-post-departure-reference-ports.service";
import { IMPORT_REPOSITORY } from "./domain/import.repository";
import { IMPORT_SOURCE_STORAGE } from "./domain/import-source-storage";
import { PrismaImportRepository } from "./infrastructure/prisma-import.repository";
import { S3ImportSourceStorage } from "./infrastructure/s3-import-source-storage";
import { ImportBatchesController } from "./presentation/import-batches.controller";
import { PostDepartureSourcePackageController } from "./presentation/post-departure-source-package.controller";

@Module({
  imports: [
    AiGovernanceModule,
    IdentityModule,
    ShipmentRegistryModule,
    LifecycleControlModule,
    MasterDataModule,
    DocumentRecordsModule,
    ShipmentLifecycleOrchestrationModule,
  ],
  controllers: [ImportBatchesController, PostDepartureSourcePackageController],
  providers: [
    CreateImportBatchService,
    GetImportBatchService,
    ConfirmMappingsService,
    RunPrecheckService,
    ExecuteImportService,
    PreflightPostDepartureSourcePackageService,
    SavePostDepartureSourcePackageReviewService,
    CorrectPostDepartureSourceCandidateService,
    CompletePostDepartureCandidateCargoService,
    SearchPostDepartureReferencePortsService,
    AcceptPostDepartureSourceCandidateService,
    { provide: IMPORT_REPOSITORY, useClass: PrismaImportRepository },
    {
      provide: IMPORT_SOURCE_STORAGE,
      useFactory: () => new S3ImportSourceStorage(config.importSourceStorage),
    },
  ],
})
export class IntegrationImportModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(DevIdentityMiddleware)
      .forRoutes(ImportBatchesController, PostDepartureSourcePackageController);
  }
}
