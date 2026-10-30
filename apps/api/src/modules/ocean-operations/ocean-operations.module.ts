import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { MasterDataModule } from "../master-data";
import { IdentityModule, DevIdentityMiddleware } from "../identity";
import { OceanOperationsController } from "./presentation/ocean-operations.controller";
import { OceanOperationsSourceReviewService } from "./application/ocean-operations-source-review.service";
import { OCEAN_OPERATIONS_SOURCE_REVIEW_REPOSITORY } from "./domain/ocean-operations-source-review.repository";
import { PrismaOceanOperationsSourceReviewRepository } from "./infrastructure/prisma-ocean-operations-source-review.repository";

@Module({
  imports: [IdentityModule, MasterDataModule],
  controllers: [OceanOperationsController],
  providers: [
    OceanOperationsSourceReviewService,
    {
      provide: OCEAN_OPERATIONS_SOURCE_REVIEW_REPOSITORY,
      useClass: PrismaOceanOperationsSourceReviewRepository,
    },
  ],
})
export class OceanOperationsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(DevIdentityMiddleware).forRoutes(OceanOperationsController);
  }
}
