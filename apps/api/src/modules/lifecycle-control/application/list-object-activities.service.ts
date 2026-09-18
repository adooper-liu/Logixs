import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  LIST_OBJECT_NOTIFICATIONS,
  type ListObjectNotificationsPort,
} from "../../notification";
import {
  LIST_OBJECT_TASK_ACTIVITY,
  type ListObjectTaskActivityPort,
  type ObjectTaskActivityPageSource,
} from "../../work-execution";
import {
  decodeObjectActivityCursor,
  encodeObjectActivityCursor,
  mergeObjectActivities,
  parseObjectActivityPageSize,
  type ObjectActivityItem,
} from "../domain/object-activity-page";
import {
  LIFECYCLE_REPOSITORY,
  type LifecycleRepository,
} from "../domain/lifecycle.repository";

export interface ListObjectActivitiesInput {
  tenantId: string;
  containerId: string;
  actorRoles: readonly string[];
  actorCapabilities: readonly string[];
  pageSize?: string;
  cursor?: string;
}

export interface ObjectActivityPage {
  items: ObjectActivityItem[];
  nextActions: ObjectTaskActivityPageSource["nextActions"];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
    pageSize: number;
  };
  asOf: Date;
  projectionVersion: number;
}

@Injectable()
export class ListObjectActivitiesService {
  constructor(
    @Inject(LIFECYCLE_REPOSITORY)
    private readonly lifecycle: LifecycleRepository,
    @Inject(LIST_OBJECT_NOTIFICATIONS)
    private readonly notifications: ListObjectNotificationsPort,
    @Inject(LIST_OBJECT_TASK_ACTIVITY)
    private readonly taskActivity: ListObjectTaskActivityPort,
  ) {}

  async execute(input: ListObjectActivitiesInput): Promise<ObjectActivityPage> {
    const tenantId = input.tenantId.trim();
    const containerId = input.containerId.trim();
    if (!tenantId || !containerId)
      throw new NotFoundException("RESOURCE_NOT_FOUND");
    const container = await this.lifecycle.findContainerBase(containerId);
    if (!container || container.tenantId !== tenantId) {
      throw new NotFoundException("RESOURCE_NOT_FOUND");
    }

    let pageSize: number;
    let offset = 0;
    let asOf = new Date();
    try {
      pageSize = parseObjectActivityPageSize(input.pageSize);
      if (input.cursor) {
        const cursor = decodeObjectActivityCursor(input.cursor);
        if (
          cursor.tenantId !== tenantId ||
          cursor.containerId !== containerId
        ) {
          throw new Error("VALIDATION_FORMAT: cursor 与对象不匹配");
        }
        offset = cursor.offset;
        asOf = cursor.asOf;
      }
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "VALIDATION_FORMAT",
        HttpStatus.BAD_REQUEST,
      );
    }

    const take = offset + pageSize + 1;
    const canReadTasks = input.actorCapabilities.includes("task.read");
    const canReadNotifications =
      input.actorCapabilities.includes("notification.read");
    const [events, notificationRows, taskSource] = await Promise.all([
      this.lifecycle.listEvents({ containerId, atOrBefore: asOf, take }),
      canReadNotifications
        ? this.notifications.execute({
            tenantId,
            containerId,
            actorRoles: input.actorRoles,
            atOrBefore: asOf,
            take,
          })
        : Promise.resolve([]),
      canReadTasks
        ? this.taskActivity.execute({
            tenantId,
            containerId,
            atOrBefore: asOf,
            take,
          })
        : Promise.resolve({ activities: [], nextActions: [], targets: [] }),
    ]);

    const knownTaskIds = new Set(taskSource.targets.map((item) => item.taskId));
    const knownWorkOrderIds = new Set(
      taskSource.targets.flatMap((item) =>
        item.workOrderId ? [item.workOrderId] : [],
      ),
    );
    const merged = mergeObjectActivities([
      ...events.map<ObjectActivityItem>((event) => ({
        id: `lifecycle:${event.id}`,
        activityCode: "lifecycle_event_recorded",
        sourceType: "canonical_event",
        sourceId: event.id,
        occurredAt: event.occurredAt,
        recordedAt: event.recordedAt,
        containerId,
        taskId: null,
        workOrderId: null,
        actorId: null,
        nodeCode: null,
        title: event.eventCode,
        detail: null,
        severity: null,
        targetPath: containerPath(containerId),
      })),
      ...notificationRows.map<ObjectActivityItem>((notification) => ({
        id: `notification:${notification.id}`,
        activityCode: "problem_notification_posted",
        sourceType: "ops_notification",
        sourceId: notification.id,
        occurredAt: notification.occurredAt,
        recordedAt: notification.createdAt,
        containerId,
        taskId: notification.taskId,
        workOrderId: notification.workOrderId,
        actorId: null,
        nodeCode: null,
        title: notification.title,
        detail: notification.body,
        severity: notification.severity,
        targetPath: notificationTargetPath({
          containerId,
          taskId: notification.taskId,
          workOrderId: notification.workOrderId,
          knownTaskIds,
          knownWorkOrderIds,
        }),
      })),
      ...taskSource.activities.map<ObjectActivityItem>((item) => ({
        id: item.id,
        activityCode: item.activityCode,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        occurredAt: item.occurredAt,
        recordedAt: item.recordedAt,
        containerId,
        taskId: item.taskId,
        workOrderId: item.workOrderId,
        actorId: item.actorId,
        nodeCode: item.nodeCode,
        title: item.workOrderDefinitionKey ?? item.taskDefinitionKey,
        detail: null,
        severity: null,
        targetPath: taskPath(containerId, item.taskId),
      })),
    ]).filter((item) => (item.occurredAt ?? item.recordedAt) <= asOf);

    const window = merged.slice(offset, offset + pageSize + 1);
    const hasNextPage = window.length > pageSize;
    const items = hasNextPage ? window.slice(0, pageSize) : window;
    return {
      items,
      nextActions: taskSource.nextActions,
      pageInfo: {
        nextCursor: hasNextPage
          ? encodeObjectActivityCursor({
              tenantId,
              containerId,
              asOf,
              offset: offset + pageSize,
            })
          : null,
        hasNextPage,
        pageSize,
      },
      asOf,
      projectionVersion: 1,
    };
  }
}

function containerPath(containerId: string): string {
  return `/container/${encodeURIComponent(containerId)}`;
}

function taskPath(containerId: string, taskId: string): string {
  const query = new URLSearchParams({ containerId, task: taskId });
  return `/tasks?${query.toString()}`;
}

function notificationTargetPath(input: {
  containerId: string;
  taskId: string | null;
  workOrderId: string | null;
  knownTaskIds: ReadonlySet<string>;
  knownWorkOrderIds: ReadonlySet<string>;
}): string | null {
  if (!input.taskId) return containerPath(input.containerId);
  if (!input.knownTaskIds.has(input.taskId)) return null;
  if (input.workOrderId && !input.knownWorkOrderIds.has(input.workOrderId)) {
    return null;
  }
  return taskPath(input.containerId, input.taskId);
}
