import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { WorkSessionPageV1, WorkSessionV1 } from "@logix/contracts";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { ActivateWorkSessionService } from "../application/activate-work-session.service";
import { CloseWorkSessionService } from "../application/close-work-session.service";
import { ListWorkSessionsService } from "../application/list-work-sessions.service";
import { OpenWorkSessionService } from "../application/open-work-session.service";
import { UpdateWorkSessionService } from "../application/update-work-session.service";
import {
  WorkSessionActivateRequestDto,
  WorkSessionCloseRequestDto,
  WorkSessionOpenRequestDto,
  WorkSessionUpdateRequestDto,
} from "./work-session.dto";

export interface WorkSessionIdentityRequest {
  identity: { tenantId: string; actorId: string };
}

@ApiTags("work-sessions")
@Controller("work-sessions")
export class WorkSessionsController {
  constructor(
    private readonly listSessions: ListWorkSessionsService,
    private readonly openSession: OpenWorkSessionService,
    private readonly updateSession: UpdateWorkSessionService,
    private readonly activateSession: ActivateWorkSessionService,
    private readonly closeSession: CloseWorkSessionService,
  ) {}

  @Get()
  @RequireCapabilities("work_session.manage")
  list(
    @Req() request: WorkSessionIdentityRequest,
    @Query("pageSize") pageSize?: string,
    @Query("cursor") cursor?: string,
    @Query("includeClosed") includeClosed?: string,
  ): Promise<WorkSessionPageV1> {
    return this.listSessions.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      pageSize,
      cursor,
      includeClosed,
    });
  }

  @Post("open")
  @RequireCapabilities("work_session.manage")
  open(
    @Body() body: WorkSessionOpenRequestDto,
    @Req() request: WorkSessionIdentityRequest,
  ): Promise<WorkSessionV1> {
    return this.openSession.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      command: body,
    });
  }

  @Patch(":sessionId/pointer")
  @RequireCapabilities("work_session.manage")
  update(
    @Param("sessionId") sessionId: string,
    @Body() body: WorkSessionUpdateRequestDto,
    @Req() request: WorkSessionIdentityRequest,
  ): Promise<WorkSessionV1> {
    return this.updateSession.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      sessionId,
      command: body,
    });
  }

  @Post(":sessionId/activate")
  @RequireCapabilities("work_session.manage")
  activate(
    @Param("sessionId") sessionId: string,
    @Body() body: WorkSessionActivateRequestDto,
    @Req() request: WorkSessionIdentityRequest,
  ): Promise<WorkSessionV1> {
    return this.activateSession.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      targetSessionId: sessionId,
      command: body,
    });
  }

  @Post(":sessionId/close")
  @RequireCapabilities("work_session.manage")
  close(
    @Param("sessionId") sessionId: string,
    @Body() body: WorkSessionCloseRequestDto,
    @Req() request: WorkSessionIdentityRequest,
  ): Promise<WorkSessionV1> {
    return this.closeSession.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      sessionId,
      command: body,
    });
  }
}
