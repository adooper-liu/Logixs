BEGIN;

CREATE TABLE "currency_code_reference" (
  "id" UUID NOT NULL,
  "release_id" UUID NOT NULL,
  "alpha_code" CHAR(3) NOT NULL,
  "numeric_code" CHAR(3) NOT NULL,
  "minor_unit" INTEGER,
  "currency_name" TEXT NOT NULL,
  "source_row_hash" CHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "currency_code_reference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "currency_code_reference_release_fkey" FOREIGN KEY ("release_id")
    REFERENCES "reference_data_release"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "currency_code_release_alpha_key" UNIQUE ("release_id", "alpha_code"),
  CONSTRAINT "currency_code_release_numeric_key" UNIQUE ("release_id", "numeric_code"),
  CONSTRAINT "currency_code_reference_shape_check" CHECK (
    "alpha_code" ~ '^[A-Z]{3}$' AND
    "numeric_code" ~ '^[0-9]{3}$' AND
    ("minor_unit" IS NULL OR "minor_unit" BETWEEN 0 AND 9) AND
    length(btrim("currency_name")) > 0 AND
    "source_row_hash" ~ '^[0-9a-f]{64}$'
  )
);

CREATE INDEX "currency_code_alpha_release_idx"
  ON "currency_code_reference"("alpha_code", "release_id");

CREATE FUNCTION "product_initiative_unit_economics_snapshot_is_valid"(
  snapshot_value JSONB,
  negative_reason TEXT,
  require_negative_reason BOOLEAN
) RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  scenario_code TEXT;
  amount_code TEXT;
  scenario_value JSONB;
  range_value JSONB;
  refs_value JSONB;
  contribution_value JSONB;
  refs_are_unique BOOLEAN;
