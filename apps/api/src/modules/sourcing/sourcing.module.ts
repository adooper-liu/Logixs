import { Module } from "@nestjs/common";
import {
  ListSourcingQueueService,
  NominateSupplierService,
  RecordQuotationService,
  RegisterSupplierService,
} from "./application/supplier-nomination.services";
import { SUPPLIER_NOMINATION_REPOSITORY } from "./domain/supplier-nomination.repository";
import { PrismaSupplierNominationRepository } from "./infrastructure/prisma-supplier-nomination.repository";
import { SourcingController } from "./presentation/sourcing.controller";

@Module({
  controllers: [SourcingController],
  providers: [
    ListSourcingQueueService,
    RegisterSupplierService,
    RecordQuotationService,
    NominateSupplierService,
    {
      provide: SUPPLIER_NOMINATION_REPOSITORY,
      useClass: PrismaSupplierNominationRepository,
    },
  ],
  exports: [SUPPLIER_NOMINATION_REPOSITORY],
})
export class SourcingModule {}
