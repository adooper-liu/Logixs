import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class LifecycleLocationDto {
  @ApiProperty({
    enum: ["port", "terminal", "rail_yard", "warehouse", "depot", "in_transit"],
  })
  locationType!:
    "port" | "terminal" | "rail_yard" | "warehouse" | "depot" | "in_transit";
  @ApiPropertyOptional() unlocode?: string;
  @ApiPropertyOptional() locationId?: string;
  @ApiPropertyOptional() segmentId?: string;
  @ApiPropertyOptional() portCallId?: string;
  @ApiProperty() timezone!: string;
}

export class RecordLifecycleDateFactRequestDto {
  @ApiProperty() nodeCode!: string;
  @ApiProperty() eventCode!: string;
  @ApiProperty({ enum: ["planned", "estimated", "actual"] })
  timeKind!: "planned" | "estimated" | "actual";
  @ApiProperty({ description: "带时区的 ISO 8601 业务发生时间" })
  occurredAt!: string;
  @ApiProperty() rawValue!: string;
  @ApiProperty({ example: "+08:00" }) sourceUtcOffset!: string;
  @ApiProperty() authoritySystem!: string;
  @ApiPropertyOptional({ type: LifecycleLocationDto })
  location?: LifecycleLocationDto;
  @ApiProperty({ type: [String] }) evidenceRefs!: string[];
  @ApiProperty() reasonCode!: string;
  @ApiProperty() expectedVersion!: number;
  @ApiPropertyOptional() supersedesFactId?: string;
  @ApiProperty() idempotencyKey!: string;
}

export class RecordLifecycleDateFactResponseDto {
  @ApiProperty() factId!: string;
  @ApiProperty({ enum: ["recorded", "duplicate"] }) recordState!:
    "recorded" | "duplicate";
  @ApiProperty() applicationState!: string;
  @ApiProperty({ nullable: true }) reasonCode!: string | null;
  @ApiProperty({ nullable: true }) canonicalEventId!: string | null;
  @ApiProperty() projectionVersion!: number;
}

export class LifecycleDateFactItemDto {
  @ApiProperty() factId!: string;
  @ApiProperty() nodeCode!: string;
  @ApiProperty() eventCode!: string;
  @ApiProperty() timeKind!: string;
  @ApiProperty() occurredAt!: string;
  @ApiProperty() rawValue!: string;
  @ApiProperty() sourceUtcOffset!: string;
  @ApiProperty() ingestionChannel!: string;
  @ApiProperty() captureSource!: string;
  @ApiProperty() sourceSystem!: string;
  @ApiProperty() authoritySystem!: string;
  @ApiProperty() verificationState!: string;
  @ApiProperty() confidenceState!: string;
  @ApiProperty() validity!: string;
  @ApiProperty({ nullable: true }) authorityPolicyRef!: string | null;
  @ApiPropertyOptional({ type: LifecycleLocationDto, nullable: true })
  location!: LifecycleLocationDto | null;
  @ApiProperty({ type: [String] }) evidenceRefs!: string[];
  @ApiProperty() applicationState!: string;
  @ApiProperty({ nullable: true }) applicationReasonCode!: string | null;
  @ApiProperty({ nullable: true }) canonicalEventId!: string | null;
  @ApiProperty() projectionVersion!: number;
  @ApiProperty() recordedAt!: string;
}

export class LifecycleDateFactProjectionDto {
  @ApiProperty({ type: [LifecycleDateFactItemDto] })
  items!: LifecycleDateFactItemDto[];
  @ApiProperty() projectionVersion!: number;
  @ApiProperty() asOf!: string;
}

export class LifecycleDateFactReviewEvidenceDto {
  @ApiProperty() evidenceId!: string;
  @ApiProperty() evidenceType!: string;
  @ApiProperty() verificationState!: string;
  @ApiProperty() validity!: string;
  @ApiProperty() qualified!: boolean;
}

export class LifecycleDateFactReviewItemDto {
  @ApiProperty() factId!: string;
  @ApiProperty() containerId!: string;
  @ApiProperty() orderNumber!: string;
  @ApiProperty({ nullable: true }) containerNumber!: string | null;
  @ApiProperty() nodeCode!: string;
  @ApiProperty() eventCode!: string;
  @ApiProperty() occurredAt!: string;
  @ApiProperty() rawValue!: string;
  @ApiProperty() sourceUtcOffset!: string;
  @ApiProperty() captureSource!: string;
  @ApiProperty() sourceSystem!: string;
  @ApiProperty() authoritySystem!: string;
  @ApiPropertyOptional({ type: LifecycleLocationDto, nullable: true })
  location!: LifecycleLocationDto | null;
  @ApiProperty({ nullable: true }) submittedBy!: string | null;
  @ApiProperty() recordedAt!: string;
  @ApiProperty() projectionVersion!: number;
  @ApiProperty({ type: [LifecycleDateFactReviewEvidenceDto] })
  evidence!: LifecycleDateFactReviewEvidenceDto[];
  @ApiProperty({ type: [String] }) blockingReasons!: string[];
  @ApiProperty({ type: [String] }) allowedActions!: string[];
}

export class LifecycleDateFactReviewPageInfoDto {
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty() hasNextPage!: boolean;
  @ApiProperty() pageSize!: number;
}

export class LifecycleDateFactReviewPageDto {
  @ApiProperty({ type: [LifecycleDateFactReviewItemDto] })
  items!: LifecycleDateFactReviewItemDto[];
  @ApiProperty({ type: LifecycleDateFactReviewPageInfoDto })
  pageInfo!: LifecycleDateFactReviewPageInfoDto;
  @ApiProperty() asOf!: string;
}

export class ApproveLifecycleDateFactReviewRequestDto {
  @ApiProperty() reasonCode!: string;
  @ApiProperty() expectedVersion!: number;
  @ApiProperty() idempotencyKey!: string;
}
