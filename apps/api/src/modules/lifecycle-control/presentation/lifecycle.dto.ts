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

export class LifecycleNodeItemDto {
  @ApiProperty() nodeInstanceId!: string;
  @ApiProperty() nodeCode!: string;
  @ApiProperty() sequence!: number;
  @ApiProperty() state!: string;
  @ApiProperty() applicability!: string;
  @ApiProperty({ nullable: true }) completedAt!: string | null;
  @ApiProperty() isCurrent!: boolean;
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
