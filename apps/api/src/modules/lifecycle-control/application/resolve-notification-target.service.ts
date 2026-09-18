import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  LIST_OBJECT_NOTIFICATIONS,
  type ListObjectNotificationsPort,
} from "../../notification";
import {
  LIST_OBJECT_TASK_ACTIVITY,
  type ListObjectTaskActivityPort,
} from "../../work-execution";
import {
  LIFECYCLE_REPOSITORY,
  type LifecycleRepository,
} from "../domain/lifecycle.repository";

export interface NotificationTarget {
  containerId: string;
  taskId: string | null;
  workOrderId: string | null;
  targetPath: string;
}

@Injectable()
export class ResolveNotificationTargetService {
  constructor(
    @Inject(LIFECYCLE_REPOSITORY)
    private readonly lifecycle: LifecycleRepository,
    @Inject(LIST_OBJECT_NOTIFICATIONS)
    private readonly notifications: ListObjectNotificationsPort,
    @Inject(LIST_OBJECT_TASK_ACTIVITY)
    private readonly taskActivity: ListObjectTaskActivityPort,
  ) {}

  async execute(input: {
    tenantId: string;
    notificationId: string;
    actorRoles: readonly string[];
    actorCapabilities: readonly string[];
  }): Promise<NotificationTarget> {
    const notification = await this.notifications.findVisible(input);
    if (!notification?.containerId) {
      throw new NotFoundException("RESOURCE_NOT_FOUND");
    }
    const container = await this.lifecycle.findContainerBase(
      notification.containerId,
    );
    if (!container || container.tenantId !== input.tenantId) {
      throw new NotFoundException("RESOURCE_NOT_FOUND");
    }
    if (!notification.taskId) {
      if (notification.workOrderId) {
        throw new NotFoundException("RESOURCE_NOT_FOUND");
      }
      return {
        containerId: notification.containerId,
        taskId: null,
        workOrderId: null,
        targetPath: `/container/${encodeURIComponent(notification.containerId)}`,
      };
    }
    if (!input.actorCapabilities.includes("task.read")) {
      throw new NotFoundException("RESOURCE_NOT_FOUND");
    }
    const target = await this.taskActivity.resolveTarget({
      tenantId: input.tenantId,
      containerId: notification.containerId,
      taskId: notification.taskId,
      workOrderId: notification.workOrderId,
    });
    if (!target) throw new NotFoundException("RESOURCE_NOT_FOUND");
    const query = new URLSearchParams({
      containerId: target.containerId,
      task: target.taskId,
    });
    return {
      ...target,
      targetPath: `/tasks?${query.toString()}`,
    };
  }
}
