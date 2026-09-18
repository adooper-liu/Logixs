import { Body, Controller, Param, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { AssistantSessionResponse } from "@logix/contracts";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { OpenAssistantSessionService } from "../application/open-assistant-session.service";
import { PostAssistantMessageService } from "../application/post-assistant-message.service";
import {
  AssistantSessionResponseDto,
  OpenAssistantSessionRequestDto,
  PostAssistantMessageRequestDto,
} from "./ops-assistant.dto";

interface OpsAssistantRequest {
  identity: {
    tenantId: string;
    actorId: string;
    roles: string[];
    capabilities: string[];
  };
}

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
  open(
    @Body() body: OpenAssistantSessionRequestDto,
    @Req() request: OpsAssistantRequest,
  ): Promise<AssistantSessionResponse> {
    return this.openSession.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      actorRoles: request.identity.roles,
      actorCapabilities: request.identity.capabilities,
      notificationId: body.notificationId,
      containerId: body.containerId,
    });
  }

  @Post("sessions/:sessionId/messages")
  @RequireCapabilities("notification.read")
  @ApiOkResponse({ type: AssistantSessionResponseDto })
  message(
    @Param("sessionId") sessionId: string,
    @Body() body: PostAssistantMessageRequestDto,
    @Req() request: OpsAssistantRequest,
  ): Promise<AssistantSessionResponse> {
    return this.postMessage.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      actorRoles: request.identity.roles,
      actorCapabilities: request.identity.capabilities,
      sessionId,
      body: body.body,
    });
  }
}
