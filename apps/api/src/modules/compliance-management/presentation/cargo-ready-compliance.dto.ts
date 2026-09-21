import { ApiProperty } from "@nestjs/swagger";

export class CargoReadyComplianceItemDto {
  @ApiProperty() replenishmentOrderLineId!: string;
  @ApiProperty() productSkuId!: string;
  @ApiProperty() productNumber!: string;
  @ApiProperty({ nullable: true }) complianceProfileId!: string | null;
  @ApiProperty({ nullable: true }) complianceProfileVersion!: number | null;
}

export class CargoReadyComplianceFindingDto {
  @ApiProperty() code!: string;
  @ApiProperty({ nullable: true }) productSkuId!: string | null;
  @ApiProperty({ nullable: true }) ruleVersionId!: string | null;
  @ApiProperty() detail!: string;
}

export class CargoReadyComplianceRuleDto {
  @ApiProperty() ruleVersionId!: string;
  @ApiProperty() ruleCode!: string;
  @ApiProperty() version!: number;
  @ApiProperty() productSkuId!: string;
  @ApiProperty() requirementLayer!: string;
  @ApiProperty({ type: [String] }) requiredCertificateTypes!: string[];
  @ApiProperty({ type: [String] }) blockingNodeCodes!: string[];
  @ApiProperty() severity!: string;
  @ApiProperty() officialSourceUrl!: string;
  @ApiProperty() legalCitation!: string;
}

export class CargoReadyComplianceDecisionDto {
  @ApiProperty() decisionId!: string;
  @ApiProperty() version!: number;
  @ApiProperty() decisionCode!: string;
  @ApiProperty({ type: [String] }) conditionRefs!: string[];
  @ApiProperty({ type: [String] }) evidenceRefs!: string[];
  @ApiProperty() actorId!: string;
  @ApiProperty() reasonCode!: string;
  @ApiProperty() decidedAt!: string;
}

export class CargoReadyComplianceAssessmentResponseDto {
  @ApiProperty() assessmentId!: string;
  @ApiProperty() containerRecordId!: string;
  @ApiProperty() version!: number;
  @ApiProperty() state!: string;
  @ApiProperty() jurisdictionCountryCode!: string;
  @ApiProperty() assessmentDate!: string;
  @ApiProperty({ nullable: true }) allocationSetId!: string | null;
  @ApiProperty({ nullable: true }) allocationSetVersion!: number | null;
  @ApiProperty({ type: [CargoReadyComplianceItemDto] })
  items!: CargoReadyComplianceItemDto[];
  @ApiProperty({ type: [CargoReadyComplianceFindingDto] })
  findings!: CargoReadyComplianceFindingDto[];
  @ApiProperty({ type: [CargoReadyComplianceRuleDto] })
  applicableRules!: CargoReadyComplianceRuleDto[];
  @ApiProperty({ type: [String] }) evidenceRefs!: string[];
  @ApiProperty() actorId!: string;
  @ApiProperty() reasonCode!: string;
  @ApiProperty({ nullable: true, type: CargoReadyComplianceDecisionDto })
  currentDecision!: CargoReadyComplianceDecisionDto | null;
  @ApiProperty() createdAt!: string;
}
