import { ApiProperty } from "@nestjs/swagger";

export class ApplyLifecycleEventRequestDto {
  @ApiProperty({
    description: "规范事件码（CanonicalEventCode，如 loaded/arrived）",
  })
  eventCode!: string;

  @ApiProperty({ description: "发生时间（ISO 8601 UTC）" })
  occurredAt!: string;

  @ApiProperty({ description: "幂等键（同键重复提交不重复应用）" })
  idempotencyKey!: string;

  @ApiProperty({ type: [String], description: "合格证据 ID" })
  evidenceRefs!: string[];
}

export class ApplyLifecycleEventResponseDto {
  @ApiProperty() containerId!: string;
  @ApiProperty() eventCode!: string;
  @ApiProperty({ type: [String] }) completedNodes!: string[];
  @ApiProperty({ nullable: true }) resultingStatus!: string | null;
  @ApiProperty({ nullable: true }) activatedNodeCode!: string | null;
  @ApiProperty({ nullable: true }) activatedNodeTaskId!: string | null;
}

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
