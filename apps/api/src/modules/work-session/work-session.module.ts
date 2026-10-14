import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { IdentityModule, DevIdentityMiddleware } from "../identity";
import { ActivateWorkSessionService } from "./application/activate-work-session.service";
import { CloseWorkSessionService } from "./application/close-work-session.service";
import { ListWorkSessionsService } from "./application/list-work-sessions.service";
import { OpenWorkSessionService } from "./application/open-work-session.service";
import { UpdateWorkSessionService } from "./application/update-work-session.service";
import { WORK_SESSION_REPOSITORY } from "./domain/work-session.repository";
import { PrismaWorkSessionRepository } from "./infrastructure/prisma-work-session.repository";
import { WorkSessionsController } from "./presentation/work-sessions.controller";

@Module({
  imports: [IdentityModule],
  controllers: [WorkSessionsController],
  providers: [
    ListWorkSessionsService,
    OpenWorkSessionService,
    UpdateWorkSessionService,
    ActivateWorkSessionService,
    CloseWorkSessionService,
    { provide: WORK_SESSION_REPOSITORY, useClass: PrismaWorkSessionRepository },
  ],
})
export class WorkSessionModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(DevIdentityMiddleware).forRoutes(WorkSessionsController);
  }
}
