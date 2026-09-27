import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { ProductOpportunityIntakeCommandV1 } from "@logix/contracts";

export class ProductOpportunityIntakeRequestDto implements ProductOpportunityIntakeCommandV1 {
  @ApiProperty({ enum: ["product-opportunity-intake.v1"] })
  contractVersion!: "product-opportunity-intake.v1";
  @ApiProperty({ enum: ["claim", "accept"] })
  action!: "claim" | "accept";
  @ApiProperty() expectedIntakeVersion!: number;
  @ApiProperty() idempotencyKey!: string;
}

export class ProductOpportunityResponseDto {
  @ApiProperty({ type: Object }) handoff!: object;
  @ApiProperty({ enum: ["queued", "claimed", "accepted", "superseded"] })
  intakeState!: string;
  @ApiProperty() intakeVersion!: number;
  @ApiPropertyOptional({ nullable: true }) assignedActorId!: string | null;
}

export class ProductOpportunityPageResponseDto {
  @ApiProperty({ enum: ["product-opportunity-page.v1"] })
  contractVersion!: string;
  @ApiProperty({ type: [ProductOpportunityResponseDto] })
  items!: ProductOpportunityResponseDto[];
  @ApiProperty() pageSize!: number;
  @ApiPropertyOptional({ nullable: true }) nextCursor!: string | null;
}
