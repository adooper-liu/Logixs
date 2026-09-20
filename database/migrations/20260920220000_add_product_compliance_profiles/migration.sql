-- Product/SKU regulated attributes are persisted as typed, append-only profile
-- versions. Rules, assessments and lifecycle decisions remain outside this migration.
CREATE TABLE "product_compliance_profile" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_sku_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "supersedes_profile_id" UUID,
    "ingestion_channel" TEXT NOT NULL,
    "source_system" TEXT NOT NULL,
    "evidence_refs" JSONB NOT NULL,
    "verification_state" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "reason_code" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "superseded_at" TIMESTAMPTZ,

    CONSTRAINT "product_compliance_profile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_compliance_profile_tenant_check"
      CHECK (char_length("tenant_id") BETWEEN 1 AND 128 AND "tenant_id" = btrim("tenant_id") AND "tenant_id" !~ '[[:cntrl:]]'),
    CONSTRAINT "product_compliance_profile_version_check" CHECK ("version" >= 1),
    CONSTRAINT "product_compliance_profile_state_check" CHECK ("state" IN ('active', 'superseded')),
    CONSTRAINT "product_compliance_profile_chain_check"
      CHECK (("version" = 1 AND "supersedes_profile_id" IS NULL) OR ("version" > 1 AND "supersedes_profile_id" IS NOT NULL)),
    CONSTRAINT "product_compliance_profile_state_time_check"
      CHECK (("state" = 'active' AND "superseded_at" IS NULL) OR ("state" = 'superseded' AND "superseded_at" IS NOT NULL)),
    CONSTRAINT "product_compliance_profile_channel_check"
      CHECK ("ingestion_channel" IN ('api', 'webhook', 'file_import', 'manual_ui')),
    CONSTRAINT "product_compliance_profile_source_check"
      CHECK (char_length("source_system") BETWEEN 1 AND 128 AND "source_system" = btrim("source_system") AND "source_system" !~ '[[:cntrl:]]'),
    CONSTRAINT "product_compliance_profile_evidence_check"
      CHECK (jsonb_typeof("evidence_refs") = 'array' AND jsonb_array_length("evidence_refs") > 0),
    CONSTRAINT "product_compliance_profile_verification_check"
      CHECK ("verification_state" IN ('pending', 'verified', 'rejected', 'revoked')),
    CONSTRAINT "product_compliance_profile_actor_check"
      CHECK (char_length("actor_id") BETWEEN 1 AND 128 AND "actor_id" = btrim("actor_id") AND "actor_id" !~ '[[:cntrl:]]'),
    CONSTRAINT "product_compliance_profile_reason_check"
      CHECK (char_length("reason_code") BETWEEN 1 AND 64 AND "reason_code" = btrim("reason_code") AND "reason_code" !~ '[[:cntrl:]]'),
    CONSTRAINT "product_compliance_profile_idempotency_check"
      CHECK (char_length("idempotency_key") BETWEEN 1 AND 200 AND "idempotency_key" = btrim("idempotency_key") AND "idempotency_key" !~ '[[:cntrl:]]'),
    CONSTRAINT "product_compliance_profile_hash_check" CHECK ("payload_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "product_compliance_profile_not_self_check"
      CHECK ("supersedes_profile_id" IS NULL OR "supersedes_profile_id" <> "id")
);

