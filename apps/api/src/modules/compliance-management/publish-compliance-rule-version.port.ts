import type {
  PublishComplianceRuleVersionCommand,
  PublishedComplianceRuleVersionRecord,
} from "./domain/compliance-rule";

export const PUBLISH_COMPLIANCE_RULE_VERSION = Symbol(
  "PublishComplianceRuleVersion",
);

export interface PublishComplianceRuleVersionPort {
  execute(command: PublishComplianceRuleVersionCommand): Promise<{
    record: PublishedComplianceRuleVersionRecord;
    duplicate: boolean;
  }>;
}

export type { PublishComplianceRuleVersionCommand };
