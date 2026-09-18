import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from "../domain/notification.repository";
import type {
  PostNotificationInput,
  PostNotificationPort,
} from "../post-notification.port";

@Injectable()
export class PostNotificationService implements PostNotificationPort {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notifications: NotificationRepository,
  ) {}

  execute(input: PostNotificationInput) {
    const containerId = parseOptionalRef(input.containerId, "containerId");
    const taskId = parseOptionalRef(input.taskId, "taskId");
    const workOrderId = parseOptionalRef(input.workOrderId, "workOrderId");
    if (taskId && !containerId) {
      throw new BadRequestException(
        "VALIDATION_FORMAT: taskId 必须同时携带 containerId",
      );
    }
    if (workOrderId && (!taskId || !containerId)) {
      throw new BadRequestException(
        "VALIDATION_FORMAT: workOrderId 必须同时携带 taskId 和 containerId",
      );
    }
    if (Number.isNaN(input.occurredAt.getTime())) {
      throw new BadRequestException("VALIDATION_FORMAT: occurredAt 无效");
    }
    return this.notifications.createNotification({
      ...input,
      containerId,
      taskId,
      workOrderId,
      conversationHint: input.conversationHint ?? null,
    });
  }
}

function parseOptionalRef(
  raw: string | null | undefined,
  field: string,
): string | null {
  if (raw === undefined || raw === null) return null;
  const value = raw.trim();
  if (!value || value.length > 128) {
    throw new BadRequestException(`VALIDATION_FORMAT: ${field} 无效`);
  }
  return value;
}
