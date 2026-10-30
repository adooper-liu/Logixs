-- Logix-owned internal ocean baseline v1.
-- This migration adds only canonical reference rows; external provider mappings are a later slice.
BEGIN;

CREATE TABLE "ocean_carrier_reference" (
  "id" UUID NOT NULL,
  "release_id" UUID NOT NULL,
  "canonical_code" TEXT NOT NULL,
  "name_zh" TEXT NOT NULL,
  "name_en" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "source_row_hash" CHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ocean_carrier_reference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ocean_carrier_reference_release_fkey"
    FOREIGN KEY ("release_id") REFERENCES "reference_data_release"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ocean_carrier_reference_text_check"
    CHECK ("canonical_code" = btrim("canonical_code") AND "canonical_code" <> '' AND "name_zh" <> '' AND "name_en" <> ''),
  CONSTRAINT "ocean_carrier_reference_status_check"
    CHECK ("status" IN ('active', 'deprecated')),
  CONSTRAINT "ocean_carrier_reference_hash_check"
    CHECK ("source_row_hash" ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX "ocean_carrier_release_code_key" ON "ocean_carrier_reference"("release_id", "canonical_code");
CREATE INDEX "ocean_carrier_code_release_idx" ON "ocean_carrier_reference"("canonical_code", "release_id");

CREATE TABLE "container_type_reference" (
  "id" UUID NOT NULL,
  "release_id" UUID NOT NULL,
  "canonical_code" TEXT NOT NULL,
  "length" INTEGER NOT NULL,
  "type_code" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "source_row_hash" CHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "container_type_reference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "container_type_reference_release_fkey"
    FOREIGN KEY ("release_id") REFERENCES "reference_data_release"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "container_type_reference_code_check"
    CHECK ("canonical_code" = btrim("canonical_code") AND "canonical_code" <> ''),
  CONSTRAINT "container_type_reference_length_check"
    CHECK ("length" IN (20, 40, 45)),
  CONSTRAINT "container_type_reference_type_check"
    CHECK ("type_code" IN ('GP', 'HC', 'FR', 'OT', 'RF')),
  CONSTRAINT "container_type_reference_combination_check"
    CHECK ("canonical_code" = ("length"::TEXT || "type_code")),
  CONSTRAINT "container_type_reference_status_check"
    CHECK ("status" IN ('active', 'deprecated')),
  CONSTRAINT "container_type_reference_hash_check"
    CHECK ("source_row_hash" ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX "container_type_release_code_key" ON "container_type_reference"("release_id", "canonical_code");
CREATE INDEX "container_type_attributes_release_idx" ON "container_type_reference"("length", "type_code", "release_id");

COMMIT;
