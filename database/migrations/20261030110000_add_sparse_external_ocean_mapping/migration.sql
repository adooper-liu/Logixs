BEGIN;

CREATE TABLE "external_ocean_provider_profile" (
  "id" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "profile_version" TEXT NOT NULL,
  "dataset_code" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "source_url" TEXT NOT NULL,
  "source_sha256" CHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "external_ocean_provider_profile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "external_ocean_profile_status_check" CHECK ("status" IN ('active', 'deprecated')),
  CONSTRAINT "external_ocean_profile_hash_check" CHECK ("source_sha256" ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX "external_ocean_profile_identity_key" ON "external_ocean_provider_profile"("provider", "profile_version", "dataset_code");
CREATE INDEX "external_ocean_profile_provider_status_idx" ON "external_ocean_provider_profile"("provider", "status");

CREATE TABLE "external_ocean_reference_mapping" (
  "id" UUID NOT NULL,
  "profile_id" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "profile_version" TEXT NOT NULL,
  "dataset_code" TEXT NOT NULL,
  "source_code" TEXT NOT NULL,
  "source_name" TEXT,
  "canonical_code" TEXT NOT NULL,
  "mapping_state" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "source_row_hash" CHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "external_ocean_reference_mapping_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "external_ocean_mapping_profile_fkey" FOREIGN KEY ("profile_id") REFERENCES "external_ocean_provider_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "external_ocean_mapping_state_check" CHECK ("mapping_state" IN ('candidate', 'confirmed', 'rejected')),
  CONSTRAINT "external_ocean_mapping_text_check" CHECK (btrim("source_code") <> '' AND btrim("canonical_code") <> '' AND btrim("reason") <> ''),
  CONSTRAINT "external_ocean_mapping_hash_check" CHECK ("source_row_hash" ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX "external_ocean_mapping_profile_source_key" ON "external_ocean_reference_mapping"("profile_id", "source_code");
CREATE INDEX "external_ocean_mapping_lookup_idx" ON "external_ocean_reference_mapping"("provider", "dataset_code", "source_code");

COMMIT;
