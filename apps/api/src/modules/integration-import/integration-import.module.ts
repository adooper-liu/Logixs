import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { config } from "../../config/env";
import { AiGovernanceModule } from "../ai-governance";
import { IdentityModule, DevIdentityMiddleware } from "../identity";
import { ShipmentRegistryModule } from "../shipment-registry";
import { ConfirmMappingsService } from "./application/confirm-mappings.service";
import { CreateImportBatchService } from "./application/create-import-batch.service";
import { ExecuteImportService } from "./application/execute-import.service";
import { GetImportBatchService } from "./application/get-import-batch.service";
import { RunPrecheckService } from "./application/run-precheck.service";
import { IMPORT_REPOSITORY } from "./domain/import.repository";
import { IMPORT_SOURCE_STORAGE } from "./domain/import-source-storage";
import { PrismaImportRepository } from "./infrastructure/prisma-import.repository";
import { S3ImportSourceStorage } from "./infrastructure/s3-import-source-storage";
import { ImportBatchesController } from "./presentation/import-batches.controller";

@Module({
  imports: [AiGovernanceModule, IdentityModule, ShipmentRegistryModule],
  controllers: [ImportBatchesController],
  providers: [
    CreateImportBatchService,
    GetImportBatchService,
    ConfirmMappingsService,
    RunPrecheckService,
    ExecuteImportService,
    { provide: IMPORT_REPOSITORY, useClass: PrismaImportRepository },
    {
      provide: IMPORT_SOURCE_STORAGE,
      useFactory: () => new S3ImportSourceStorage(config.importSourceStorage),
    },
  ],
})
export class IntegrationImportModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(DevIdentityMiddleware).forRoutes(ImportBatchesController);
  }
}
