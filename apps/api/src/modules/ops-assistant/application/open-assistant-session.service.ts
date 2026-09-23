import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AssistantSessionResponse } from "@logix/contracts";
import {
  ASSISTANT_CONVERSATION,
  type AssistantConversationPort,
  type AssistantVisibleNotification,
} from "../../notification";
import { BuildAssistantObjectContextService } from "./build-assistant-object-context.service";

@Injectable()
export class OpenAssistantSessionService {
  constructor(
    @Inject(ASSISTANT_CONVERSATION)
    private readonly conversations: AssistantConversationPort,
    private readonly objectContext: BuildAssistantObjectContextService,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    actorRoles: readonly string[];
    actorCapabilities: readonly string[];
    notificationId?: string;
    containerId?: string;
  }): Promise<AssistantSessionResponse> {
    const notificationId = optionalId(input.notificationId, "notificationId");
    const requestedContainerId = optionalId(input.containerId, "containerId");
    if (notificationId && requestedContainerId) {
      throw new BadRequestException("ASSISTANT_CONTEXT_AMBIGUOUS");
    }

    const notification = notificationId
      ? await this.findVisibleNotification({
          tenantId: input.tenantId,
          notificationId,
          actorRoles: input.actorRoles,
        })
      : null;
    const containerId = notification?.containerId ?? requestedContainerId;
    if (notification?.workOrderId && !notification.taskId) {
      throw new NotFoundException("RESOURCE_NOT_FOUND");
    }

    const context = containerId
      ? await this.objectContext.execute({
          tenantId: input.tenantId,
          containerId,
          actorCapabilities: input.actorCapabilities,
        })
      : null;
    if (notification?.containerId) {
      await this.objectContext.assertNotificationReference({
        tenantId: input.tenantId,
        containerId: notification.containerId,
        taskId: notification.taskId,
        workOrderId: notification.workOrderId,
      });
    }

    const session = await this.conversations.createSession({
      tenantId: input.tenantId,
      actorId: input.actorId,
      notificationId,
      containerId: containerId ?? null,
    });
    const seedBody = buildSeedBody(notification, context);
    if (seedBody) {
      await this.conversations.addMessage({
        sessionId: session.id,
        role: "system",
        body: seedBody,
      });
    }
    const messages = await this.conversations.listMessages(session.id);
    return {
      sessionId: session.id,
      notificationId: session.notificationId,
      containerId: session.containerId,
      objectContext: context,
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      })),
    };
  }

  private async findVisibleNotification(input: {
    tenantId: string;
    notificationId: string;
    actorRoles: readonly string[];
  }): Promise<AssistantVisibleNotification> {
    const notification =
      await this.conversations.findVisibleNotification(input);
    if (!notification) throw new NotFoundException("RESOURCE_NOT_FOUND");
    return notification;
  }
}

function optionalId(value: string | undefined, field: string): string | null {
  if (value === undefined) return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 100) {
    throw new BadRequestException(`VALIDATION_FORMAT: ${field}`);
  }
  return normalized;
}

function buildSeedBody(
  notification: AssistantVisibleNotification | null,
  context: AssistantSessionResponse["objectContext"],
): string | null {
  const lines = notification
    ? [
        `问题：${notification.title}`,
        notification.body,
        notification.conversationHint
          ? `提示：${notification.conversationHint}`
          : null,
      ]
    : context
      ? [
          `对象：货柜 ${context.summary.containerNumber ?? context.summary.orderNumber ?? context.summary.containerId}`,
          context.actionSummary,
        ]
      : [];
  return lines.filter(Boolean).join("\n") || null;
}
