import { Module } from "@nestjs/common";
import { ShipmentRegistryModule } from "../shipment-registry";
import { ApplyLifecycleEventService } from "./application/apply-lifecycle-event.service";
import { LIFECYCLE_REPOSITORY } from "./domain/lifecycle.repository";
import { PrismaLifecycleRepository } from "./infrastructure/prisma-lifecycle.repository";
import { LifecycleController } from "./presentation/lifecycle.controller";

@Module({
  imports: [ShipmentRegistryModule],
  controllers: [LifecycleController],
  providers: [
    ApplyLifecycleEventService,
    { provide: LIFECYCLE_REPOSITORY, useClass: PrismaLifecycleRepository },
  ],
})
export class LifecycleControlModule {}
