import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { ProductInitiativeClaimCommandV1 } from "@logix/contracts";
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
  @ApiProperty({ type: [ProductInitiativeReviewPointDto] })
  reviewPoints!: ProductInitiativeReviewPointDto[];
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
