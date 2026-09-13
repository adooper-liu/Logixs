import { ApiProperty } from "@nestjs/swagger";

export class RegisterEvidenceRequestDto {
  @ApiProperty() evidenceType!: string;
  @ApiProperty() subjectType!: string;
  @ApiProperty() subjectId!: string;
  @ApiProperty() authorityLevel!: string;
  @ApiProperty() contentRef!: string;
  @ApiProperty() contentHash!: string;
  @ApiProperty() sourceType!: string;
  @ApiProperty() originatorSystem!: string;
  @ApiProperty() authoritySystem!: string;
  @ApiProperty() ingestionChannel!: string;
  @ApiProperty() captureSource!: string;
}

export class VerifyEvidenceRequestDto {
  @ApiProperty() reasonCode!: string;
  @ApiProperty({ required: false }) reason?: string;
}

export class EvidenceRecordDto {
  @ApiProperty() evidenceId!: string;
  @ApiProperty() tenantId!: string;
  @ApiProperty() evidenceType!: string;
  @ApiProperty() subjectType!: string;
  @ApiProperty() subjectId!: string;
  @ApiProperty() verificationState!: string;
  @ApiProperty() validity!: string;
  @ApiProperty() recordedAt!: string;
  @ApiProperty({ nullable: true }) verificationDecisionId!: string | null;
}
