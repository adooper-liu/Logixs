import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { IdentityModule, DevIdentityMiddleware } from "../identity";
import { ChargesSettlementModule } from "../charges-settlement";
import { ShipmentRegistryModule } from "../shipment-registry";
import { DraftInlandPlanService } from "./application/draft-inland-plan.service";
import { ReplacePlanningSetupService } from "./application/replace-planning-setup.service";
import { INLAND_PLAN_REPOSITORY } from "./domain/inland-plan.repository";
import { PrismaInlandPlanRepository } from "./infrastructure/prisma-inland-plan.repository";
import { InlandPlanController } from "./presentation/inland-plan.controller";

@Module({
  imports: [IdentityModule, ShipmentRegistryModule, ChargesSettlementModule],
  controllers: [InlandPlanController],
  providers: [
    ReplacePlanningSetupService,
    DraftInlandPlanService,
    {
      provide: INLAND_PLAN_REPOSITORY,
      useClass: PrismaInlandPlanRepository,
    },
  ],
})
export class InlandFulfillmentModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(DevIdentityMiddleware).forRoutes(InlandPlanController);
  }
}
