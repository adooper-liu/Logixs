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
}

export class ApplyLifecycleEventResponseDto {
  @ApiProperty() containerId!: string;
  @ApiProperty() eventCode!: string;
  @ApiProperty({ type: [String] }) completedNodes!: string[];
  @ApiProperty({ nullable: true }) resultingStatus!: string | null;
}
