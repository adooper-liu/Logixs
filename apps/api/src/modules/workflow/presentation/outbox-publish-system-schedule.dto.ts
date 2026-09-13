import { ApiProperty } from "@nestjs/swagger";

export class EnsureOutboxPublishSystemScheduleRequestDto {
  @ApiProperty({ required: false, minimum: 5, maximum: 3600 })
  intervalSeconds?: number;
  @ApiProperty({ required: false, minimum: 1, maximum: 200 })
  limit?: number;
  @ApiProperty({ required: false, minimum: 1, maximum: 20 })
  maxRounds?: number;
  @ApiProperty({ required: false, minimum: 1, maximum: 100 })
  maxTenants?: number;
}

export class EnsureOutboxPublishSystemScheduleResponseDto {
  @ApiProperty() scheduleId!: string;
  @ApiProperty() workflowType!: string;
  @ApiProperty() intervalSeconds!: number;
  @ApiProperty() created!: boolean;
}
