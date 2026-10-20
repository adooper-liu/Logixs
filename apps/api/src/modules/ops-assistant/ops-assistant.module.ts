import { randomUUID } from "node:crypto";
import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { AiGovernanceModule } from "../ai-governance";
import { IdentityModule, DevIdentityMiddleware } from "../identity";
import { LifecycleControlModule } from "../lifecycle-control";
import { NotificationModule } from "../notification";
import { ShipmentRegistryModule } from "../shipment-registry";
import { WorkExecutionModule } from "../work-execution";
import { BuildAssistantObjectContextService } from "./application/build-assistant-object-context.service";
import { OpenAssistantSessionService } from "./application/open-assistant-session.service";
import { PostAssistantMessageService } from "./application/post-assistant-message.service";
import {
  ConfirmTaskActionCandidateService,
  GenerateTaskActionCandidateService,
  GetTaskActionCandidateService,
  RejectTaskActionCandidateService,
  TASK_ACTION_TRACE_FACTORY,
} from "./application/task-action-candidate.services";
import { TASK_ACTION_CANDIDATE_REPOSITORY } from "./domain/task-action-candidate.repository";
import { PrismaTaskActionCandidateRepository } from "./infrastructure/prisma-task-action-candidate.repository";
import { OpsAssistantController } from "./presentation/ops-assistant.controller";
import { TaskActionCandidateController } from "./presentation/task-action-candidate.controller";

@Module({
  imports: [
    IdentityModule,
    NotificationModule,
    AiGovernanceModule,
    ShipmentRegistryModule,
    LifecycleControlModule,
    WorkExecutionModule,
  ],
  controllers: [OpsAssistantController, TaskActionCandidateController],
  providers: [
    BuildAssistantObjectContextService,
    OpenAssistantSessionService,
    PostAssistantMessageService,
    GenerateTaskActionCandidateService,
    GetTaskActionCandidateService,
    RejectTaskActionCandidateService,
    ConfirmTaskActionCandidateService,
    { provide: TASK_ACTION_TRACE_FACTORY, useValue: randomUUID },
    {
      provide: TASK_ACTION_CANDIDATE_REPOSITORY,
      useClass: PrismaTaskActionCandidateRepository,
    },
  ],
})
export class OpsAssistantModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(DevIdentityMiddleware)
      .forRoutes(OpsAssistantController, TaskActionCandidateController);
  }
}