BEGIN
  IF snapshot_value IS NULL OR jsonb_typeof(snapshot_value) <> 'object' OR
     (SELECT count(*) FROM jsonb_object_keys(snapshot_value)) <> 4 OR
     NOT snapshot_value ?& ARRAY['marketCode','channelCode','currencyCode','scenarios'] OR
     jsonb_typeof(snapshot_value->'marketCode') <> 'string' OR
     length(btrim(snapshot_value->>'marketCode')) = 0 OR
     jsonb_typeof(snapshot_value->'channelCode') <> 'string' OR
     length(btrim(snapshot_value->>'channelCode')) = 0 OR
     jsonb_typeof(snapshot_value->'currencyCode') <> 'string' OR
     snapshot_value->>'currencyCode' !~ '^[A-Z]{3}$' OR
     jsonb_typeof(snapshot_value->'scenarios') <> 'object' OR
     (SELECT count(*) FROM jsonb_object_keys(snapshot_value->'scenarios')) <> 2 OR
     NOT (snapshot_value->'scenarios') ?& ARRAY['baseline','conservative'] THEN
    RETURN FALSE;
  END IF;

  FOREACH scenario_code IN ARRAY ARRAY['baseline','conservative'] LOOP
    scenario_value := snapshot_value->'scenarios'->scenario_code;
    IF jsonb_typeof(scenario_value) <> 'object' OR
       (SELECT count(*) FROM jsonb_object_keys(scenario_value)) <> 7 OR
       NOT scenario_value ?& ARRAY[
         'salePrice','landedCost','platformFee','fulfillmentFee',
         'advertisingCost','returnCost','contribution'
       ] THEN
      RETURN FALSE;
    END IF;

    FOREACH amount_code IN ARRAY ARRAY[
      'salePrice','landedCost','platformFee','fulfillmentFee',
      'advertisingCost','returnCost'
    ] LOOP
      range_value := scenario_value->amount_code;
      IF jsonb_typeof(range_value) <> 'object' OR
         (SELECT count(*) FROM jsonb_object_keys(range_value)) <> 4 OR
         NOT range_value ?& ARRAY['min','max','basis','evidenceRefs'] OR
         jsonb_typeof(range_value->'min') <> 'string' OR
         range_value->>'min' !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,4})?$' OR
         jsonb_typeof(range_value->'max') <> 'string' OR
         range_value->>'max' !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,4})?$' OR
         (range_value->>'min')::NUMERIC > (range_value->>'max')::NUMERIC OR
         jsonb_typeof(range_value->'basis') <> 'string' OR
         range_value->>'basis' NOT IN ('evidence','assumption') OR
         jsonb_typeof(range_value->'evidenceRefs') <> 'array' OR
         jsonb_array_length(range_value->'evidenceRefs') > 100 THEN
        RETURN FALSE;
      END IF;

      refs_value := range_value->'evidenceRefs';
      IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(refs_value) AS ref(value)
        WHERE jsonb_typeof(ref.value) IS DISTINCT FROM 'string' OR
          ref.value #>> '{}' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      ) THEN
        RETURN FALSE;
      END IF;
      SELECT count(*) = count(DISTINCT ref.value #>> '{}')
        INTO refs_are_unique
        FROM jsonb_array_elements(refs_value) AS ref(value);
      IF NOT refs_are_unique OR
         (range_value->>'basis' = 'evidence' AND jsonb_array_length(refs_value) = 0) OR
         (range_value->>'basis' = 'assumption' AND jsonb_array_length(refs_value) <> 0) THEN
        RETURN FALSE;
      END IF;
    END LOOP;

    contribution_value := scenario_value->'contribution';
    IF jsonb_typeof(contribution_value) <> 'object' OR
       (SELECT count(*) FROM jsonb_object_keys(contribution_value)) <> 2 OR
       NOT contribution_value ?& ARRAY['min','max'] OR
       jsonb_typeof(contribution_value->'min') <> 'string' OR
       contribution_value->>'min' !~ '^-?(0|[1-9][0-9]{0,12})(\.[0-9]{1,4})?$' OR
       jsonb_typeof(contribution_value->'max') <> 'string' OR
       contribution_value->>'max' !~ '^-?(0|[1-9][0-9]{0,12})(\.[0-9]{1,4})?$' THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  contribution_value := snapshot_value->'scenarios'->'conservative'->'contribution';
  IF (contribution_value->>'min')::NUMERIC < 0 THEN
    IF negative_reason IS NULL THEN
      RETURN NOT require_negative_reason;
    END IF;
    RETURN length(btrim(negative_reason)) BETWEEN 1 AND 2000;
  END IF;
  RETURN negative_reason IS NULL;
END;
$$;

ALTER TABLE "product_initiative"
  ADD COLUMN "unit_economics_draft" JSONB,
  ADD COLUMN "unit_economics_snapshot" JSONB,
  ADD COLUMN "negative_conservative_reason" TEXT;

ALTER TABLE "product_initiative_handoff"
  ADD COLUMN "unit_economics_snapshot" JSONB,
  ADD COLUMN "negative_conservative_reason" TEXT;

-- Domain and JSON Schema validate every range. These database checks preserve the
-- complete snapshot envelope and reject unvalidated JSON bags on terminal writes.
ALTER TABLE "product_initiative"
  ADD CONSTRAINT "product_initiative_unit_economics_draft_shape_check" CHECK (
    "unit_economics_draft" IS NULL OR jsonb_typeof("unit_economics_draft") = 'object'
  ),
  ADD CONSTRAINT "product_initiative_unit_economics_snapshot_shape_check" CHECK (
    "unit_economics_snapshot" IS NULL OR
    "product_initiative_unit_economics_snapshot_is_valid"(
      "unit_economics_snapshot",
      "negative_conservative_reason",
      "outcome" IN ('approve', 'returned_from_npi')
    )
  ),
  ADD CONSTRAINT "product_initiative_unit_economics_terminal_check" CHECK (
    "outcome" NOT IN ('approve', 'returned_from_npi') OR (
      "unit_economics_draft" IS NOT NULL AND
      "unit_economics_snapshot" IS NOT NULL
    ) OR (
      "outcome" = 'returned_from_npi' AND
      "unit_economics_draft" IS NULL AND
      "unit_economics_snapshot" IS NULL
    )
  ) NOT VALID,
  ADD CONSTRAINT "product_initiative_negative_conservative_reason_check" CHECK (
    "unit_economics_snapshot" IS NOT NULL OR
    "negative_conservative_reason" IS NULL
  );

ALTER TABLE "product_initiative_handoff"
  ADD CONSTRAINT "product_initiative_handoff_unit_economics_shape_check" CHECK (
    ("unit_economics_snapshot" IS NULL AND "negative_conservative_reason" IS NULL) OR (
      "unit_economics_snapshot" IS NOT NULL AND
      "product_initiative_unit_economics_snapshot_is_valid"(
        "unit_economics_snapshot", "negative_conservative_reason", TRUE
      )
    )
  );

ALTER TABLE "product_initiative" DROP CONSTRAINT "product_initiative_pending_codes_check";
ALTER TABLE "product_initiative" ADD CONSTRAINT "product_initiative_pending_codes_check" CHECK (
  "pending_field_codes" <@ ARRAY[
    'objective','target_user_and_market','competitive_supply','price_band_and_margin',
    'compliance_risk','customer_feedback','defer_reason','responsibility_commitment',
    'receiving_team_or_role','resource_description','target_date','next_decision_date',
    'next_decision_question','validation_focus','reconsideration_date','reject_reason',
    'return_basis','return_reason','unitEconomics.marketCode','unitEconomics.channelCode',
    'unitEconomics.currencyCode','unitEconomics.scenarios.baseline.salePrice.min',
    'unitEconomics.scenarios.baseline.salePrice.max','unitEconomics.scenarios.baseline.salePrice.basis',
    'unitEconomics.scenarios.baseline.salePrice.evidenceRefs','unitEconomics.scenarios.baseline.landedCost.min',
    'unitEconomics.scenarios.baseline.landedCost.max','unitEconomics.scenarios.baseline.landedCost.basis',
    'unitEconomics.scenarios.baseline.landedCost.evidenceRefs','unitEconomics.scenarios.baseline.platformFee.min',
    'unitEconomics.scenarios.baseline.platformFee.max','unitEconomics.scenarios.baseline.platformFee.basis',
    'unitEconomics.scenarios.baseline.platformFee.evidenceRefs','unitEconomics.scenarios.baseline.fulfillmentFee.min',
    'unitEconomics.scenarios.baseline.fulfillmentFee.max','unitEconomics.scenarios.baseline.fulfillmentFee.basis',
    'unitEconomics.scenarios.baseline.fulfillmentFee.evidenceRefs','unitEconomics.scenarios.baseline.advertisingCost.min',
    'unitEconomics.scenarios.baseline.advertisingCost.max','unitEconomics.scenarios.baseline.advertisingCost.basis',
    'unitEconomics.scenarios.baseline.advertisingCost.evidenceRefs','unitEconomics.scenarios.baseline.returnCost.min',
    'unitEconomics.scenarios.baseline.returnCost.max','unitEconomics.scenarios.baseline.returnCost.basis',
    'unitEconomics.scenarios.baseline.returnCost.evidenceRefs','unitEconomics.scenarios.conservative.salePrice.min',
    'unitEconomics.scenarios.conservative.salePrice.max','unitEconomics.scenarios.conservative.salePrice.basis',
    'unitEconomics.scenarios.conservative.salePrice.evidenceRefs','unitEconomics.scenarios.conservative.landedCost.min',
    'unitEconomics.scenarios.conservative.landedCost.max','unitEconomics.scenarios.conservative.landedCost.basis',
    'unitEconomics.scenarios.conservative.landedCost.evidenceRefs','unitEconomics.scenarios.conservative.platformFee.min',
    'unitEconomics.scenarios.conservative.platformFee.max','unitEconomics.scenarios.conservative.platformFee.basis',
    'unitEconomics.scenarios.conservative.platformFee.evidenceRefs','unitEconomics.scenarios.conservative.fulfillmentFee.min',
    'unitEconomics.scenarios.conservative.fulfillmentFee.max','unitEconomics.scenarios.conservative.fulfillmentFee.basis',
    'unitEconomics.scenarios.conservative.fulfillmentFee.evidenceRefs','unitEconomics.scenarios.conservative.advertisingCost.min',
    'unitEconomics.scenarios.conservative.advertisingCost.max','unitEconomics.scenarios.conservative.advertisingCost.basis',
    'unitEconomics.scenarios.conservative.advertisingCost.evidenceRefs','unitEconomics.scenarios.conservative.returnCost.min',
    'unitEconomics.scenarios.conservative.returnCost.max','unitEconomics.scenarios.conservative.returnCost.basis',
    'unitEconomics.scenarios.conservative.returnCost.evidenceRefs','negativeConservativeReason'
  ]::TEXT[]
);

COMMIT;

-- Production enablement remains gated on an approved official List One active release.
-- Recovery before new writes: drop the constraints, columns, index, and currency table.
-- After new writes exist, preserve rows and roll forward with a corrective migration.
