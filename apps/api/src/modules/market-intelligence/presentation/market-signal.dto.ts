import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  MarketSignalCreateCommandV1,
  MarketSignalDecisionCommandV1,
  MarketSignalUpdateCommandV1,
} from "@logix/contracts";

export class MarketSignalCreateRequestDto implements MarketSignalCreateCommandV1 {
  @ApiProperty({ enum: ["market-signal-create.v1"] })
  contractVersion!: "market-signal-create.v1";
  @ApiProperty() requestId!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() marketCode?: string;
  @ApiPropertyOptional() channelCode?: string;
  @ApiPropertyOptional() categoryRef?: string;
  @ApiPropertyOptional() observedFactSummary?: string;
  @ApiPropertyOptional() hypothesis?: string;
  @ApiPropertyOptional({ type: [String] }) evidenceRefs?: string[];
  @ApiPropertyOptional() ownerTeamCode?: string;
  @ApiProperty() idempotencyKey!: string;
}

export class MarketSignalUpdateRequestDto implements MarketSignalUpdateCommandV1 {
  @ApiProperty({ enum: ["market-signal-update.v1"] })
  contractVersion!: "market-signal-update.v1";
  @ApiProperty() expectedSignalVersion!: number;
  @ApiPropertyOptional() marketCode?: string;
  @ApiPropertyOptional() channelCode?: string;
  @ApiPropertyOptional() categoryRef?: string;
  @ApiPropertyOptional() observedFactSummary?: string;
  @ApiPropertyOptional() hypothesis?: string;
  @ApiProperty() idempotencyKey!: string;
}

export class MarketSignalDecisionRequestDto implements MarketSignalDecisionCommandV1 {
  @ApiProperty({ enum: ["market-signal-decision.v1"] })
  contractVersion!: "market-signal-decision.v1";
  @ApiProperty() expectedSignalVersion!: number;
  @ApiProperty({ enum: ["watch", "handoff", "dismiss"] })
  decisionType!: MarketSignalDecisionCommandV1["decisionType"];
  @ApiPropertyOptional() judgmentNote?: string;
  @ApiPropertyOptional() opportunityStatement?: string;
  @ApiPropertyOptional() nextReviewDate?: string;
  @ApiPropertyOptional() watchFocus?: string;
  @ApiPropertyOptional() dismissReason?: string;
  @ApiProperty() idempotencyKey!: string;
}

export class MarketSignalResponseDto {
  @ApiProperty() signalId!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ nullable: true }) marketCode?: string | null;
  @ApiPropertyOptional({ nullable: true }) channelCode?: string | null;
  @ApiPropertyOptional({ nullable: true }) categoryRef?: string | null;
  @ApiPropertyOptional({ nullable: true }) observedFactSummary?: string | null;
  @ApiPropertyOptional({ nullable: true }) hypothesis?: string | null;
  @ApiProperty({ type: [String] }) evidenceRefs!: string[];
  @ApiProperty({
    enum: ["needs_decision", "watching", "handed_off", "dismissed"],
  })
  currentDestination!: string;
  @ApiProperty() ownerTeamCode!: string;
  @ApiProperty() version!: number;
  @ApiProperty({ type: [String] }) pendingFieldCodes!: string[];
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class MarketSignalPageResponseDto {
  @ApiProperty({ enum: ["market-signal-page.v1"] })
  contractVersion!: string;
  @ApiProperty({ type: [MarketSignalResponseDto] })
  items!: MarketSignalResponseDto[];
  @ApiProperty() pageSize!: number;
  @ApiPropertyOptional({ nullable: true }) nextCursor!: string | null;
}

export class MarketSignalEvidenceResponseDto {
  @ApiProperty() evidenceId!: string;
  @ApiProperty() sourceName!: string;
  @ApiProperty() summary!: string;
  @ApiProperty() contentRef!: string;
  @ApiProperty() recordedAt!: string;
  @ApiProperty({ enum: ["pending", "verified", "rejected", "revoked"] })
  verificationState!: string;
}

export class MarketSignalDetailResponseDto {
  @ApiProperty({ type: MarketSignalResponseDto })
  signal!: MarketSignalResponseDto;
  @ApiProperty({ type: [MarketSignalEvidenceResponseDto] })
  evidence!: MarketSignalEvidenceResponseDto[];
}

export class MarketSignalDecisionResponseDto {
  @ApiProperty({ enum: ["market-signal-decision-result.v1"] })
  contractVersion!: string;
  @ApiProperty({ enum: ["saved", "duplicate"] }) status!: string;
  @ApiProperty({ type: MarketSignalResponseDto })
  signal!: MarketSignalResponseDto;
  @ApiProperty() decisionId!: string;
  @ApiProperty() decisionVersion!: number;
  @ApiProperty({ enum: ["pending_completion", "completed"] })
  completion!: string;
  @ApiPropertyOptional({ nullable: true, type: Object }) handoff!:
    object | null;
}
