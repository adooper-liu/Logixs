import { Body, Controller, Param, Post, Req } from "@nestjs/common";
import { ApiCreatedResponse, ApiTags } from "@nestjs/swagger";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { PublishComplianceRuleVersionService } from "../application/publish-compliance-rule-version.service";
import {
  PublishComplianceRuleVersionRequestDto,
  PublishComplianceRuleVersionResponseDto,
} from "./compliance-rule.dto";

@ApiTags("compliance")
@Controller("compliance/rules")
export class ComplianceRuleController {
  constructor(
    private readonly publishRule: PublishComplianceRuleVersionService,
  ) {}

  @Post(":ruleCode/versions")
  @RequireCapabilities("compliance.rule.manage")
  @ApiCreatedResponse({ type: PublishComplianceRuleVersionResponseDto })
  async publish(
    @Param("ruleCode") ruleCode: string,
    @Body() body: PublishComplianceRuleVersionRequestDto,
    @Req() request: { identity: { tenantId: string; actorId: string } },
  ): Promise<PublishComplianceRuleVersionResponseDto> {
    const result = await this.publishRule.execute({
      tenantId: request.identity.tenantId,
      ruleCode,
      expectedVersion: body.expectedVersion,
      requirementLayer: body.requirementLayer,
      jurisdictionCountryCode: body.jurisdictionCountryCode,
      effectiveFrom: body.effectiveFrom,
      effectiveTo: body.effectiveTo,
      appliesToAllSkus: body.appliesToAllSkus,
      productSkuIds: body.productSkuIds,
      batteryRequirement: body.batteryRequirement,
      refrigerantRequirement: body.refrigerantRequirement,
      dangerousGoodsRequirement: body.dangerousGoodsRequirement,
      requiredCertificateTypes: body.requiredCertificateTypes,
      blockingNodeCodes: body.blockingNodeCodes,
      severity: body.severity,
      officialSourceUrl: body.officialSourceUrl,
      legalCitation: body.legalCitation,
      owner: body.owner,
      evidenceRefs: body.evidenceRefs,
      actorId: request.identity.actorId,
      reasonCode: body.reasonCode,
      idempotencyKey: body.idempotencyKey,
    });
    return {
      ruleVersionId: result.record.ruleVersionId,
      ruleCode: result.record.ruleCode,
      version: result.record.version,
      duplicate: result.duplicate,
    };
  }
}
