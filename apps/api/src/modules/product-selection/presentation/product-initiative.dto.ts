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

const DECISION_OUTCOMES = [
  "approve",
  "defer",
  "reject",
  "return_to_market",
] as const;
const RESPONSE_OUTCOMES = [...DECISION_OUTCOMES, "returned_from_npi"] as const;
const DESTINATIONS = [
  "needs_decision",
  "deferred",
  "rejected",
  "return_requested",
  "returned_to_market",
  "handed_off",
  "returned_from_npi",
] as const;

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
  @ApiProperty({ enum: DECISION_OUTCOMES })
  outcome!: ProductInitiativeDecisionCommandV1["outcome"];
  @ApiProperty() expectedInitiativeVersion!: number;
  @ApiPropertyOptional() objective?: string;
  @ApiProperty({ type: [ProductInitiativeReviewPointDto] })
  reviewPoints!: ProductInitiativeReviewPointDto[];
  @ApiPropertyOptional() deferReason?: string;
  @ApiPropertyOptional({ enum: [true] }) acceptResponsibility?: true;
  @ApiPropertyOptional() receivingTeamOrRole?: string;
  @ApiPropertyOptional() resourceDescription?: string;
  @ApiPropertyOptional({ format: "date" }) targetDate?: string;
  @ApiPropertyOptional({ format: "date" }) nextDecisionDate?: string;
  @ApiPropertyOptional() nextDecisionQuestion?: string;
  @ApiPropertyOptional() validationFocus?: string;
  @ApiPropertyOptional({ format: "date" }) reconsiderationDate?: string;
  @ApiPropertyOptional() rejectReason?: string;
  @ApiPropertyOptional() returnReason?: string;
  @ApiPropertyOptional({ enum: ["insufficient_evidence", "wrong_direction"] })
  returnBasis?: ProductInitiativeDecisionCommandV1["returnBasis"];
  @ApiProperty() idempotencyKey!: string;
}

export class ProductInitiativeResponseDto {
  @ApiProperty() initiativeId!: string;
  @ApiProperty({ enum: RESPONSE_OUTCOMES }) outcome!: string;
  @ApiProperty({ enum: ["pending_completion", "completed"] })
  completion!: string;
  @ApiProperty({ enum: DESTINATIONS })
  currentDestination!: string;
  @ApiProperty() responsibleActorId!: string;
  @ApiPropertyOptional({ nullable: true }) responsibilityAccepted!:
    boolean | null;
  @ApiPropertyOptional({ nullable: true }) receivingTeamOrRole!: string | null;
  @ApiPropertyOptional({ nullable: true }) resourceDescription!: string | null;
  @ApiPropertyOptional({ nullable: true, format: "date" }) targetDate!:
    string | null;
  @ApiPropertyOptional({ nullable: true, format: "date" }) nextDecisionDate!:
    string | null;
  @ApiPropertyOptional({ nullable: true }) nextDecisionQuestion!: string | null;
  @ApiPropertyOptional({ nullable: true }) validationFocus!: string | null;
  @ApiPropertyOptional({ nullable: true, format: "date" })
  reconsiderationDate!: string | null;
  @ApiPropertyOptional({ nullable: true }) objective!: string | null;
  @ApiProperty({ type: [ProductInitiativeReviewPointDto] })
  reviewPoints!: ProductInitiativeReviewPointDto[];
  @ApiPropertyOptional({ nullable: true }) reason!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    enum: ["insufficient_evidence", "wrong_direction"],
  })
  returnBasis!: string | null;
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

export class ProductInitiativeQueueEntryResponseDto {
  @ApiProperty() handoffId!: string;
  @ApiProperty({ enum: RESPONSE_OUTCOMES }) outcome!: string;
  @ApiProperty({ enum: DESTINATIONS }) currentDestination!: string;
  @ApiProperty({ enum: ["defer_reconsideration_due", "standard"] })
  queueGroup!: string;
  @ApiPropertyOptional({ nullable: true, format: "date" })
  reconsiderationDate!: string | null;
  @ApiProperty({ type: [String] }) pendingFieldCodes!: string[];
  @ApiProperty() updatedAt!: string;
}

export class ProductInitiativeQueuePageResponseDto {
  @ApiProperty({ enum: ["product-initiative-queue.v1"] })
  contractVersion!: string;
  @ApiProperty({ type: [ProductInitiativeQueueEntryResponseDto] })
  items!: ProductInitiativeQueueEntryResponseDto[];
  @ApiProperty() pageSize!: number;
  @ApiPropertyOptional({ nullable: true }) nextCursor!: string | null;
}
