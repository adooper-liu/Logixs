import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { IdentityModule, DevIdentityMiddleware } from "../identity";
import { GetWorkbenchNetworkVolumeService } from "./application/get-workbench-network-volume.service";
import { PrismaWorkbenchNetworkVolumeRepository } from "./infrastructure/prisma-workbench-network-volume.repository";
import { WorkbenchNetworkVolumeController } from "./presentation/workbench-network-volume.controller";

@Module({
  imports: [IdentityModule],
  controllers: [WorkbenchNetworkVolumeController],
  providers: [
    GetWorkbenchNetworkVolumeService,
    PrismaWorkbenchNetworkVolumeRepository,
  ],
})
export class WorkbenchNetworkModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(DevIdentityMiddleware)
      .forRoutes(WorkbenchNetworkVolumeController);
  }
}
