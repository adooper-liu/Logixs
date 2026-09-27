import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { DocumentRecordsModule } from "../document-records";
import { IdentityModule, DevIdentityMiddleware } from "../identity";
import { DecideProductInitiativeService } from "./application/decide-product-initiative.service";
import { GetProductInitiativeService } from "./application/get-product-initiative.service";
import { IntakeProductOpportunityService } from "./application/intake-product-opportunity.service";
import { ListProductOpportunitiesService } from "./application/list-product-opportunities.service";
import { PRODUCT_INITIATIVE_REPOSITORY } from "./domain/product-initiative.repository";
import { PRODUCT_OPPORTUNITY_REPOSITORY } from "./domain/product-opportunity.repository";
import { PrismaProductInitiativeRepository } from "./infrastructure/prisma-product-initiative.repository";
import { PrismaProductOpportunityRepository } from "./infrastructure/prisma-product-opportunity.repository";
import { ProductInitiativesController } from "./presentation/product-initiatives.controller";
import { ProductOpportunitiesController } from "./presentation/product-opportunities.controller";

@Module({
  imports: [IdentityModule, DocumentRecordsModule],
  controllers: [ProductOpportunitiesController, ProductInitiativesController],
  providers: [
    ListProductOpportunitiesService,
    IntakeProductOpportunityService,
    GetProductInitiativeService,
    DecideProductInitiativeService,
    {
      provide: PRODUCT_OPPORTUNITY_REPOSITORY,
      useClass: PrismaProductOpportunityRepository,
    },
    {
      provide: PRODUCT_INITIATIVE_REPOSITORY,
      useClass: PrismaProductInitiativeRepository,
    },
  ],
})
export class ProductSelectionModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(DevIdentityMiddleware)
      .forRoutes(ProductOpportunitiesController, ProductInitiativesController);
  }
}
