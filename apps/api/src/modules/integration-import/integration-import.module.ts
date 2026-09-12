import { Module } from "@nestjs/common";
import { AiGovernanceModule } from "../ai-governance";
import { CreateImportBatchService } from "./application/create-import-batch.service";
import { GetImportBatchService } from "./application/get-import-batch.service";
import { IMPORT_REPOSITORY } from "./domain/import.repository";
import { PrismaImportRepository } from "./infrastructure/prisma-import.repository";
import { ImportBatchesController } from "./presentation/import-batches.controller";

@Module({
  imports: [AiGovernanceModule],
  controllers: [ImportBatchesController],
  providers: [
    CreateImportBatchService,
    GetImportBatchService,
    { provide: IMPORT_REPOSITORY, useClass: PrismaImportRepository },
  ],
})
export class IntegrationImportModule {}
