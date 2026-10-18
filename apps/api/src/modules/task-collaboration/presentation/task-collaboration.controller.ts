import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { TaskCollaborationPostCommandV1 } from "@logix/contracts";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { ListTaskCollaborationService } from "../application/list-task-collaboration.service";
import { PostTaskCollaborationService } from "../application/post-task-collaboration.service";

interface CollaborationRequest {
  identity: {
    tenantId: string;
    actorId: string;
    capabilities: string[];
  };
}

@ApiTags("task-collaboration")
@Controller()
export class TaskCollaborationController {
  constructor(
    private readonly listService: ListTaskCollaborationService,
    private readonly postService: PostTaskCollaborationService,
  ) {}

  @Get("node-tasks/:taskId/collaboration")
  @RequireCapabilities("task.read")
  @ApiOkResponse({ description: "Task-scoped collaboration page" })
  list(
    @Param("taskId") taskId: string,
    @Query("subjectKind") subjectKind: string | undefined,
    @Query("subjectId") subjectId: string | undefined,
    @Query("pageSize") pageSize: string | undefined,
    @Query("cursor") cursor: string | undefined,
    @Req() request: CollaborationRequest,
  ) {
    return this.listService.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      capabilities: request.identity.capabilities,
      taskId,
      subjectKind,
      subjectId,
      pageSize,
      cursor,
    });
  }

  @Post("node-tasks/:taskId/collaboration/messages")
  @RequireCapabilities("task.read", "task.collaborate")
  @ApiOkResponse({ description: "Task collaboration post result" })
  post(
    @Param("taskId") taskId: string,
    @Body() command: TaskCollaborationPostCommandV1,
    @Req() request: CollaborationRequest,
  ) {
    return this.postService.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      capabilities: request.identity.capabilities,
      taskId,
      command,
    });
  }
}
