import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { CompleteWorkOrderService } from "../application/complete-work-order.service";
import { CreateNodeTaskService } from "../application/create-node-task.service";
import { GetNodeTaskService } from "../application/get-node-task.service";
import { ListNodeTasksService } from "../application/list-node-tasks.service";
import type { NodeTaskWithWorkOrders } from "../domain/work-execution.repository";
import {
  CompleteWorkOrderRequestDto,
  CompleteWorkOrderResponseDto,
  CreateNodeTaskRequestDto,
  NodeTaskDetailDto,
  NodeTaskPageDto,
} from "./work-execution.dto";

@ApiTags("work-execution")
@Controller()
export class WorkExecutionController {
  constructor(
    private readonly createNodeTask: CreateNodeTaskService,
    private readonly getNodeTask: GetNodeTaskService,
    private readonly listNodeTasks: ListNodeTasksService,
    private readonly completeWorkOrder: CompleteWorkOrderService,
  ) {}

  @Get("node-tasks")
  @ApiOkResponse({ type: NodeTaskPageDto })
  async list(
    @Req() request: { devIdentity: { tenantId: string } },
    @Query("containerId") containerId?: string,
    @Query("pageSize") pageSize?: string,
    @Query("cursor") cursor?: string,
  ): Promise<NodeTaskPageDto> {
    const page = await this.listNodeTasks.execute({
      containerId,
      tenantId: request.devIdentity.tenantId,
      pageSize,
      cursor,
    });
    return {
      items: page.items.map(toDetail),
      pageInfo: page.pageInfo,
      asOf: page.asOf.toISOString(),
      projectionVersion: page.projectionVersion,
    };
  }

  @Post("node-tasks")
  @ApiOkResponse({ type: NodeTaskDetailDto })
  async create(
    @Body() body: CreateNodeTaskRequestDto,
    @Req() request: { devIdentity: { tenantId: string } },
  ): Promise<NodeTaskDetailDto> {
    return toDetail(
      await this.createNodeTask.execute({
        flowInstanceId: body.flowInstanceId,
        nodeInstanceId: body.nodeInstanceId,
        nodeCode: body.nodeCode,
        containerId: body.containerId,
        tenantId: request.devIdentity.tenantId,
      }),
    );
  }

  @Get("node-tasks/:id")
  @ApiOkResponse({ type: NodeTaskDetailDto })
  async get(
    @Param("id") id: string,
    @Req() request: { devIdentity: { tenantId: string } },
  ): Promise<NodeTaskDetailDto> {
    const bundle = await this.getNodeTask.execute(
      id,
      request.devIdentity.tenantId,
    );
    if (!bundle) throw new NotFoundException("RESOURCE_NOT_FOUND");
    return toDetail(bundle);
  }

  @Post("work-orders/:id/complete")
  @ApiOkResponse({ type: CompleteWorkOrderResponseDto })
  complete(
    @Param("id") id: string,
    @Req() request: { devIdentity: { tenantId: string } },
    @Body() body?: CompleteWorkOrderRequestDto,
  ): Promise<CompleteWorkOrderResponseDto> {
    return this.completeWorkOrder.execute(
      id,
      request.devIdentity.tenantId,
      body?.evidenceRefs ?? [],
    );
  }
}

function toDetail(bundle: NodeTaskWithWorkOrders): NodeTaskDetailDto {
  return {
    id: bundle.task.id,
    flowInstanceId: bundle.task.flowInstanceId,
    nodeInstanceId: bundle.task.nodeInstanceId,
    nodeCode: bundle.task.nodeCode,
    containerId: bundle.task.containerId,
    taskDefinitionKey: bundle.task.taskDefinitionKey,
    state: bundle.task.state,
    workOrders: bundle.workOrders.map((workOrder) => ({
      id: workOrder.id,
      workOrderDefinitionKey: workOrder.workOrderDefinitionKey,
      state: workOrder.state,
      assignmentState: workOrder.assignmentState,
      completedAt: workOrder.completedAt
        ? workOrder.completedAt.toISOString()
        : null,
    })),
    outcome: bundle.outcome
      ? {
          id: bundle.outcome.id,
          previousState: bundle.outcome.previousState,
          nextState: bundle.outcome.nextState,
          resultPolicyMode: bundle.outcome.resultPolicyMode,
          eventCode: bundle.outcome.eventCode,
          requiredWorkOrderIds: bundle.outcome.requiredWorkOrderIds,
          completedWorkOrderIds: bundle.outcome.completedWorkOrderIds,
          evaluatedAt: bundle.outcome.evaluatedAt.toISOString(),
        }
      : null,
  };
}
