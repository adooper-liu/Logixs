import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { EchoRequest } from "./echo-request.dto";
import { WorkflowService } from "./workflow.service";

@ApiTags("workflows")
@Controller("workflows")
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post("echo")
  startEcho(@Body() body: EchoRequest): Promise<{ workflowId: string }> {
    return this.workflowService.startEcho(body.message);
  }

  @Get(":id")
  getResult(@Param("id") id: string): Promise<unknown> {
    return this.workflowService.getResult(id);
  }
}
