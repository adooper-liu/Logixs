import { Controller, Get, Param, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { ListObjectActivitiesService } from "../application/list-object-activities.service";
import { ResolveNotificationTargetService } from "../application/resolve-notification-target.service";
import {
  NotificationTargetDto,
  ObjectActivityPageDto,
  ObjectActivityQueryDto,
} from "./object-activity.dto";

interface ObjectActivityRequest {
  identity: {
    tenantId: string;
    roles: string[];
    capabilities: string[];
  };
}

@ApiTags("object-activity")
@Controller()
export class ObjectActivitiesController {
  constructor(
    private readonly listActivities: ListObjectActivitiesService,
    private readonly resolveNotificationTarget: ResolveNotificationTargetService,
  ) {}

  @Get("containers/:containerId/activities")
  @RequireCapabilities("container.read", "lifecycle.read")
  @ApiOkResponse({ type: ObjectActivityPageDto })
  async list(
    @Param("containerId") containerId: string,
    @Query() query: ObjectActivityQueryDto,
    @Req() request: ObjectActivityRequest,
  ): Promise<ObjectActivityPageDto> {
    const page = await this.listActivities.execute({
      tenantId: request.identity.tenantId,
      containerId,
      actorRoles: request.identity.roles,
      actorCapabilities: request.identity.capabilities,
      pageSize: query.pageSize,
      cursor: query.cursor,
    });
    return {
      items: page.items.map((item) => ({
        ...item,
        occurredAt: item.occurredAt?.toISOString() ?? null,
        recordedAt: item.recordedAt.toISOString(),
      })),
      nextActions: page.nextActions.map((action) => ({
        ...action,
        dueAt: action.dueAt?.toISOString() ?? null,
        targetPath: taskPath(action.containerId, action.taskId),
      })),
      pageInfo: page.pageInfo,
      asOf: page.asOf.toISOString(),
      projectionVersion: page.projectionVersion,
    };
  }

  @Get("notification-targets/:notificationId")
  @RequireCapabilities("notification.read", "container.read")
  @ApiOkResponse({ type: NotificationTargetDto })
  resolveTarget(
    @Param("notificationId") notificationId: string,
    @Req() request: ObjectActivityRequest,
  ): Promise<NotificationTargetDto> {
    return this.resolveNotificationTarget.execute({
      tenantId: request.identity.tenantId,
      notificationId,
      actorRoles: request.identity.roles,
      actorCapabilities: request.identity.capabilities,
    });
  }
}

function taskPath(containerId: string, taskId: string): string {
  const query = new URLSearchParams({ containerId, task: taskId });
  return `/tasks?${query.toString()}`;
}
