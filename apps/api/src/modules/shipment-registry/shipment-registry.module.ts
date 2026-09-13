import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { IdentityModule, DevIdentityMiddleware } from "../identity";
import { ApplyContainerRecordService } from "./application/apply-container-record.service";
import { AssertContainerTenantService } from "./application/assert-container-tenant.service";
import { ASSERT_CONTAINER_TENANT } from "./assert-container-tenant.port";
import { ListContainersService } from "./application/list-containers.service";
import { CONTAINER_RECORD_WRITER } from "./domain/apply-container-record";
import { CONTAINER_REPOSITORY } from "./domain/container.repository";
import { PrismaContainerRecordWriter } from "./infrastructure/prisma-container-record-writer";
import { PrismaContainerRepository } from "./infrastructure/prisma-container.repository";
import { ContainersController } from "./presentation/containers.controller";

@Module({
  imports: [IdentityModule],
  controllers: [ContainersController],
  providers: [
    ListContainersService,
    ApplyContainerRecordService,
    AssertContainerTenantService,
    {
      provide: ASSERT_CONTAINER_TENANT,
      useExisting: AssertContainerTenantService,
    },
    { provide: CONTAINER_REPOSITORY, useClass: PrismaContainerRepository },
    { provide: CONTAINER_RECORD_WRITER, useClass: PrismaContainerRecordWriter },
  ],
  exports: [
    ListContainersService,
    ApplyContainerRecordService,
    AssertContainerTenantService,
    ASSERT_CONTAINER_TENANT,
  ],
})
export class ShipmentRegistryModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(DevIdentityMiddleware).forRoutes(ContainersController);
  }
}
