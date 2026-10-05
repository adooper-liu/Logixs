import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { DocumentRecordsModule } from "../document-records";
import { IdentityModule, DevIdentityMiddleware } from "../identity";
import { MarketIntelligenceModule } from "../market-intelligence";
import { MasterDataModule } from "../master-data";
import { AdvanceProductDefinitionService } from "./application/advance-product-definition.service";
import { ClaimProductInitiativeService } from "./application/claim-product-initiative.service";
import { GetProductDefinitionService } from "./application/get-product-definition.service";
import { ReleaseProductDefinitionService } from "./application/release-product-definition.service";
import { DecideProductInitiativeService } from "./application/decide-product-initiative.service";
import { TakeBackSelectionReturnService } from "./application/take-back-selection-return.service";
import { ListNpiQueueService } from "./application/list-npi-queue.service";
import { ReturnProductInitiativeFromNpiService } from "./application/return-product-initiative-from-npi.service";
import { GetProductInitiativeService } from "./application/get-product-initiative.service";
import { IntakeProductOpportunityService } from "./application/intake-product-opportunity.service";
import { ListProductInitiativesService } from "./application/list-product-initiatives.service";
import { ListProductOpportunitiesService } from "./application/list-product-opportunities.service";
import { PRODUCT_DEFINITION_REPOSITORY } from "./domain/product-definition.repository";
import { PRODUCT_INITIATIVE_REPOSITORY } from "./domain/product-initiative.repository";
import { PRODUCT_OPPORTUNITY_REPOSITORY } from "./domain/product-opportunity.repository";
import { PrismaProductDefinitionRepository } from "./infrastructure/prisma-product-definition.repository";
import { PrismaProductInitiativeRepository } from "./infrastructure/prisma-product-initiative.repository";
import { PrismaProductOpportunityRepository } from "./infrastructure/prisma-product-opportunity.repository";
import { ProductInitiativesController } from "./presentation/product-initiatives.controller";
import { ProductDefinitionController } from "./presentation/product-definition.controller";
import { ProductNpiController } from "./presentation/product-npi.controller";
import { ProductOpportunitiesController } from "./presentation/product-opportunities.controller";
import { SelectionReturnTakebackController } from "./presentation/selection-return-takeback.controller";

@Module({
  imports: [
    IdentityModule,
    DocumentRecordsModule,
    MarketIntelligenceModule,
    MasterDataModule,
  ],
  controllers: [
    ProductOpportunitiesController,
    ProductInitiativesController,
    ProductNpiController,
    ProductDefinitionController,
    SelectionReturnTakebackController,
  ],
  providers: [
    ListProductOpportunitiesService,
    IntakeProductOpportunityService,
    ListProductInitiativesService,
    GetProductInitiativeService,
    DecideProductInitiativeService,
    TakeBackSelectionReturnService,
    ListNpiQueueService,
    ClaimProductInitiativeService,
    ReturnProductInitiativeFromNpiService,
    GetProductDefinitionService,
    AdvanceProductDefinitionService,
    ReleaseProductDefinitionService,
    {
      provide: PRODUCT_OPPORTUNITY_REPOSITORY,
      useClass: PrismaProductOpportunityRepository,
    },
    {
      provide: PRODUCT_INITIATIVE_REPOSITORY,
      useClass: PrismaProductInitiativeRepository,
    },
    {
      provide: PRODUCT_DEFINITION_REPOSITORY,
      useClass: PrismaProductDefinitionRepository,
    },
  ],
})
export class ProductSelectionModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(DevIdentityMiddleware)
      .forRoutes(
        ProductOpportunitiesController,
        ProductInitiativesController,
        ProductNpiController,
        ProductDefinitionController,
        SelectionReturnTakebackController,
      );
  }
}
