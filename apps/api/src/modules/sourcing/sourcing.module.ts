import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { IdentityModule, DevIdentityMiddleware } from "../identity";
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
  imports: [IdentityModule],
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
export class SourcingModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(DevIdentityMiddleware).forRoutes(SourcingController);
  }
}
