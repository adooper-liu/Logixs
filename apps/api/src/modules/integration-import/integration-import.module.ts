import { Module } from "@nestjs/common";
import { AiGovernanceModule } from "../ai-governance";
import { ShipmentRegistryModule } from "../shipment-registry";
import { ConfirmMappingsService } from "./application/confirm-mappings.service";
import { CreateImportBatchService } from "./application/create-import-batch.service";
import { ExecuteImportService } from "./application/execute-import.service";
import { GetImportBatchService } from "./application/get-import-batch.service";
import { RunPrecheckService } from "./application/run-precheck.service";
import { IMPORT_REPOSITORY } from "./domain/import.repository";
import { PrismaImportRepository } from "./infrastructure/prisma-import.repository";
import { ImportBatchesController } from "./presentation/import-batches.controller";

@Module({
  imports: [AiGovernanceModule, ShipmentRegistryModule],
  controllers: [ImportBatchesController],
  providers: [
    CreateImportBatchService,
    GetImportBatchService,
    ConfirmMappingsService,
    RunPrecheckService,
    ExecuteImportService,
    { provide: IMPORT_REPOSITORY, useClass: PrismaImportRepository },
  ],
})
export class IntegrationImportModule {}
