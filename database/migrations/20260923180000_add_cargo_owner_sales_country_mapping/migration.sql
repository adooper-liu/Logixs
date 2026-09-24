-- Separate internal cargo-owner identity from ISO sales country and route destination country.
-- Existing Shipment rows remain valid with a NULL cargo_owner_id; new canonical handoffs may bind a confirmed reference.

CREATE TABLE "cargo_owner_reference" (
    "id" UUID NOT NULL,
    "release_id" UUID NOT NULL,
    "stable_code" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "internal_country_short_code" TEXT NOT NULL,
    "sales_country_id" UUID NOT NULL,
    "source_system" TEXT NOT NULL,
    "source_version" TEXT NOT NULL,
    "source_record_id" TEXT NOT NULL,
    "source_row_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cargo_owner_reference_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cargo_owner_reference_text_check" CHECK (
      "stable_code" ~ '^[A-Z][A-Z0-9_]*$' AND
      "legal_name" = btrim("legal_name") AND "legal_name" <> '' AND
      "normalized_name" = btrim("normalized_name") AND "normalized_name" <> '' AND
      "internal_country_short_code" ~ '^[A-Z]{2}$' AND
      "source_system" = btrim("source_system") AND "source_system" <> '' AND
      "source_version" = btrim("source_version") AND "source_version" <> '' AND
      "source_record_id" = btrim("source_record_id") AND "source_record_id" <> '' AND
      "source_row_hash" ~ '^[0-9a-f]{64}$'
    )
);

CREATE UNIQUE INDEX "cargo_owner_release_code_key"
ON "cargo_owner_reference"("release_id", "stable_code");
CREATE UNIQUE INDEX "cargo_owner_release_name_key"
ON "cargo_owner_reference"("release_id", "normalized_name");
CREATE UNIQUE INDEX "cargo_owner_source_identity_key"
ON "cargo_owner_reference"("source_system", "source_version", "source_record_id");
CREATE INDEX "cargo_owner_sales_country_idx"
ON "cargo_owner_reference"("sales_country_id");

ALTER TABLE "cargo_owner_reference"
ADD CONSTRAINT "cargo_owner_reference_release_fkey"
FOREIGN KEY ("release_id") REFERENCES "reference_data_release"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "cargo_owner_reference_sales_country_fkey"
FOREIGN KEY ("sales_country_id") REFERENCES "country_code_reference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shipment" ADD COLUMN "cargo_owner_id" UUID;
CREATE INDEX "shipment_cargo_owner_idx" ON "shipment"("cargo_owner_id");
ALTER TABLE "shipment"
ADD CONSTRAINT "shipment_cargo_owner_fkey"
FOREIGN KEY ("cargo_owner_id") REFERENCES "cargo_owner_reference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
