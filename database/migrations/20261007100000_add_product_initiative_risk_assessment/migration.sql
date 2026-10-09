ALTER TABLE "product_initiative" ADD COLUMN "risk_assessment_draft" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "product_initiative" ADD COLUMN "risk_assessment_snapshot" JSONB;
ALTER TABLE "product_initiative_handoff" ADD COLUMN "risk_assessment_snapshot" JSONB;

ALTER TABLE "product_initiative" ADD CONSTRAINT "product_initiative_risk_assessment_shape_check" CHECK (
  jsonb_typeof("risk_assessment_draft") = 'array' AND jsonb_array_length("risk_assessment_draft") <= 5 AND
  ("risk_assessment_snapshot" IS NULL OR (jsonb_typeof("risk_assessment_snapshot") = 'array' AND jsonb_array_length("risk_assessment_snapshot") = 5))
);
ALTER TABLE "product_initiative_handoff" ADD CONSTRAINT "product_initiative_handoff_risk_assessment_shape_check" CHECK (
  "risk_assessment_snapshot" IS NULL OR (jsonb_typeof("risk_assessment_snapshot") = 'array' AND jsonb_array_length("risk_assessment_snapshot") = 5)
);

ALTER TABLE "product_initiative" DROP CONSTRAINT "product_initiative_pending_codes_check";
ALTER TABLE "product_initiative" ADD CONSTRAINT "product_initiative_pending_codes_check" CHECK (
  "pending_field_codes" <@ ARRAY[
    'risk.compliance','risk.intellectual_property','risk.packaging_logistics','risk.returns','risk.platform_restrictions',
    'customer_need','value_differentiation','commercial_viability','supply_technical_feasibility','strategy_portfolio',
    'objective','target_user_and_market','competitive_supply','price_band_and_margin','compliance_risk','customer_feedback','defer_reason','responsibility_commitment',
    'receiving_team_or_role','resource_description','target_date','next_decision_date','next_decision_question','validation_focus','reconsideration_date','reject_reason',
    'return_basis','return_reason','unitEconomics.marketCode','unitEconomics.channelCode','unitEconomics.currencyCode',
    'unitEconomics.scenarios.baseline.salePrice.min','unitEconomics.scenarios.baseline.salePrice.max','unitEconomics.scenarios.baseline.salePrice.basis','unitEconomics.scenarios.baseline.salePrice.evidenceRefs',
    'unitEconomics.scenarios.baseline.landedCost.min','unitEconomics.scenarios.baseline.landedCost.max','unitEconomics.scenarios.baseline.landedCost.basis','unitEconomics.scenarios.baseline.landedCost.evidenceRefs',
    'unitEconomics.scenarios.baseline.platformFee.min','unitEconomics.scenarios.baseline.platformFee.max','unitEconomics.scenarios.baseline.platformFee.basis','unitEconomics.scenarios.baseline.platformFee.evidenceRefs',
    'unitEconomics.scenarios.baseline.fulfillmentFee.min','unitEconomics.scenarios.baseline.fulfillmentFee.max','unitEconomics.scenarios.baseline.fulfillmentFee.basis','unitEconomics.scenarios.baseline.fulfillmentFee.evidenceRefs',
    'unitEconomics.scenarios.baseline.advertisingCost.min','unitEconomics.scenarios.baseline.advertisingCost.max','unitEconomics.scenarios.baseline.advertisingCost.basis','unitEconomics.scenarios.baseline.advertisingCost.evidenceRefs',
    'unitEconomics.scenarios.baseline.returnCost.min','unitEconomics.scenarios.baseline.returnCost.max','unitEconomics.scenarios.baseline.returnCost.basis','unitEconomics.scenarios.baseline.returnCost.evidenceRefs',
    'unitEconomics.scenarios.conservative.salePrice.min','unitEconomics.scenarios.conservative.salePrice.max','unitEconomics.scenarios.conservative.salePrice.basis','unitEconomics.scenarios.conservative.salePrice.evidenceRefs',
    'unitEconomics.scenarios.conservative.landedCost.min','unitEconomics.scenarios.conservative.landedCost.max','unitEconomics.scenarios.conservative.landedCost.basis','unitEconomics.scenarios.conservative.landedCost.evidenceRefs',
    'unitEconomics.scenarios.conservative.platformFee.min','unitEconomics.scenarios.conservative.platformFee.max','unitEconomics.scenarios.conservative.platformFee.basis','unitEconomics.scenarios.conservative.platformFee.evidenceRefs',
    'unitEconomics.scenarios.conservative.fulfillmentFee.min','unitEconomics.scenarios.conservative.fulfillmentFee.max','unitEconomics.scenarios.conservative.fulfillmentFee.basis','unitEconomics.scenarios.conservative.fulfillmentFee.evidenceRefs',
    'unitEconomics.scenarios.conservative.advertisingCost.min','unitEconomics.scenarios.conservative.advertisingCost.max','unitEconomics.scenarios.conservative.advertisingCost.basis','unitEconomics.scenarios.conservative.advertisingCost.evidenceRefs',
    'unitEconomics.scenarios.conservative.returnCost.min','unitEconomics.scenarios.conservative.returnCost.max','unitEconomics.scenarios.conservative.returnCost.basis','unitEconomics.scenarios.conservative.returnCost.evidenceRefs','negativeConservativeReason'
  ]::text[]
);
