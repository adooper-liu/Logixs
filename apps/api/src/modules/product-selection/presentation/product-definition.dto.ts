import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  ProductDefinitionReleaseCommandV1,
  ProductDefinitionWriteCommandV1,
} from "@logix/contracts";

const STAGES = ["evt", "dvt", "pvt", "mp"] as const;
const RELEASE_STATES = [
  "in_progress",
  "released",
  "deferred",
  "terminated",
] as const;
const DECISIONS = ["release", "defer", "terminate"] as const;

export class NpiStageOutcomeResponseDto {
  @ApiProperty({ enum: STAGES }) stage!: (typeof STAGES)[number];
  @ApiProperty() conclusion!: string;
  @ApiProperty({ type: [String] }) evidenceRefs!: string[];
  @ApiProperty() recordedBy!: string;
  @ApiProperty() recordedAt!: string;
}

export class ProductDefinitionResponseDto {
  @ApiProperty({ enum: ["product-definition.v1"] })
  contractVersion!: string;
  @ApiProperty() definitionId!: string;
  @ApiProperty() initiativeHandoffId!: string;
  @ApiProperty() productOwnerActorId!: string;
  @ApiProperty({ enum: STAGES }) npiStage!: (typeof STAGES)[number];
  @ApiProperty() version!: number;
  @ApiProperty({ enum: RELEASE_STATES })
  releaseState!: (typeof RELEASE_STATES)[number];
  @ApiProperty() specification!: string;
  @ApiProperty({ type: [String] }) complianceAssumptions!: string[];
  @ApiProperty({ type: [NpiStageOutcomeResponseDto] })
  stageOutcomes!: NpiStageOutcomeResponseDto[];
  @ApiProperty({ type: [String] }) pendingFieldCodes!: string[];
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class ProductDefinitionConclusionDto {
  @ApiProperty() text!: string;
  @ApiProperty({ type: [String] }) evidenceRefs!: string[];
}

export class ProductDefinitionWriteRequestDto implements ProductDefinitionWriteCommandV1 {
  @ApiProperty({ enum: ["product-definition-write.v1"] })
  contractVersion!: "product-definition-write.v1";
  @ApiProperty() expectedDefinitionVersion!: number;
  @ApiProperty() specification!: string;
  @ApiProperty({ type: [String] }) complianceAssumptions!: string[];
  @ApiPropertyOptional({ type: ProductDefinitionConclusionDto })
  conclusion?: ProductDefinitionWriteCommandV1["conclusion"];
  @ApiProperty() advanceStage!: boolean;
  @ApiProperty() idempotencyKey!: string;
}

export class ProductDefinitionReleaseRequestDto implements ProductDefinitionReleaseCommandV1 {
  @ApiProperty({ enum: ["product-definition-release.v1"] })
  contractVersion!: "product-definition-release.v1";
  @ApiProperty() expectedDefinitionVersion!: number;
  @ApiProperty({ enum: DECISIONS })
  decision!: ProductDefinitionReleaseCommandV1["decision"];
  @ApiPropertyOptional() reason?: string;
  @ApiProperty() idempotencyKey!: string;
}
