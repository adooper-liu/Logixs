import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { IdentityModule, DevIdentityMiddleware } from "../identity";
import { ChargesSettlementModule } from "../charges-settlement";
import { ShipmentRegistryModule } from "../shipment-registry";
import { DraftInlandPlanService } from "./application/draft-inland-plan.service";
import { GetWarehouseDeliveryInstructionService } from "./application/get-warehouse-delivery-instruction.service";
import { GetWarehouseDeliveryReadinessService } from "./application/get-warehouse-delivery-readiness.service";
import { AppendContainerUnloadingReportService } from "./application/append-container-unloading-report.service";
import { GetContainerUnloadingReportService } from "./application/get-container-unloading-report.service";
import { GetContainerUnloadingReadinessService } from "./application/get-container-unloading-readiness.service";
import { ReplaceWarehouseDeliveryInstructionService } from "./application/replace-warehouse-delivery-instruction.service";
import { ReplacePlanningSetupService } from "./application/replace-planning-setup.service";
import { INLAND_PLAN_REPOSITORY } from "./domain/inland-plan.repository";
import { WAREHOUSE_DELIVERY_INSTRUCTION_REPOSITORY } from "./domain/warehouse-delivery-instruction.repository";
import { CONTAINER_UNLOADING_REPORT_REPOSITORY } from "./domain/container-unloading-report.repository";
import { GET_WAREHOUSE_DELIVERY_READINESS } from "./get-warehouse-delivery-readiness.port";
import { GET_CONTAINER_UNLOADING_READINESS } from "./get-container-unloading-readiness.port";
import { APPEND_CONTAINER_UNLOADING_REPORT } from "./append-container-unloading-report.port";
import { REPLACE_WAREHOUSE_DELIVERY_INSTRUCTION } from "./replace-warehouse-delivery-instruction.port";
import { PrismaInlandPlanRepository } from "./infrastructure/prisma-inland-plan.repository";
import { PrismaWarehouseDeliveryInstructionRepository } from "./infrastructure/prisma-warehouse-delivery-instruction.repository";
import { PrismaContainerUnloadingReportRepository } from "./infrastructure/prisma-container-unloading-report.repository";
import { InlandPlanController } from "./presentation/inland-plan.controller";
import { WarehouseDeliveryInstructionController } from "./presentation/warehouse-delivery-instruction.controller";
import { ContainerUnloadingReportController } from "./presentation/container-unloading-report.controller";

@Module({
  imports: [IdentityModule, ShipmentRegistryModule, ChargesSettlementModule],
  controllers: [
    InlandPlanController,
    WarehouseDeliveryInstructionController,
    ContainerUnloadingReportController,
  ],
  providers: [
    ReplacePlanningSetupService,
    DraftInlandPlanService,
    GetWarehouseDeliveryInstructionService,
    GetWarehouseDeliveryReadinessService,
    ReplaceWarehouseDeliveryInstructionService,
    AppendContainerUnloadingReportService,
    GetContainerUnloadingReportService,
    GetContainerUnloadingReadinessService,
    {
      provide: INLAND_PLAN_REPOSITORY,
      useClass: PrismaInlandPlanRepository,
    },
    {
      provide: WAREHOUSE_DELIVERY_INSTRUCTION_REPOSITORY,
      useClass: PrismaWarehouseDeliveryInstructionRepository,
    },
    {
      provide: CONTAINER_UNLOADING_REPORT_REPOSITORY,
      useClass: PrismaContainerUnloadingReportRepository,
    },
    {
      provide: GET_WAREHOUSE_DELIVERY_READINESS,
      useExisting: GetWarehouseDeliveryReadinessService,
    },
    {
      provide: REPLACE_WAREHOUSE_DELIVERY_INSTRUCTION,
      useExisting: ReplaceWarehouseDeliveryInstructionService,
    },
    {
      provide: APPEND_CONTAINER_UNLOADING_REPORT,
      useExisting: AppendContainerUnloadingReportService,
    },
    {
      provide: GET_CONTAINER_UNLOADING_READINESS,
      useExisting: GetContainerUnloadingReadinessService,
    },
  ],
  exports: [
    GET_WAREHOUSE_DELIVERY_READINESS,
    REPLACE_WAREHOUSE_DELIVERY_INSTRUCTION,
    APPEND_CONTAINER_UNLOADING_REPORT,
    GET_CONTAINER_UNLOADING_READINESS,
    GetWarehouseDeliveryInstructionService,
    GetContainerUnloadingReportService,
  ],
})
export class InlandFulfillmentModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(DevIdentityMiddleware)
      .forRoutes(
        InlandPlanController,
        WarehouseDeliveryInstructionController,
        ContainerUnloadingReportController,
      );
  }
}
