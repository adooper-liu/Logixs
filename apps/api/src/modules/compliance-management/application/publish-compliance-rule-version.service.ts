import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from "@nestjs/common";
import {
  ASSERT_EVIDENCE_REFS,
  type AssertEvidenceRefsPort,
} from "../../document-records";
import { GET_PRODUCT_SKU, type GetProductSkuPort } from "../../master-data";
import type { PublishComplianceRuleVersionPort } from "../publish-compliance-rule-version.port";
import {
  ComplianceRuleValidationError,
  normalizeComplianceRuleVersion,
  type PublishComplianceRuleVersionCommand,
} from "../domain/compliance-rule";
import {
  COMPLIANCE_RULE_REPOSITORY,
  ComplianceRuleConflictError,
  type ComplianceRuleRepository,
} from "../domain/compliance-rule.repository";

@Injectable()
export class PublishComplianceRuleVersionService implements PublishComplianceRuleVersionPort {
  constructor(
    @Inject(COMPLIANCE_RULE_REPOSITORY)
    private readonly repository: ComplianceRuleRepository,
    @Inject(ASSERT_EVIDENCE_REFS)
    private readonly assertEvidenceRefs: AssertEvidenceRefsPort,
    @Inject(GET_PRODUCT_SKU)
    private readonly getProductSku: GetProductSkuPort,
  ) {}

  async execute(command: PublishComplianceRuleVersionCommand) {
    try {
      const normalized = normalizeComplianceRuleVersion(command);
      await this.assertEvidenceRefs.execute({
        tenantId: normalized.tenantId,
        subjectType: "compliance_rule",
        subjectId: normalized.ruleCode,
        evidenceIds: normalized.evidenceRefs,
      });
      for (const productSkuId of normalized.productSkuIds) {
        const productSku = await this.getProductSku.execute({
          tenantId: normalized.tenantId,
          productSkuId,
        });
        if (!productSku) {
          throw new BadRequestException(
            "BUSINESS_PRECONDITION_FAILED: productSkuIds",
          );
        }
      }
      return await this.repository.publish(normalized);
    } catch (error) {
      if (error instanceof ComplianceRuleValidationError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof ComplianceRuleConflictError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
