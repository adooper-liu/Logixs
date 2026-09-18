import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { IdentityModule, DevIdentityMiddleware } from "../identity";
import { AssistantConversationService } from "./application/assistant-conversation.service";
import { ListNotificationsService } from "./application/list-notifications.service";
import { ListObjectNotificationsService } from "./application/list-object-notifications.service";
import { PostNotificationService } from "./application/post-notification.service";
import { NOTIFICATION_REPOSITORY } from "./domain/notification.repository";
import { PrismaNotificationRepository } from "./infrastructure/prisma-notification.repository";
import { POST_NOTIFICATION } from "./post-notification.port";
import { ASSISTANT_CONVERSATION } from "./assistant-conversation.port";
import { LIST_OBJECT_NOTIFICATIONS } from "./list-object-notifications.port";
import { NotificationsController } from "./presentation/notifications.controller";

@Module({
  imports: [IdentityModule],
  controllers: [NotificationsController],
  providers: [
    PostNotificationService,
    ListNotificationsService,
    ListObjectNotificationsService,
    AssistantConversationService,
    {
      provide: NOTIFICATION_REPOSITORY,
      useClass: PrismaNotificationRepository,
    },
    { provide: POST_NOTIFICATION, useExisting: PostNotificationService },
    {
      provide: LIST_OBJECT_NOTIFICATIONS,
      useExisting: ListObjectNotificationsService,
    },
    {
      provide: ASSISTANT_CONVERSATION,
      useExisting: AssistantConversationService,
    },
  ],
  exports: [
    POST_NOTIFICATION,
    PostNotificationService,
    LIST_OBJECT_NOTIFICATIONS,
    ListObjectNotificationsService,
    ASSISTANT_CONVERSATION,
    AssistantConversationService,
  ],
})
export class NotificationModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(DevIdentityMiddleware).forRoutes(NotificationsController);
  }
}
