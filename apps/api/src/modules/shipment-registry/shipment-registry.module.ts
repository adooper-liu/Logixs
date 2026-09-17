import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { IdentityModule, DevIdentityMiddleware } from "../identity";
import { ApplyContainerRecordService } from "./application/apply-container-record.service";
import { ApplyReplenishmentOrderImportService } from "./application/apply-replenishment-order-import.service";
import { AssertContainerTenantService } from "./application/assert-container-tenant.service";
import { ASSERT_CONTAINER_TENANT } from "./assert-container-tenant.port";
import { GetContainerService } from "./application/get-container.service";
import { ListContainersService } from "./application/list-containers.service";
import { CONTAINER_RECORD_WRITER } from "./domain/apply-container-record";
import { REPLENISHMENT_ORDER_IMPORT_WRITER } from "./domain/apply-replenishment-order-import";
import { CONTAINER_REPOSITORY } from "./domain/container.repository";
import { PrismaContainerRecordWriter } from "./infrastructure/prisma-container-record-writer";
import { PrismaReplenishmentOrderImportWriter } from "./infrastructure/prisma-replenishment-order-import-writer";
import { PrismaContainerRepository } from "./infrastructure/prisma-container.repository";
import { ContainersController } from "./presentation/containers.controller";

@Module({
  imports: [IdentityModule],
  controllers: [ContainersController],
  providers: [
    ListContainersService,
    GetContainerService,
    ApplyContainerRecordService,
    ApplyReplenishmentOrderImportService,
    AssertContainerTenantService,
    {
      provide: ASSERT_CONTAINER_TENANT,
      useExisting: AssertContainerTenantService,
    },
    { provide: CONTAINER_REPOSITORY, useClass: PrismaContainerRepository },
    { provide: CONTAINER_RECORD_WRITER, useClass: PrismaContainerRecordWriter },
    {
      provide: REPLENISHMENT_ORDER_IMPORT_WRITER,
      useClass: PrismaReplenishmentOrderImportWriter,
    },
  ],
  exports: [
    ListContainersService,
    ApplyContainerRecordService,
    ApplyReplenishmentOrderImportService,
    AssertContainerTenantService,
    ASSERT_CONTAINER_TENANT,
  ],
})
export class ShipmentRegistryModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(DevIdentityMiddleware).forRoutes(ContainersController);
  }
}
