import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  ProductInitiativeClaimCommandV1,
  ProductInitiativeBusinessCaseDimensionSnapshotV1,
  ProductInitiativeUnitEconomicsSnapshotV1,
  ProductInitiativeRiskAssessmentSnapshotV1,
} from "@logix/contracts";
import { ProductInitiativeReviewPointDto } from "./product-initiative.dto";

export class ProductInitiativeHandoffResponseDto {
  @ApiProperty({ enum: ["product_initiative_handoff.v1"] })
  contractVersion!: string;
  @ApiProperty() handoffId!: string;
  @ApiProperty() version!: number;
  @ApiProperty() initiativeId!: string;
  @ApiProperty() signalId!: string;
  @ApiPropertyOptional({ nullable: true }) marketCode!: string | null;
  @ApiPropertyOptional({ nullable: true }) userProblem!: string | null;
  @ApiProperty() objective!: string;
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
  @ApiPropertyOptional({ type: Object, nullable: true })
  unitEconomicsSnapshot!: ProductInitiativeUnitEconomicsSnapshotV1 | null;
  @ApiPropertyOptional({ nullable: true })
  negativeConservativeReason!: string | null;
  @ApiProperty({ type: [ProductInitiativeReviewPointDto] })
  reviewPoints!: ProductInitiativeReviewPointDto[];
  @ApiPropertyOptional({ type: [Object], nullable: true })
  businessCaseSnapshot?:
    ProductInitiativeBusinessCaseDimensionSnapshotV1[] | null;
  @ApiProperty({ type: [Object], nullable: true })
  riskAssessmentSnapshot!: ProductInitiativeRiskAssessmentSnapshotV1[] | null;
  @ApiProperty({ type: [String] }) evidenceRefs!: string[];
  @ApiProperty() createdAt!: string;
  @ApiProperty() idempotencyKey!: string;
}

export class ProductInitiativeNpiClaimResponseDto {
  @ApiProperty() claimId!: string;
  @ApiProperty() handoffId!: string;
  @ApiProperty() claimVersion!: number;
  @ApiProperty() productOwnerActorId!: string;
  @ApiProperty() claimedAt!: string;
}

export class ProductInitiativeNpiQueueEntryResponseDto {
  @ApiProperty({ type: ProductInitiativeHandoffResponseDto })
  handoff!: ProductInitiativeHandoffResponseDto;
  @ApiPropertyOptional({
    type: ProductInitiativeNpiClaimResponseDto,
    nullable: true,
    description: "为 null 表示这一票还没有人接。",
  })
  claim!: ProductInitiativeNpiClaimResponseDto | null;
  @ApiProperty() initiativeVersion!: number;
  @ApiProperty({
    enum: [
      "needs_decision",
      "deferred",
      "rejected",
      "returned_to_market",
      "handed_off",
      "returned_from_npi",
    ],
  })
  initiativeDestination!: string;
}

export class ProductInitiativeNpiQueuePageResponseDto {
  @ApiProperty({ enum: ["product-initiative-npi-queue.v1"] })
  contractVersion!: string;
  @ApiProperty({ type: [ProductInitiativeNpiQueueEntryResponseDto] })
  items!: ProductInitiativeNpiQueueEntryResponseDto[];
  @ApiProperty() pageSize!: number;
  @ApiPropertyOptional({ nullable: true }) nextCursor!: string | null;
}

export class ProductInitiativeClaimRequestDto implements ProductInitiativeClaimCommandV1 {
  @ApiProperty({ enum: ["product-initiative-claim.v1"] })
  contractVersion!: "product-initiative-claim.v1";
  @ApiProperty({
    description: "页面读到的领取版本；并发领取时后到的一笔会被拒绝。",
  })
  expectedClaimVersion!: number;
  @ApiProperty() idempotencyKey!: string;
}

export class ProductInitiativeNpiReturnRequestDto {
  @ApiProperty({ enum: ["product-initiative-npi-return.v1"] })
  contractVersion!: "product-initiative-npi-return.v1";
  @ApiProperty({
    description: "页面读到的立项版本；版本冲突时须重载后再退回。",
  })
  expectedInitiativeVersion!: number;
  @ApiProperty({ description: "退回选品理由；缺理由不得关闭。" })
  returnReason!: string;
  @ApiProperty() idempotencyKey!: string;
}
