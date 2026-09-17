import { Body, Controller, Param, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { OpenAssistantSessionService } from "../application/open-assistant-session.service";
import { PostAssistantMessageService } from "../application/post-assistant-message.service";
import {
  AssistantSessionResponseDto,
  OpenAssistantSessionRequestDto,
  PostAssistantMessageRequestDto,
} from "./notification.dto";

@ApiTags("ops-assistant")
@Controller("ops-assistant")
export class OpsAssistantController {
  constructor(
    private readonly openSession: OpenAssistantSessionService,
    private readonly postMessage: PostAssistantMessageService,
  ) {}

  @Post("sessions")
  @RequireCapabilities("notification.read")
  @ApiOkResponse({ type: AssistantSessionResponseDto })
  async open(
    @Body() body: OpenAssistantSessionRequestDto,
    @Req() request: { identity: { tenantId: string; actorId: string } },
  ): Promise<AssistantSessionResponseDto> {
    const result = await this.openSession.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      notificationId: body.notificationId ?? null,
    });
    return {
      sessionId: result.session.id,
      notificationId: result.session.notificationId,
      messages: result.messages.map((message) => ({
        id: message.id,
        role: message.role,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      })),
    };
  }

  @Post("sessions/:sessionId/messages")
  @RequireCapabilities("notification.read")
  @ApiOkResponse({ type: AssistantSessionResponseDto })
  async message(
    @Param("sessionId") sessionId: string,
    @Body() body: PostAssistantMessageRequestDto,
    @Req() request: { identity: { tenantId: string; actorId: string } },
  ): Promise<AssistantSessionResponseDto> {
    const messages = await this.postMessage.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      sessionId,
      body: body.body,
    });
    return {
      sessionId,
      notificationId: null,
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      })),
    };
  }
}
