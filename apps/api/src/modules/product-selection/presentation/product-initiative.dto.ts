import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  ProductInitiativeDecisionCommandV1,
  ProductInitiativeReviewPointV1,
} from "@logix/contracts";

const REVIEW_POINT_CODES = [
  "target_user_and_market",
  "competitive_supply",
  "price_band_and_margin",
  "compliance_risk",
] as const;

const OUTCOMES = ["approve", "defer", "reject", "return_to_market"] as const;

export class ProductInitiativeReviewPointDto implements ProductInitiativeReviewPointV1 {
  @ApiProperty({ enum: REVIEW_POINT_CODES })
  code!: ProductInitiativeReviewPointV1["code"];
  @ApiProperty({ type: [String] })
  evidenceRefs!: string[];
  @ApiPropertyOptional({ nullable: true })
  conclusion?: string | null;
}

export class ProductInitiativeDecisionRequestDto implements ProductInitiativeDecisionCommandV1 {
  @ApiProperty({ enum: ["product-initiative-decision.v1"] })
  contractVersion!: "product-initiative-decision.v1";
  @ApiProperty() requestId!: string;
  @ApiProperty({ enum: OUTCOMES })
  outcome!: ProductInitiativeDecisionCommandV1["outcome"];
  @ApiProperty() expectedInitiativeVersion!: number;
  @ApiPropertyOptional() objective?: string;
  @ApiProperty({ type: [ProductInitiativeReviewPointDto] })
  reviewPoints!: ProductInitiativeReviewPointDto[];
  @ApiPropertyOptional() deferReason?: string;
  @ApiPropertyOptional() rejectReason?: string;
  @ApiPropertyOptional() returnReason?: string;
  @ApiProperty() idempotencyKey!: string;
}

export class ProductInitiativeResponseDto {
  @ApiProperty() initiativeId!: string;
  @ApiProperty({ enum: OUTCOMES }) outcome!: string;
  @ApiProperty({ enum: ["pending_completion", "completed"] })
  completion!: string;
  @ApiProperty({
    enum: [
      "needs_decision",
      "deferred",
      "rejected",
      "returned_to_market",
      "handed_off",
    ],
  })
  currentDestination!: string;
  @ApiProperty() responsibleActorId!: string;
  @ApiPropertyOptional({ nullable: true }) objective!: string | null;
  @ApiProperty({ type: [ProductInitiativeReviewPointDto] })
  reviewPoints!: ProductInitiativeReviewPointDto[];
  @ApiPropertyOptional({ nullable: true }) reason!: string | null;
  @ApiProperty({ type: [String] }) pendingFieldCodes!: string[];
  @ApiProperty() version!: number;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class ProductInitiativeDetailResponseDto {
  @ApiProperty() handoffId!: string;
  @ApiPropertyOptional({ type: ProductInitiativeResponseDto, nullable: true })
  initiative!: ProductInitiativeResponseDto | null;
  @ApiProperty({ type: [Object] }) evidenceCandidates!: object[];
}
