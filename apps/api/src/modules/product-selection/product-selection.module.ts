import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { IdentityModule, DevIdentityMiddleware } from "../identity";
import { IntakeProductOpportunityService } from "./application/intake-product-opportunity.service";
import { ListProductOpportunitiesService } from "./application/list-product-opportunities.service";
import { PRODUCT_OPPORTUNITY_REPOSITORY } from "./domain/product-opportunity.repository";
import { PrismaProductOpportunityRepository } from "./infrastructure/prisma-product-opportunity.repository";
import { ProductOpportunitiesController } from "./presentation/product-opportunities.controller";

@Module({
  imports: [IdentityModule],
  controllers: [ProductOpportunitiesController],
  providers: [
    ListProductOpportunitiesService,
    IntakeProductOpportunityService,
    {
      provide: PRODUCT_OPPORTUNITY_REPOSITORY,
      useClass: PrismaProductOpportunityRepository,
    },
  ],
})
export class ProductSelectionModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(DevIdentityMiddleware)
      .forRoutes(ProductOpportunitiesController);
  }
}
