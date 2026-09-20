import type { ProductComplianceProfileRecord } from "./domain/product-compliance-profile.repository";

export const GET_PRODUCT_COMPLIANCE_PROFILE = Symbol(
  "GetProductComplianceProfile",
);

export interface GetProductComplianceProfileQuery {
  tenantId: string;
  productSkuId: string;
}

export interface GetProductComplianceProfilePort {
  execute(
    query: GetProductComplianceProfileQuery,
  ): Promise<ProductComplianceProfileRecord | null>;
}

export type { ProductComplianceProfileRecord };
