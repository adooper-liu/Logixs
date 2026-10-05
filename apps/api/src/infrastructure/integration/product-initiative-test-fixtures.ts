import type { ProductInitiativeDecisionCommandV1 } from "@logix/contracts";
import type { ProductInitiativeUnitEconomicsContext } from "../../modules/product-selection/domain/unit-economics";

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
