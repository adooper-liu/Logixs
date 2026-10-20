import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import {
  ConfirmTaskActionCandidateService,
  GenerateTaskActionCandidateService,
  GetTaskActionCandidateService,
  RejectTaskActionCandidateService,
} from "../application/task-action-candidate.services";
import {
  ConfirmTaskActionCandidateRequestDto,
  GenerateTaskActionCandidateRequestDto,
  RejectTaskActionCandidateRequestDto,
  TaskActionCandidateResponseDto,
  TaskActionConfirmResponseDto,
  TaskActionDecisionResponseDto,
} from "./task-action-candidate.dto";

interface TaskActionRequest {
  identity: {
    tenantId: string;
    actorId: string;
    capabilities: string[];
  };
}

@ApiTags("task-action-candidates")
@Controller("node-tasks")
export class TaskActionCandidateController {
  constructor(
    private readonly generateCandidate: GenerateTaskActionCandidateService,
    private readonly getCandidate: GetTaskActionCandidateService,
    private readonly rejectCandidate: RejectTaskActionCandidateService,
    private readonly confirmCandidate: ConfirmTaskActionCandidateService,
  ) {}

  @Post(":taskId/ai/action-candidates")
  @RequireCapabilities("task.read")
  @ApiOkResponse({ type: TaskActionCandidateResponseDto })
  generate(
    @Param("taskId") taskId: string,
    @Body() command: GenerateTaskActionCandidateRequestDto,
    @Req() request: TaskActionRequest,
  ) {
    return this.generateCandidate.execute({
      ...scope(request, taskId),
      command,
    });
  }

  @Get(":taskId/ai/action-candidates/:candidateId")
  @RequireCapabilities("task.read")
  @ApiOkResponse({ type: TaskActionCandidateResponseDto })
  get(
    @Param("taskId") taskId: string,
    @Param("candidateId") candidateId: string,
    @Req() request: TaskActionRequest,
  ) {
    return this.getCandidate.execute({
      ...scope(request, taskId),
      candidateId,
    });
  }

  @Post(":taskId/ai/action-candidates/:candidateId/rejections")
  @RequireCapabilities("task.read")
  @ApiOkResponse({ type: TaskActionDecisionResponseDto })
  reject(
    @Param("taskId") taskId: string,
    @Param("candidateId") candidateId: string,
    @Body() command: RejectTaskActionCandidateRequestDto,
    @Req() request: TaskActionRequest,
  ) {
    return this.rejectCandidate.execute({
      ...scope(request, taskId),
      candidateId,
      command,
    });
  }

  @Post(":taskId/ai/action-candidates/:candidateId/confirmations")
  @RequireCapabilities("task.read", "task.execute")
  @ApiOkResponse({ type: TaskActionConfirmResponseDto })
  confirm(
    @Param("taskId") taskId: string,
    @Param("candidateId") candidateId: string,
    @Body() command: ConfirmTaskActionCandidateRequestDto,
    @Req() request: TaskActionRequest,
  ) {
    return this.confirmCandidate.execute({
      ...scope(request, taskId),
      candidateId,
      command,
    });
  }
}

function scope(request: TaskActionRequest, taskId: string) {
  return {
    tenantId: request.identity.tenantId,
    actorId: request.identity.actorId,
    capabilities: request.identity.capabilities,
    taskId,
  };
}
