import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { WorkflowService } from "./workflow.service";

@Controller("workflows")
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post("echo")
  startEcho(
    @Body() body: { message: string },
  ): Promise<{ workflowId: string }> {
    return this.workflowService.startEcho(body.message);
  }

  @Get(":id")
  getResult(@Param("id") id: string): Promise<unknown> {
    return this.workflowService.getResult(id);
  }
}
