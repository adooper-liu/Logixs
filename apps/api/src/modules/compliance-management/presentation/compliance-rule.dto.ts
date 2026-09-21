import { ApiProperty } from "@nestjs/swagger";
import type {
  ComplianceRequirementLayer,
  ComplianceRuleSeverity,
  DangerousGoodsRequirement,
  PresenceRequirement,
} from "../domain/compliance-rule";

export class PublishComplianceRuleVersionRequestDto {
  @ApiProperty() expectedVersion!: number;
  @ApiProperty({
    enum: [
      "law_regulation",
      "company_policy",
      "customer_requirement",
      "carrier_facility_requirement",
      "contract_obligation",
    ],
  })
  requirementLayer!: ComplianceRequirementLayer;
  @ApiProperty({ example: "US" }) jurisdictionCountryCode!: string;
  @ApiProperty({ example: "2026-01-01" }) effectiveFrom!: string;
  @ApiProperty({ example: "2026-12-31", nullable: true, required: false })
  effectiveTo?: string | null;
  @ApiProperty() appliesToAllSkus!: boolean;
  @ApiProperty({ type: [String], required: false }) productSkuIds?: string[];
  @ApiProperty({ enum: ["any", "present", "absent"], required: false })
  batteryRequirement?: PresenceRequirement;
  @ApiProperty({ enum: ["any", "present", "absent"], required: false })
  refrigerantRequirement?: PresenceRequirement;
  @ApiProperty({
    enum: ["any", "regulated", "not_regulated"],
    required: false,
  })
  dangerousGoodsRequirement?: DangerousGoodsRequirement;
  @ApiProperty({ type: [String], required: false })
  requiredCertificateTypes?: string[];
  @ApiProperty({ type: [String], example: ["cargo_ready"] })
  blockingNodeCodes!: string[];
  @ApiProperty({ enum: ["low", "medium", "high", "critical"] })
  severity!: ComplianceRuleSeverity;
  @ApiProperty() officialSourceUrl!: string;
  @ApiProperty() legalCitation!: string;
  @ApiProperty() owner!: string;
  @ApiProperty({ type: [String] }) evidenceRefs!: string[];
  @ApiProperty() reasonCode!: string;
  @ApiProperty() idempotencyKey!: string;
}

export class PublishComplianceRuleVersionResponseDto {
  @ApiProperty() ruleVersionId!: string;
  @ApiProperty() ruleCode!: string;
  @ApiProperty() version!: number;
  @ApiProperty() duplicate!: boolean;
}
