import { Module } from "@nestjs/common";
import { ApplyContainerRecordService } from "./application/apply-container-record.service";
import { ListContainersService } from "./application/list-containers.service";
import { CONTAINER_RECORD_WRITER } from "./domain/apply-container-record";
import { CONTAINER_REPOSITORY } from "./domain/container.repository";
import { PrismaContainerRecordWriter } from "./infrastructure/prisma-container-record-writer";
import { PrismaContainerRepository } from "./infrastructure/prisma-container.repository";
import { ContainersController } from "./presentation/containers.controller";

@Module({
  controllers: [ContainersController],
  providers: [
    ListContainersService,
    ApplyContainerRecordService,
    { provide: CONTAINER_REPOSITORY, useClass: PrismaContainerRepository },
    { provide: CONTAINER_RECORD_WRITER, useClass: PrismaContainerRecordWriter },
  ],
  exports: [ListContainersService, ApplyContainerRecordService],
})
export class ShipmentRegistryModule {}
