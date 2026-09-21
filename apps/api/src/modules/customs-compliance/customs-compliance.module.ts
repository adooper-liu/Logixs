import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { IdentityModule, DevIdentityMiddleware } from "../identity";
import { ShipmentRegistryModule } from "../shipment-registry";
import { GetCustomsClearanceCaseService } from "./application/get-customs-clearance-case.service";
import { GetCustomsClearanceReadinessService } from "./application/get-customs-clearance-readiness.service";
import { ReplaceCustomsClearanceCaseService } from "./application/replace-customs-clearance-case.service";
import { CUSTOMS_CLEARANCE_CASE_REPOSITORY } from "./domain/customs-clearance-case.repository";
import { GET_CUSTOMS_CLEARANCE_READINESS } from "./get-customs-clearance-readiness.port";
import { PrismaCustomsClearanceCaseRepository } from "./infrastructure/prisma-customs-clearance-case.repository";
import { CustomsClearanceCaseController } from "./presentation/customs-clearance-case.controller";
import { REPLACE_CUSTOMS_CLEARANCE_CASE } from "./replace-customs-clearance-case.port";

@Module({
  imports: [IdentityModule, ShipmentRegistryModule],
  controllers: [CustomsClearanceCaseController],
  providers: [
    GetCustomsClearanceCaseService,
    GetCustomsClearanceReadinessService,
    ReplaceCustomsClearanceCaseService,
    {
      provide: CUSTOMS_CLEARANCE_CASE_REPOSITORY,
      useClass: PrismaCustomsClearanceCaseRepository,
    },
    {
      provide: GET_CUSTOMS_CLEARANCE_READINESS,
      useExisting: GetCustomsClearanceReadinessService,
    },
    {
      provide: REPLACE_CUSTOMS_CLEARANCE_CASE,
      useExisting: ReplaceCustomsClearanceCaseService,
    },
  ],
  exports: [
    GET_CUSTOMS_CLEARANCE_READINESS,
    REPLACE_CUSTOMS_CLEARANCE_CASE,
    GetCustomsClearanceCaseService,
  ],
})
export class CustomsComplianceModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(DevIdentityMiddleware)
      .forRoutes(CustomsClearanceCaseController);
  }
}
