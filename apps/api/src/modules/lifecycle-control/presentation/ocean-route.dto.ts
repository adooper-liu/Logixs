import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class OceanRouteSegmentRequestDto {
  @ApiProperty({ enum: ["vessel", "feeder", "barge"] })
  transportMode!: "vessel" | "feeder" | "barge";
  @ApiProperty({ example: "CNNGB" }) originUnlocode!: string;
  @ApiProperty({ example: "Asia/Shanghai" }) originTimezone!: string;
  @ApiProperty({ enum: ["port", "terminal"] })
  destinationLocationType!: "port" | "terminal";
  @ApiProperty({ example: "USLAX" }) destinationUnlocode!: string;
  @ApiPropertyOptional() destinationLocationId?: string;
  @ApiPropertyOptional() destinationPortCallId?: string;
  @ApiProperty({ example: "America/Los_Angeles" })
  destinationTimezone!: string;
}

export class ReplaceOceanRouteRequestDto {
  @ApiProperty({ type: [OceanRouteSegmentRequestDto] })
  segments!: OceanRouteSegmentRequestDto[];
  @ApiProperty({ type: [String] }) evidenceRefs!: string[];
  @ApiProperty() reasonCode!: string;
  @ApiProperty() expectedVersion!: number;
  @ApiProperty() idempotencyKey!: string;
}

export class OceanRouteSegmentResponseDto extends OceanRouteSegmentRequestDto {
  @ApiProperty() segmentId!: string;
  @ApiProperty() sequence!: number;
  @ApiProperty() isFinal!: boolean;
}

export class OceanRouteReplayResultDto {
  @ApiProperty() claimed!: number;
  @ApiProperty() applied!: number;
  @ApiProperty() pending!: number;
  @ApiProperty() rejected!: number;
}

export class ReplaceOceanRouteResponseDto {
  @ApiProperty() routePlanId!: string;
  @ApiProperty({ enum: ["recorded", "duplicate"] })
  recordState!: "recorded" | "duplicate";
  @ApiProperty() version!: number;
  @ApiProperty({ type: [OceanRouteSegmentResponseDto] })
  segments!: OceanRouteSegmentResponseDto[];
  @ApiProperty({ type: OceanRouteReplayResultDto })
  replay!: OceanRouteReplayResultDto;
}

export class OceanRouteProjectionDto {
  @ApiProperty() routePlanId!: string;
  @ApiProperty() version!: number;
  @ApiProperty() activatedAt!: string;
  @ApiProperty({ enum: ["api", "file_import", "manual_ui"] })
  ingestionChannel!: "api" | "file_import" | "manual_ui";
  @ApiProperty() sourceSystem!: string;
  @ApiProperty({ type: [String] }) evidenceRefs!: string[];
  @ApiPropertyOptional() actorId?: string;
  @ApiPropertyOptional() reasonCode?: string;
  @ApiProperty({ type: [OceanRouteSegmentResponseDto] })
  segments!: OceanRouteSegmentResponseDto[];
}
