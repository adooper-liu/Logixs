import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { AiGovernanceModule } from "../ai-governance";
import { IdentityModule, DevIdentityMiddleware } from "../identity";
import { ListNotificationsService } from "./application/list-notifications.service";
import { ListObjectNotificationsService } from "./application/list-object-notifications.service";
import { OpenAssistantSessionService } from "./application/open-assistant-session.service";
import { PostAssistantMessageService } from "./application/post-assistant-message.service";
import { PostNotificationService } from "./application/post-notification.service";
import { NOTIFICATION_REPOSITORY } from "./domain/notification.repository";
import { PrismaNotificationRepository } from "./infrastructure/prisma-notification.repository";
import { POST_NOTIFICATION } from "./post-notification.port";
import { LIST_OBJECT_NOTIFICATIONS } from "./list-object-notifications.port";
import { NotificationsController } from "./presentation/notifications.controller";
import { OpsAssistantController } from "./presentation/ops-assistant.controller";

@Module({
  imports: [IdentityModule, AiGovernanceModule],
  controllers: [NotificationsController, OpsAssistantController],
  providers: [
    PostNotificationService,
    ListNotificationsService,
    ListObjectNotificationsService,
    OpenAssistantSessionService,
    PostAssistantMessageService,
    {
      provide: NOTIFICATION_REPOSITORY,
      useClass: PrismaNotificationRepository,
    },
    { provide: POST_NOTIFICATION, useExisting: PostNotificationService },
    {
      provide: LIST_OBJECT_NOTIFICATIONS,
      useExisting: ListObjectNotificationsService,
    },
  ],
  exports: [
    POST_NOTIFICATION,
    PostNotificationService,
    LIST_OBJECT_NOTIFICATIONS,
    ListObjectNotificationsService,
  ],
})
export class NotificationModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(DevIdentityMiddleware)
      .forRoutes(NotificationsController, OpsAssistantController);
  }
}
