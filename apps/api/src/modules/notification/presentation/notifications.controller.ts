import { Controller, Get, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { ListNotificationsService } from "../application/list-notifications.service";
import {
  ListNotificationsQueryDto,
  NotificationListDto,
} from "./notification.dto";

@ApiTags("notification")
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly listNotifications: ListNotificationsService) {}

  @Get()
  @RequireCapabilities("notification.read")
  @ApiOkResponse({ type: NotificationListDto })
  async list(
    @Query() query: ListNotificationsQueryDto,
    @Req()
    request: {
      identity: { tenantId: string; actorId: string; roles: string[] };
    },
  ): Promise<NotificationListDto> {
    const items = await this.listNotifications.execute({
      tenantId: request.identity.tenantId,
      actorRoles: request.identity.roles,
      limit: query.limit,
    });
    return {
      items: items.map((item) => ({
        id: item.id,
        problemCode: item.problemCode,
        severity: item.severity,
        title: item.title,
        body: item.body,
        entityType: item.entityType,
        entityId: item.entityId,
        recipientRoleCodes: item.recipientRoleCodes,
        conversationHint: item.conversationHint,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }
}
