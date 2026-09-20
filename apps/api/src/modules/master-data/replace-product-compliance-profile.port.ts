import type { ReplaceProductComplianceProfileCommand } from "./domain/product-compliance-profile";
import type { ProductComplianceProfileRecord } from "./domain/product-compliance-profile.repository";

export const REPLACE_PRODUCT_COMPLIANCE_PROFILE = Symbol(
  "ReplaceProductComplianceProfile",
);

export interface ReplaceProductComplianceProfileResult extends ProductComplianceProfileRecord {
  writeState: "recorded" | "duplicate";
}

export interface ReplaceProductComplianceProfilePort {
  execute(
    command: ReplaceProductComplianceProfileCommand,
  ): Promise<ReplaceProductComplianceProfileResult>;
}

export type { ReplaceProductComplianceProfileCommand };
