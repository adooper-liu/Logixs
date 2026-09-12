import { Module } from "@nestjs/common";
import { ListContainersService } from "./application/list-containers.service";
import { CONTAINER_REPOSITORY } from "./domain/container.repository";
import { PrismaContainerRepository } from "./infrastructure/prisma-container.repository";
import { ContainersController } from "./presentation/containers.controller";

@Module({
  controllers: [ContainersController],
  providers: [
    ListContainersService,
    { provide: CONTAINER_REPOSITORY, useClass: PrismaContainerRepository },
  ],
  exports: [ListContainersService],
})
export class ShipmentRegistryModule {}