CREATE UNIQUE INDEX "product_compliance_profile_id_tenant_key"
ON "product_compliance_profile"("id", "tenant_id");
CREATE UNIQUE INDEX "product_compliance_profile_id_tenant_sku_key"
ON "product_compliance_profile"("id", "tenant_id", "product_sku_id");
CREATE UNIQUE INDEX "product_compliance_profile_tenant_idempotency_key"
ON "product_compliance_profile"("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX "product_compliance_profile_sku_version_key"
ON "product_compliance_profile"("tenant_id", "product_sku_id", "version");
CREATE UNIQUE INDEX "product_compliance_profile_supersedes_tenant_sku_key"
ON "product_compliance_profile"("supersedes_profile_id", "tenant_id", "product_sku_id");
CREATE UNIQUE INDEX "product_compliance_profile_one_active_key"
ON "product_compliance_profile"("tenant_id", "product_sku_id")
WHERE "state" = 'active';
CREATE INDEX "product_compliance_profile_active_idx"
ON "product_compliance_profile"("tenant_id", "product_sku_id", "state");

ALTER TABLE "product_compliance_profile"
ADD CONSTRAINT "product_compliance_profile_sku_fkey"
FOREIGN KEY ("product_sku_id", "tenant_id")
REFERENCES "product_sku"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_compliance_profile"
ADD CONSTRAINT "product_compliance_profile_supersedes_fkey"
FOREIGN KEY ("supersedes_profile_id", "tenant_id", "product_sku_id")
REFERENCES "product_compliance_profile"("id", "tenant_id", "product_sku_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "product_battery_profile" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "profile_id" UUID NOT NULL,
    "presence_state" TEXT NOT NULL,
    "chemistry_code" TEXT,
    "model_number" TEXT,
    "cell_count" INTEGER,
    "battery_count" INTEGER,
    "watt_hours" DECIMAL(15,3),
    "lithium_content_grams" DECIMAL(15,3),
    "removable" BOOLEAN,
    "packing_mode" TEXT,

    CONSTRAINT "product_battery_profile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_battery_profile_presence_check" CHECK ("presence_state" IN ('present', 'absent', 'unknown')),
    CONSTRAINT "product_battery_profile_counts_check" CHECK (("cell_count" IS NULL OR "cell_count" > 0) AND ("battery_count" IS NULL OR "battery_count" > 0)),
    CONSTRAINT "product_battery_profile_values_check" CHECK (("watt_hours" IS NULL OR "watt_hours" > 0) AND ("lithium_content_grams" IS NULL OR "lithium_content_grams" > 0)),
    CONSTRAINT "product_battery_profile_packing_check" CHECK ("packing_mode" IS NULL OR "packing_mode" IN ('battery_only', 'packed_with_equipment', 'contained_in_equipment')),
    CONSTRAINT "product_battery_profile_shape_check" CHECK (
      ("presence_state" = 'present' AND "chemistry_code" IS NOT NULL AND "battery_count" IS NOT NULL AND "removable" IS NOT NULL AND "packing_mode" IS NOT NULL)
      OR
      ("presence_state" IN ('absent', 'unknown') AND "chemistry_code" IS NULL AND "model_number" IS NULL AND "cell_count" IS NULL AND "battery_count" IS NULL AND "watt_hours" IS NULL AND "lithium_content_grams" IS NULL AND "removable" IS NULL AND "packing_mode" IS NULL)
    )
);
CREATE UNIQUE INDEX "product_battery_profile_profile_tenant_key" ON "product_battery_profile"("profile_id", "tenant_id");
CREATE INDEX "product_battery_profile_tenant_profile_idx" ON "product_battery_profile"("tenant_id", "profile_id");
ALTER TABLE "product_battery_profile"
ADD CONSTRAINT "product_battery_profile_profile_fkey"
FOREIGN KEY ("profile_id", "tenant_id")
REFERENCES "product_compliance_profile"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "product_refrigerant_profile" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "profile_id" UUID NOT NULL,
    "presence_state" TEXT NOT NULL,
    "refrigerant_code" TEXT,
    "charge_quantity" DECIMAL(15,3),
    "charge_unit" TEXT,
    "global_warming_potential" DECIMAL(15,3),
    "hermetically_sealed" BOOLEAN,

    CONSTRAINT "product_refrigerant_profile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_refrigerant_profile_presence_check" CHECK ("presence_state" IN ('present', 'absent', 'unknown')),
    CONSTRAINT "product_refrigerant_profile_values_check" CHECK (("charge_quantity" IS NULL OR "charge_quantity" > 0) AND ("global_warming_potential" IS NULL OR "global_warming_potential" > 0)),
    CONSTRAINT "product_refrigerant_profile_shape_check" CHECK (
      ("presence_state" = 'present' AND "refrigerant_code" IS NOT NULL AND "charge_quantity" IS NOT NULL AND "charge_unit" IS NOT NULL AND "global_warming_potential" IS NOT NULL AND "hermetically_sealed" IS NOT NULL)
      OR
      ("presence_state" IN ('absent', 'unknown') AND "refrigerant_code" IS NULL AND "charge_quantity" IS NULL AND "charge_unit" IS NULL AND "global_warming_potential" IS NULL AND "hermetically_sealed" IS NULL)
    )
);
CREATE UNIQUE INDEX "product_refrigerant_profile_profile_tenant_key" ON "product_refrigerant_profile"("profile_id", "tenant_id");
CREATE INDEX "product_refrigerant_profile_tenant_profile_idx" ON "product_refrigerant_profile"("tenant_id", "profile_id");
ALTER TABLE "product_refrigerant_profile"
ADD CONSTRAINT "product_refrigerant_profile_profile_fkey"
FOREIGN KEY ("profile_id", "tenant_id")
REFERENCES "product_compliance_profile"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "product_dangerous_goods_profile" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "profile_id" UUID NOT NULL,
    "classification_state" TEXT NOT NULL,
    "un_number" TEXT,
    "proper_shipping_name" TEXT,
    "hazard_class" TEXT,
    "division" TEXT,
    "packing_group" TEXT,
    "marine_pollutant" BOOLEAN,
    "flash_point_celsius" DECIMAL(9,3),

    CONSTRAINT "product_dangerous_goods_profile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_dg_profile_state_check" CHECK ("classification_state" IN ('regulated', 'not_regulated', 'undetermined')),
    CONSTRAINT "product_dg_profile_un_check" CHECK ("un_number" IS NULL OR "un_number" ~ '^UN[0-9]{4}$'),
    CONSTRAINT "product_dg_profile_group_check" CHECK ("packing_group" IS NULL OR "packing_group" IN ('I', 'II', 'III')),
    CONSTRAINT "product_dg_profile_shape_check" CHECK (
      ("classification_state" = 'regulated' AND "un_number" IS NOT NULL AND "proper_shipping_name" IS NOT NULL AND "hazard_class" IS NOT NULL AND "marine_pollutant" IS NOT NULL)
      OR
      ("classification_state" IN ('not_regulated', 'undetermined') AND "un_number" IS NULL AND "proper_shipping_name" IS NULL AND "hazard_class" IS NULL AND "division" IS NULL AND "packing_group" IS NULL AND "marine_pollutant" IS NULL AND "flash_point_celsius" IS NULL)
    )
);
CREATE UNIQUE INDEX "product_dg_profile_profile_tenant_key" ON "product_dangerous_goods_profile"("profile_id", "tenant_id");
CREATE INDEX "product_dg_profile_tenant_profile_idx" ON "product_dangerous_goods_profile"("tenant_id", "profile_id");
ALTER TABLE "product_dangerous_goods_profile"
ADD CONSTRAINT "product_dg_profile_profile_fkey"
FOREIGN KEY ("profile_id", "tenant_id")
REFERENCES "product_compliance_profile"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "product_inspection_requirement" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "profile_id" UUID NOT NULL,
    "requirement_type" TEXT NOT NULL,
    "requirement_state" TEXT NOT NULL,
    "jurisdiction_country_code" TEXT,
    "notes" TEXT,

    CONSTRAINT "product_inspection_requirement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_inspection_requirement_type_check" CHECK ("requirement_type" IN ('commodity_inspection', 'phytosanitary', 'fumigation', 'sanitary', 'veterinary', 'food_safety')),
    CONSTRAINT "product_inspection_requirement_state_check" CHECK ("requirement_state" IN ('required', 'not_required', 'unknown')),
    CONSTRAINT "product_inspection_requirement_country_check" CHECK ("jurisdiction_country_code" IS NULL OR "jurisdiction_country_code" ~ '^[A-Z]{2}$'),
    CONSTRAINT "product_inspection_requirement_notes_check" CHECK ("notes" IS NULL OR (char_length("notes") BETWEEN 1 AND 1000 AND "notes" = btrim("notes") AND "notes" !~ '[[:cntrl:]]'))
);
CREATE UNIQUE INDEX "product_inspection_requirement_scope_key"
ON "product_inspection_requirement"("profile_id", "requirement_type", "jurisdiction_country_code") NULLS NOT DISTINCT;
CREATE INDEX "product_inspection_requirement_profile_idx" ON "product_inspection_requirement"("tenant_id", "profile_id");
ALTER TABLE "product_inspection_requirement"
ADD CONSTRAINT "product_inspection_requirement_profile_fkey"
FOREIGN KEY ("profile_id", "tenant_id")
REFERENCES "product_compliance_profile"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "product_certificate" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_sku_id" UUID NOT NULL,
    "certificate_key" TEXT NOT NULL,
    "certificate_type" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_certificate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_certificate_key_check" CHECK (char_length("certificate_key") BETWEEN 1 AND 128 AND "certificate_key" = btrim("certificate_key") AND "certificate_key" !~ '[[:cntrl:]]'),
    CONSTRAINT "product_certificate_type_check" CHECK ("certificate_type" IN ('un38_3', 'sds', 'transport_safety_assessment', 'ce', 'ukca', 'fcc', 'cpsc', 'rohs', 'reach', 'weee', 'epr', 'battery_regulation', 'certificate_of_origin', 'wood_origin', 'phytosanitary_certificate', 'fumigation_certificate', 'commodity_inspection_certificate', 'veterinary_certificate', 'sanitary_certificate', 'food_safety_certificate'))
);
CREATE UNIQUE INDEX "product_certificate_id_tenant_key" ON "product_certificate"("id", "tenant_id");
CREATE UNIQUE INDEX "product_certificate_id_tenant_sku_key" ON "product_certificate"("id", "tenant_id", "product_sku_id");
CREATE UNIQUE INDEX "product_certificate_sku_key" ON "product_certificate"("tenant_id", "product_sku_id", "certificate_key");
CREATE INDEX "product_certificate_sku_idx" ON "product_certificate"("tenant_id", "product_sku_id");
ALTER TABLE "product_certificate"
ADD CONSTRAINT "product_certificate_sku_fkey"
FOREIGN KEY ("product_sku_id", "tenant_id")
REFERENCES "product_sku"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "product_certificate_version" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_certificate_id" UUID NOT NULL,
    "product_sku_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "supersedes_version_id" UUID,
    "certificate_number" TEXT NOT NULL,
    "issuer_name" TEXT NOT NULL,
    "coverage_scope" TEXT NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_until" DATE,
    "document_record_id" UUID NOT NULL,
    "verification_state" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_certificate_version_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_certificate_version_number_check" CHECK ("version" >= 1),
    CONSTRAINT "product_certificate_version_chain_check" CHECK (("version" = 1 AND "supersedes_version_id" IS NULL) OR ("version" > 1 AND "supersedes_version_id" IS NOT NULL)),
    CONSTRAINT "product_certificate_version_scope_check" CHECK ("coverage_scope" IN ('global', 'countries')),
    CONSTRAINT "product_certificate_version_validity_check" CHECK ("valid_until" IS NULL OR "valid_until" >= "valid_from"),
    CONSTRAINT "product_certificate_version_verification_check" CHECK ("verification_state" IN ('pending', 'verified', 'rejected', 'revoked')),
    CONSTRAINT "product_certificate_version_hash_check" CHECK ("payload_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "product_certificate_version_not_self_check" CHECK ("supersedes_version_id" IS NULL OR "supersedes_version_id" <> "id"),
    CONSTRAINT "product_certificate_version_number_text_check" CHECK (char_length("certificate_number") BETWEEN 1 AND 128 AND "certificate_number" = btrim("certificate_number") AND "certificate_number" !~ '[[:cntrl:]]'),
    CONSTRAINT "product_certificate_version_issuer_check" CHECK (char_length("issuer_name") BETWEEN 1 AND 200 AND "issuer_name" = btrim("issuer_name") AND "issuer_name" !~ '[[:cntrl:]]')
);
CREATE UNIQUE INDEX "product_certificate_version_id_tenant_key" ON "product_certificate_version"("id", "tenant_id");
CREATE UNIQUE INDEX "product_certificate_version_id_tenant_sku_key" ON "product_certificate_version"("id", "tenant_id", "product_sku_id");
CREATE UNIQUE INDEX "product_certificate_version_id_tenant_certificate_key" ON "product_certificate_version"("id", "tenant_id", "product_certificate_id");
CREATE UNIQUE INDEX "product_certificate_version_number_key" ON "product_certificate_version"("tenant_id", "product_certificate_id", "version");
CREATE UNIQUE INDEX "product_certificate_version_supersedes_tenant_certificate_key" ON "product_certificate_version"("supersedes_version_id", "tenant_id", "product_certificate_id");
CREATE INDEX "product_certificate_version_latest_idx" ON "product_certificate_version"("tenant_id", "product_certificate_id", "version");
ALTER TABLE "product_certificate_version"
ADD CONSTRAINT "product_certificate_version_certificate_fkey"
FOREIGN KEY ("product_certificate_id", "tenant_id", "product_sku_id")
REFERENCES "product_certificate"("id", "tenant_id", "product_sku_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_certificate_version"
ADD CONSTRAINT "product_certificate_version_supersedes_fkey"
FOREIGN KEY ("supersedes_version_id", "tenant_id", "product_certificate_id")
REFERENCES "product_certificate_version"("id", "tenant_id", "product_certificate_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "product_certificate_country_coverage" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "certificate_version_id" UUID NOT NULL,
    "country_code" TEXT NOT NULL,

    CONSTRAINT "product_certificate_country_coverage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_certificate_country_code_check" CHECK ("country_code" ~ '^[A-Z]{2}$')
);
CREATE UNIQUE INDEX "product_certificate_country_key" ON "product_certificate_country_coverage"("certificate_version_id", "country_code");
CREATE INDEX "product_certificate_country_tenant_idx" ON "product_certificate_country_coverage"("tenant_id", "certificate_version_id");
ALTER TABLE "product_certificate_country_coverage"
ADD CONSTRAINT "product_certificate_country_version_fkey"
FOREIGN KEY ("certificate_version_id", "tenant_id")
REFERENCES "product_certificate_version"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "product_compliance_profile_certificate" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_sku_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "certificate_version_id" UUID NOT NULL,

    CONSTRAINT "product_compliance_profile_certificate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "product_compliance_profile_certificate_key" ON "product_compliance_profile_certificate"("profile_id", "certificate_version_id");
CREATE INDEX "product_compliance_certificate_version_idx" ON "product_compliance_profile_certificate"("tenant_id", "certificate_version_id");
ALTER TABLE "product_compliance_profile_certificate"
ADD CONSTRAINT "product_compliance_profile_certificate_profile_fkey"
FOREIGN KEY ("profile_id", "tenant_id", "product_sku_id")
REFERENCES "product_compliance_profile"("id", "tenant_id", "product_sku_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_compliance_profile_certificate"
ADD CONSTRAINT "product_compliance_profile_certificate_version_fkey"
FOREIGN KEY ("certificate_version_id", "tenant_id", "product_sku_id")
REFERENCES "product_certificate_version"("id", "tenant_id", "product_sku_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Recovery: older application code can ignore these additive tables. Preserve
-- populated profile and certificate versions; they are audit history.
