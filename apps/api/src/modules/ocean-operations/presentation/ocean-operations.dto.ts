import { ApiProperty } from "@nestjs/swagger";

export class OceanOperationsQueueItemDto {
  @ApiProperty() containerId!: string;
  @ApiProperty({ nullable: true }) containerNumber!: string | null;
  @ApiProperty({ nullable: true }) shipmentNumber!: string | null;
  @ApiProperty() status!: string;
  @ApiProperty() observationCount!: number;
  @ApiProperty() conflictCount!: number;
  @ApiProperty({ nullable: true }) reviewDecision!: string | null;
  @ApiProperty() updatedAt!: string;
}

export class OceanOperationsQueueDto {
  @ApiProperty({ type: [OceanOperationsQueueItemDto] })
  items!: OceanOperationsQueueItemDto[];
}

export class OceanOperationsSourceReviewRequestDto {
  @ApiProperty() sourceObservationId!: string;
  @ApiProperty({
    enum: [
      "review_required",
      "adopt_observation_for_review",
      "reject_observation",
    ],
  })
  reviewDecision!:
    "review_required" | "adopt_observation_for_review" | "reject_observation";
  @ApiProperty({ minLength: 1, maxLength: 1000 }) reason!: string;
  @ApiProperty({ minimum: 0 }) expectedVersion!: number;
  @ApiProperty({ minLength: 1, maxLength: 200 }) idempotencyKey!: string;
  @ApiProperty({
    enum: [
      "usable_for_customs_preparation",
      "pending_evidence",
      "not_suitable_for_customs_preparation",
    ],
  })
  arrivalPreparationResult!:
    | "usable_for_customs_preparation"
    | "pending_evidence"
    | "not_suitable_for_customs_preparation";
  @ApiProperty({ minLength: 1, maxLength: 1000 }) nextStep!: string;
  @ApiProperty({ minimum: 0 }) expectedArrivalPreparationVersion!: number;
}

export class OceanOperationsSourceReviewResponseDto {
  @ApiProperty({ enum: ["recorded", "duplicate"] }) recordState!:
    "recorded" | "duplicate";
  @ApiProperty() review!: unknown;
}
