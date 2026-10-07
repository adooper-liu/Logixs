import type { ProductInitiativeDecisionCommandV1 } from "@logix/contracts";
import type { ProductInitiativeUnitEconomicsContext } from "../../modules/product-selection/domain/unit-economics";
import { BUSINESS_CASE_DIMENSIONS } from "../../modules/product-selection/domain/product-initiative";

const PRODUCT_INITIATIVE_TEST_EVIDENCE_IDS = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
  "00000000-0000-4000-8000-000000000004",
  "00000000-0000-4000-8000-000000000005",
] as const;

export const PRODUCT_INITIATIVE_TEST_BUSINESS_CASE =
  BUSINESS_CASE_DIMENSIONS.map((dimensionCode, index) => ({
    dimensionCode,
    decision: "supports_investment" as const,
    conclusion: `集成测试已确认 ${dimensionCode} 支持投入`,
    evidenceRefs: [PRODUCT_INITIATIVE_TEST_EVIDENCE_IDS[index]],
    criticalUnknown: null,
  })) satisfies NonNullable<
    ProductInitiativeDecisionCommandV1["businessCaseDraft"]
  >;

export const PRODUCT_INITIATIVE_TEST_CONTEXT: ProductInitiativeUnitEconomicsContext =
  {
    marketCode: "CA",
    channelCode: "amazon",
    currencyResolution: "active",
  };

export const PRODUCT_INITIATIVE_TEST_COMMITMENT = {
  acceptResponsibility: true,
  receivingTeamOrRole: "产品开发 / NPI",
  resourceDescription: "集成测试资源承诺",
  targetDate: "2026-11-15",
  nextDecisionDate: "2026-10-20",
  nextDecisionQuestion: "是否进入下一阶段",
} satisfies Partial<ProductInitiativeDecisionCommandV1>;

export const PRODUCT_INITIATIVE_TEST_APPROVE_PREREQUISITE = {
  ...PRODUCT_INITIATIVE_TEST_COMMITMENT,
  businessCaseDraft: PRODUCT_INITIATIVE_TEST_BUSINESS_CASE,
} satisfies Partial<ProductInitiativeDecisionCommandV1>;

export function completeUnitEconomicsDraft() {
  const cost = {
    min: "1",
    max: "2",
    basis: "assumption" as const,
    evidenceRefs: [],
  };
  const scenario = {
    salePrice: { ...cost, min: "20", max: "30" },
    landedCost: cost,
    platformFee: cost,
    fulfillmentFee: cost,
    advertisingCost: cost,
    returnCost: cost,
  };
  return {
    channelCode: "amazon",
    currencyCode: "USD",
    scenarios: { baseline: scenario, conservative: scenario },
  };
}
