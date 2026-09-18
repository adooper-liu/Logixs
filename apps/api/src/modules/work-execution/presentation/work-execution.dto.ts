import { ApiProperty } from "@nestjs/swagger";

export class CreateNodeTaskRequestDto {
  @ApiProperty() flowInstanceId!: string;
  @ApiProperty() nodeInstanceId!: string;
  @ApiProperty({ description: "LifecycleNodeCode" })
  nodeCode!: string;
  @ApiProperty({ required: false })
  containerId?: string;
}

export class WorkOrderDto {
  @ApiProperty() id!: string;
  @ApiProperty() workOrderDefinitionKey!: string;
  @ApiProperty() state!: string;
  @ApiProperty() assignmentState!: string;
  @ApiProperty({ nullable: true }) assigneeId!: string | null;
  @ApiProperty({ nullable: true }) dueAt!: string | null;
  @ApiProperty({ nullable: true }) completedAt!: string | null;
}

export class NodeTaskNextActionDto {
  @ApiProperty() actionCode!: string;
  @ApiProperty() workOrderId!: string;
  @ApiProperty() workOrderDefinitionKey!: string;
  @ApiProperty() assignmentState!: string;
  @ApiProperty({ nullable: true }) assigneeId!: string | null;
  @ApiProperty({ nullable: true }) dueAt!: string | null;
}

export class NodeTaskOutcomeDto {
  @ApiProperty() id!: string;
  @ApiProperty() previousState!: string;
  @ApiProperty() nextState!: string;
  @ApiProperty() resultPolicyMode!: string;
  @ApiProperty({ nullable: true }) eventCode!: string | null;
  @ApiProperty({ type: [String] }) requiredWorkOrderIds!: string[];
  @ApiProperty({ type: [String] }) completedWorkOrderIds!: string[];
  @ApiProperty() evaluatedAt!: string;
}

export class NodeTaskDetailDto {
  @ApiProperty() id!: string;
  @ApiProperty() flowInstanceId!: string;
  @ApiProperty() nodeInstanceId!: string;
  @ApiProperty() nodeCode!: string;
  @ApiProperty({ nullable: true }) containerId!: string | null;
  @ApiProperty() taskDefinitionKey!: string;
  @ApiProperty() state!: string;
  @ApiProperty() applicability!: string;
  @ApiProperty() readinessState!: string;
  @ApiProperty() completionEligibility!: string;
  @ApiProperty({ type: [String] }) conditionFactRefs!: string[];
  @ApiProperty({ type: [WorkOrderDto] }) workOrders!: WorkOrderDto[];
  @ApiProperty({ type: NodeTaskNextActionDto, nullable: true })
  nextAction!: NodeTaskNextActionDto | null;
  @ApiProperty({ type: NodeTaskOutcomeDto, nullable: true })
  outcome!: NodeTaskOutcomeDto | null;
}

export class PageInfoDto {
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty() hasNextPage!: boolean;
  @ApiProperty() pageSize!: number;
}

export class NodeTaskPageDto {
  @ApiProperty({ type: [NodeTaskDetailDto] }) items!: NodeTaskDetailDto[];
  @ApiProperty({ type: PageInfoDto }) pageInfo!: PageInfoDto;
  @ApiProperty() asOf!: string;
  @ApiProperty() projectionVersion!: number;
}

export class ClaimWorkOrderRequestDto {
  @ApiProperty({ required: false })
  idempotencyKey?: string;
}

export class ClaimWorkOrderResponseDto {
  @ApiProperty() workOrderId!: string;
  @ApiProperty() workOrderState!: string;
  @ApiProperty() assignmentState!: string;
  @ApiProperty({ nullable: true }) assigneeId!: string | null;
  @ApiProperty() taskId!: string;
  @ApiProperty() taskState!: string;
  @ApiProperty() applied!: boolean;
  @ApiProperty() clientOperationId!: string;
  @ApiProperty() receptionState!: string;
  @ApiProperty() businessDecisionState!: string;
  @ApiProperty() commitState!: string;
  @ApiProperty({ nullable: true }) rejectionReasonCode!: string | null;
}

export class CompleteWorkOrderRequestDto {
  @ApiProperty({ type: [String], required: false })
  evidenceRefs?: string[];
  @ApiProperty({ required: false })
  idempotencyKey?: string;
}

export class CompleteWorkOrderResponseDto {
  @ApiProperty() workOrderId!: string;
  @ApiProperty() workOrderState!: string;
  @ApiProperty() taskId!: string;
  @ApiProperty() taskState!: string;
  @ApiProperty() applied!: boolean;
  @ApiProperty() outcomeRecorded!: boolean;
  @ApiProperty() lifecycleApply!: string;
  @ApiProperty({ nullable: true }) lifecycleEventCode!: string | null;
  @ApiProperty({ nullable: true }) lifecycleDetail!: string | null;
  @ApiProperty({ nullable: true }) activatedNodeCode!: string | null;
  @ApiProperty({ nullable: true }) activatedNodeTaskId!: string | null;
  @ApiProperty() clientOperationId!: string;
  @ApiProperty() receptionState!: string;
  @ApiProperty() businessDecisionState!: string;
  @ApiProperty() commitState!: string;
  @ApiProperty({ nullable: true }) rejectionReasonCode!: string | null;
}
