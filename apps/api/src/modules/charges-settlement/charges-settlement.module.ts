import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { IdentityModule, DevIdentityMiddleware } from "../identity";
import { ComputeOverdueAccrualService } from "./application/compute-overdue-accrual.service";
import { ComputeOverdueDeadlinesService } from "./application/compute-overdue-deadlines.service";
import { ComputeStagedOverdueDeadlinesService } from "./application/compute-staged-overdue-deadlines.service";
import { COMPUTE_STAGED_OVERDUE_DEADLINES } from "./compute-staged-overdue-deadlines.port";
import { ReplaceOverdueStandardsService } from "./application/replace-overdue-standards.service";
import { COMPUTE_OVERDUE_ACCRUAL } from "./compute-overdue-accrual.port";
import { COMPUTE_OVERDUE_DEADLINES } from "./compute-overdue-deadlines.port";
import { OVERDUE_STANDARD_REPOSITORY } from "./domain/overdue-standard.repository";
import { PrismaOverdueStandardRepository } from "./infrastructure/prisma-overdue-standard.repository";
import { OverdueAccrualController } from "./presentation/overdue-accrual.controller";
import { OverdueDeadlinesController } from "./presentation/overdue-deadlines.controller";

@Module({
  imports: [IdentityModule],
  controllers: [OverdueDeadlinesController, OverdueAccrualController],
  providers: [
    ComputeStagedOverdueDeadlinesService,
    {
      provide: COMPUTE_STAGED_OVERDUE_DEADLINES,
      useExisting: ComputeStagedOverdueDeadlinesService,
    },
    ComputeOverdueDeadlinesService,
    ComputeOverdueAccrualService,
    ReplaceOverdueStandardsService,
    {
      provide: OVERDUE_STANDARD_REPOSITORY,
      useClass: PrismaOverdueStandardRepository,
    },
    {
      provide: COMPUTE_OVERDUE_DEADLINES,
      useExisting: ComputeOverdueDeadlinesService,
    },
    {
      provide: COMPUTE_OVERDUE_ACCRUAL,
      useExisting: ComputeOverdueAccrualService,
    },
  ],
  exports: [
    COMPUTE_STAGED_OVERDUE_DEADLINES,
    COMPUTE_OVERDUE_DEADLINES,
    COMPUTE_OVERDUE_ACCRUAL,
    ComputeOverdueDeadlinesService,
    ComputeOverdueAccrualService,
  ],
})
export class ChargesSettlementModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(DevIdentityMiddleware)
      .forRoutes(OverdueDeadlinesController, OverdueAccrualController);
  }
}
