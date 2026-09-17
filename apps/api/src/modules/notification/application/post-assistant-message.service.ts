import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AiGatewayService } from "../../ai-governance";
import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from "../domain/notification.repository";

@Injectable()
export class PostAssistantMessageService {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notifications: NotificationRepository,
    private readonly aiGateway: AiGatewayService,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    sessionId: string;
    body: string;
  }) {
    const text = input.body.trim();
    if (!text) throw new BadRequestException("MESSAGE_BODY_REQUIRED");

    const session = await this.notifications.findSession({
      tenantId: input.tenantId,
      actorId: input.actorId,
      id: input.sessionId,
    });
    if (!session) throw new NotFoundException("ASSISTANT_SESSION_NOT_FOUND");

    await this.notifications.addMessage({
      sessionId: session.id,
      role: "user",
      body: text,
    });

    const history = await this.notifications.listMessages(session.id);
    let notificationContext: string | null = null;
    if (session.notificationId) {
      const notification = await this.notifications.findNotification({
        tenantId: input.tenantId,
        id: session.notificationId,
      });
      if (notification) {
        notificationContext = `${notification.problemCode}: ${notification.title}. ${notification.body}`;
      }
    }

    const answer = await this.aiGateway.answerOpsQuestion({
      question: text,
      notificationContext,
      history: history.map((item) => ({
        role: item.role,
        body: item.body,
      })),
    });

    await this.notifications.addMessage({
      sessionId: session.id,
      role: "assistant",
      body: answer,
    });

    return this.notifications.listMessages(session.id);
  }
}
