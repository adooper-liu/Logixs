import type {
  NormalizedComplianceRuleVersion,
  PublishedComplianceRuleVersionRecord,
} from "./compliance-rule";

export const COMPLIANCE_RULE_REPOSITORY = Symbol("ComplianceRuleRepository");

export class ComplianceRuleConflictError extends Error {}

export interface ComplianceRuleRepository {
  publish(input: NormalizedComplianceRuleVersion): Promise<{
    record: PublishedComplianceRuleVersionRecord;
    duplicate: boolean;
  }>;
  findPublishedForAssessment(input: {
    tenantId: string;
    jurisdictionCountryCode: string;
    assessmentDate: string;
  }): Promise<PublishedComplianceRuleVersionRecord[]>;
}
