import { ApiProperty } from "@nestjs/swagger";

export class SetNodeApplicabilityRequestDto {
  @ApiProperty() nodeCode!: string;
  @ApiProperty({ enum: ["optional_applicable", "optional_not_applicable"] })
  applicability!: "optional_applicable" | "optional_not_applicable";
  @ApiProperty({ type: [String] }) evidenceRefs!: string[];
  @ApiProperty() reasonCode!: string;
  @ApiProperty() expectedVersion!: number;
  @ApiProperty() idempotencyKey!: string;
}

export class SetNodeApplicabilityResponseDto {
  @ApiProperty() flowInstanceId!: string;
  @ApiProperty() nodeCode!: string;
  @ApiProperty() applicability!: string;
  @ApiProperty() applied!: boolean;
  @ApiProperty() version!: number;
}

export class NodeBlockDto {
  @ApiProperty() blockId!: string;
  @ApiProperty() blockType!: string;
  @ApiProperty() sourceFactId!: string;
  @ApiProperty() occurredAt!: string;
  @ApiProperty() nodeInstanceId!: string;
}

export class BlockNodeRequestDto {
  @ApiProperty({ type: NodeBlockDto }) block!: NodeBlockDto;
  @ApiProperty() expectedVersion!: number;
  @ApiProperty() idempotencyKey!: string;
  @ApiProperty() traceId!: string;
}

export class BlockNodeResponseDto {
  @ApiProperty() blockId!: string;
  @ApiProperty() flowInstanceId!: string;
  @ApiProperty() nodeInstanceId!: string;
  @ApiProperty({ enum: ["active", "resolved"] })
  state!: "active" | "resolved";
  @ApiProperty() applied!: boolean;
  @ApiProperty() version!: number;
}

export class ResolveNodeBlockRequestDto {
  @ApiProperty() resolvedAt!: string;
  @ApiProperty() reasonCode!: string;
  @ApiProperty() expectedVersion!: number;
  @ApiProperty() idempotencyKey!: string;
  @ApiProperty() traceId!: string;
}

export class ResolveNodeBlockResponseDto {
  @ApiProperty() blockId!: string;
  @ApiProperty() flowInstanceId!: string;
  @ApiProperty() nodeInstanceId!: string;
  @ApiProperty() resolved!: true;
  @ApiProperty() nodeUnblocked!: boolean;
  @ApiProperty() applied!: boolean;
  @ApiProperty() version!: number;
}

export class LifecycleEventItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() containerId!: string;
  @ApiProperty() eventCode!: string;
  @ApiProperty() occurredAt!: string;
  @ApiProperty() recordedAt!: string;
  @ApiProperty({ type: [String] }) evidenceRefs!: string[];
}

export class LifecycleEventPageInfoDto {
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty() hasNextPage!: boolean;
  @ApiProperty() pageSize!: number;
}

export class LifecycleEventPageDto {
  @ApiProperty({ type: [LifecycleEventItemDto] })
  items!: LifecycleEventItemDto[];
  @ApiProperty({ type: LifecycleEventPageInfoDto })
  pageInfo!: LifecycleEventPageInfoDto;
  @ApiProperty() asOf!: string;
  @ApiProperty() projectionVersion!: number;
}

export class LifecycleNodeTimeTrackDto {
  @ApiProperty({ nullable: true }) plannedAt!: string | null;
  @ApiProperty({ nullable: true }) estimatedAt!: string | null;
  @ApiProperty({ nullable: true }) actualAt!: string | null;
}

export class LifecycleNodeItemDto {
  @ApiProperty() nodeInstanceId!: string;
  @ApiProperty() nodeCode!: string;
  @ApiProperty() sequence!: number;
  @ApiProperty() state!: string;
  @ApiProperty() applicability!: string;
  @ApiProperty({ nullable: true }) completedAt!: string | null;
  @ApiProperty({ type: [String] }) blockedReasonRefs!: string[];
  @ApiProperty() isCurrent!: boolean;
  @ApiProperty({
    type: LifecycleNodeTimeTrackDto,
    description: "节点完成摘要三轨；缺失或无法唯一判定时为 null",
  })
  times!: LifecycleNodeTimeTrackDto;
}

export class LifecycleFlowSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() state!: string;
  @ApiProperty() currentNodeCode!: string;
  @ApiProperty() version!: number;
}

export class LifecycleNodesPageDto {
  @ApiProperty({ type: LifecycleFlowSummaryDto, nullable: true })
  flow!: LifecycleFlowSummaryDto | null;
  @ApiProperty({ type: [LifecycleNodeItemDto] })
  nodes!: LifecycleNodeItemDto[];
  @ApiProperty() asOf!: string;
  @ApiProperty() projectionVersion!: number;
}

export class ContainerCurrentNodeItemDto {
  @ApiProperty() containerId!: string;
  @ApiProperty() currentNodeCode!: string;
  @ApiProperty() flowState!: string;
}

export class ContainerCurrentNodesPageDto {
  @ApiProperty({ type: [ContainerCurrentNodeItemDto] })
  items!: ContainerCurrentNodeItemDto[];
  @ApiProperty() asOf!: string;
  @ApiProperty() projectionVersion!: number;
}

export class ContainerLifecycleNodesItemDto {
  @ApiProperty() containerId!: string;
  @ApiProperty({ type: LifecycleFlowSummaryDto, nullable: true })
  flow!: LifecycleFlowSummaryDto | null;
  @ApiProperty({ type: [LifecycleNodeItemDto] })
  nodes!: LifecycleNodeItemDto[];
}

export class ContainerLifecycleNodesPageDto {
  @ApiProperty({ type: [ContainerLifecycleNodesItemDto] })
  items!: ContainerLifecycleNodesItemDto[];
  @ApiProperty() asOf!: string;
  @ApiProperty() projectionVersion!: number;
}
