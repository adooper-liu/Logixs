import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AssistantSessionResponse } from "@logix/contracts";
import { AiGatewayService } from "../../ai-governance";
import {
  ASSISTANT_CONVERSATION,
  type AssistantConversationPort,
} from "../../notification";
import { BuildAssistantObjectContextService } from "./build-assistant-object-context.service";

@Injectable()
export class PostAssistantMessageService {
  constructor(
    @Inject(ASSISTANT_CONVERSATION)
    private readonly conversations: AssistantConversationPort,
    private readonly aiGateway: AiGatewayService,
    private readonly objectContext: BuildAssistantObjectContextService,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    actorRoles: readonly string[];
    actorCapabilities: readonly string[];
    sessionId: string;
    body: string;
  }): Promise<AssistantSessionResponse> {
    const text = input.body.trim();
    if (!text || text.length > 4000) {
      throw new BadRequestException("VALIDATION_FORMAT: body");
    }
    const session = await this.conversations.findSession({
      tenantId: input.tenantId,
      actorId: input.actorId,
      sessionId: input.sessionId,
    });
    if (!session) throw new NotFoundException("ASSISTANT_SESSION_NOT_FOUND");

    const notification = session.notificationId
      ? await this.conversations.findVisibleNotification({
          tenantId: input.tenantId,
          notificationId: session.notificationId,
          actorRoles: input.actorRoles,
        })
      : null;
    if (session.notificationId && !notification) {
      throw new NotFoundException("ASSISTANT_SESSION_NOT_FOUND");
    }
    const context = session.containerId
      ? await this.objectContext.execute({
          tenantId: input.tenantId,
          containerId: session.containerId,
          actorCapabilities: input.actorCapabilities,
        })
      : null;

    await this.conversations.addMessage({
      sessionId: session.id,
      role: "user",
      body: text,
    });
    const history = await this.conversations.listMessages(session.id);
    const answer = await this.aiGateway.answerOpsQuestion({
      question: text,
      notificationContext: notification
        ? `${notification.problemCode}: ${notification.title}. ${notification.body}`
        : null,
      objectContext: context,
      history: history.map((item) => ({
        role: item.role,
        body: item.body,
      })),
    });
    await this.conversations.addMessage({
      sessionId: session.id,
      role: "assistant",
      body: answer,
    });
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
}
