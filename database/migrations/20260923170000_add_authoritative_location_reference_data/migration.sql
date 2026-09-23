-- Versioned global reference data for ISO 3166-1 and UNECE UN/LOCODE.
-- Source rows are immutable; future releases are additive and activate by status transition.

CREATE TABLE "reference_data_release" (
    "id" UUID NOT NULL,
    "authority" TEXT NOT NULL,
    "dataset_code" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "published_at" DATE,
    "source_url" TEXT NOT NULL,
    "retrieved_at" TIMESTAMPTZ NOT NULL,
    "source_sha256" CHAR(64) NOT NULL,
    "records_sha256" CHAR(64) NOT NULL,
    "license" TEXT NOT NULL,
    "filter_rule" TEXT,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reference_data_release_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reference_data_release_text_check" CHECK (
      "authority" = btrim("authority") AND "authority" <> '' AND
      "dataset_code" = btrim("dataset_code") AND "dataset_code" <> '' AND
      "version" = btrim("version") AND "version" <> '' AND
      "source_url" = btrim("source_url") AND "source_url" <> '' AND
      "license" = btrim("license") AND "license" <> ''
    ),
    CONSTRAINT "reference_data_release_hash_check" CHECK (
      "source_sha256" ~ '^[0-9a-f]{64}$' AND "records_sha256" ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT "reference_data_release_status_check" CHECK (
      "status" IN ('staged', 'active', 'superseded')
    )
);

CREATE UNIQUE INDEX "reference_data_release_identity_key"
ON "reference_data_release"("authority", "dataset_code", "version");
CREATE UNIQUE INDEX "reference_data_release_one_active_key"
ON "reference_data_release"("authority", "dataset_code") WHERE "status" = 'active';
CREATE INDEX "reference_data_release_dataset_status_idx"
ON "reference_data_release"("dataset_code", "status");

CREATE TABLE "country_code_reference" (
    "id" UUID NOT NULL,
    "release_id" UUID NOT NULL,
    "alpha2" CHAR(2) NOT NULL,
    "alpha3" CHAR(3) NOT NULL,
    "numeric_code" CHAR(3) NOT NULL,
    "name_english" TEXT NOT NULL,
    "name_french" TEXT NOT NULL,
    "source_row_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "country_code_reference_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "country_code_format_check" CHECK (
      "alpha2" ~ '^[A-Z]{2}$' AND
      "alpha3" ~ '^[A-Z]{3}$' AND
      "numeric_code" ~ '^[0-9]{3}$' AND
      "source_row_hash" ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT "country_code_name_check" CHECK (
      "name_english" = btrim("name_english") AND "name_english" <> '' AND
      "name_french" = btrim("name_french") AND "name_french" <> ''
    )
);

CREATE UNIQUE INDEX "country_code_release_alpha2_key"
ON "country_code_reference"("release_id", "alpha2");
CREATE UNIQUE INDEX "country_code_release_alpha3_key"
ON "country_code_reference"("release_id", "alpha3");
CREATE UNIQUE INDEX "country_code_release_numeric_key"
ON "country_code_reference"("release_id", "numeric_code");
CREATE INDEX "country_code_alpha2_release_idx"
ON "country_code_reference"("alpha2", "release_id");

CREATE TABLE "unlocode_area_reference" (
    "id" UUID NOT NULL,
    "release_id" UUID NOT NULL,
    "area_code" CHAR(2) NOT NULL,
    "name" TEXT NOT NULL,
    "iso_country_id" UUID,
    "source_row_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unlocode_area_reference_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "unlocode_area_format_check" CHECK (
      "area_code" ~ '^[A-Z]{2}$' AND
      "name" = btrim("name") AND "name" <> '' AND
      "source_row_hash" ~ '^[0-9a-f]{64}$'
    )
);

CREATE UNIQUE INDEX "unlocode_area_id_release_key"
ON "unlocode_area_reference"("id", "release_id");
CREATE UNIQUE INDEX "unlocode_area_release_code_key"
ON "unlocode_area_reference"("release_id", "area_code");
CREATE INDEX "unlocode_area_iso_country_idx"
ON "unlocode_area_reference"("iso_country_id");

CREATE TABLE "port_code_reference" (
    "id" UUID NOT NULL,
    "release_id" UUID NOT NULL,
    "area_id" UUID NOT NULL,
    "unlocode" CHAR(5) NOT NULL,
    "area_code" CHAR(2) NOT NULL,
    "location_code" CHAR(3) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "port_code_reference_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "port_code_format_check" CHECK (
      "unlocode" ~ '^[A-Z]{2}[A-Z0-9]{3}$' AND
      "area_code" ~ '^[A-Z]{2}$' AND
      "location_code" ~ '^[A-Z0-9]{3}$' AND
      "unlocode" = "area_code" || "location_code"
    )
);

CREATE UNIQUE INDEX "port_code_id_release_key"
ON "port_code_reference"("id", "release_id");
CREATE UNIQUE INDEX "port_code_release_unlocode_key"
ON "port_code_reference"("release_id", "unlocode");
CREATE INDEX "port_code_unlocode_release_idx"
ON "port_code_reference"("unlocode", "release_id");
CREATE INDEX "port_code_area_release_idx"
ON "port_code_reference"("area_id", "release_id");

CREATE TABLE "port_code_entry" (
    "id" UUID NOT NULL,
    "port_id" UUID NOT NULL,
    "release_id" UUID NOT NULL,
    "source_file" TEXT NOT NULL,
    "source_row_number" INTEGER NOT NULL,
    "change_indicator" TEXT,
    "name" TEXT NOT NULL,
    "name_normalized" TEXT NOT NULL,
    "name_without_diacritics" TEXT,
    "name_without_diacritics_normalized" TEXT,
    "subdivision_code" TEXT,
    "function_code" CHAR(8) NOT NULL,
    "status_code" CHAR(2),
    "reference_date" CHAR(4),
    "iata_code" CHAR(3),
    "coordinates" TEXT,
    "remarks" TEXT,
    "source_row_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "port_code_entry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "port_code_entry_source_check" CHECK (
      "source_file" = btrim("source_file") AND "source_file" <> '' AND
      "source_row_number" > 0 AND
      "source_row_hash" ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT "port_code_entry_name_check" CHECK (
      "name" = btrim("name") AND "name" <> '' AND
      "name_normalized" = btrim("name_normalized") AND "name_normalized" <> ''
    ),
    CONSTRAINT "port_code_entry_function_check" CHECK (
      "function_code" ~ '^1(2|-)(3|-)(4|-)(5|-)(6|-)(7|-)(B|-)$'
    ),
    CONSTRAINT "port_code_entry_optional_code_check" CHECK (
      ("status_code" IS NULL OR "status_code" ~ '^[A-Z]{2}$') AND
      ("reference_date" IS NULL OR "reference_date" ~ '^[0-9]{4}$') AND
      ("iata_code" IS NULL OR "iata_code" ~ '^[A-Z0-9]{3}$')
    )
);

CREATE UNIQUE INDEX "port_code_entry_source_row_key"
ON "port_code_entry"("release_id", "source_file", "source_row_number");
CREATE INDEX "port_code_entry_port_idx" ON "port_code_entry"("port_id");
CREATE INDEX "port_code_entry_name_idx" ON "port_code_entry"("name_normalized");
CREATE INDEX "port_code_entry_ascii_name_idx"
ON "port_code_entry"("name_without_diacritics_normalized");

CREATE TABLE "port_name_alias" (
    "id" UUID NOT NULL,
    "port_id" UUID NOT NULL,
    "alias_name" TEXT NOT NULL,
    "normalized_alias" TEXT NOT NULL,
    "language_tag" TEXT NOT NULL,
    "source_system" TEXT NOT NULL,
    "source_version" TEXT NOT NULL,
    "source_record_id" TEXT NOT NULL,
    "mapping_state" TEXT NOT NULL,
    "evidence_ref" TEXT NOT NULL,
    "evidence_hash" CHAR(64) NOT NULL,
    "created_by" TEXT NOT NULL,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "port_name_alias_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "port_name_alias_text_check" CHECK (
      "alias_name" = btrim("alias_name") AND "alias_name" <> '' AND
      "normalized_alias" = btrim("normalized_alias") AND "normalized_alias" <> '' AND
      "language_tag" ~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$' AND
      "source_system" = btrim("source_system") AND "source_system" <> '' AND
      "source_version" = btrim("source_version") AND "source_version" <> '' AND
      "source_record_id" = btrim("source_record_id") AND "source_record_id" <> '' AND
      "evidence_ref" = btrim("evidence_ref") AND "evidence_ref" <> '' AND
      "evidence_hash" ~ '^[0-9a-f]{64}$' AND
      "created_by" = btrim("created_by") AND "created_by" <> ''
    ),
    CONSTRAINT "port_name_alias_state_check" CHECK (
      "mapping_state" IN ('candidate', 'confirmed', 'rejected')
    ),
    CONSTRAINT "port_name_alias_review_check" CHECK (
      ("mapping_state" = 'candidate' AND "reviewed_by" IS NULL AND "reviewed_at" IS NULL) OR
      ("mapping_state" IN ('confirmed', 'rejected') AND "reviewed_by" IS NOT NULL AND "reviewed_at" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "port_name_alias_source_candidate_key"
ON "port_name_alias"("source_system", "source_version", "source_record_id", "normalized_alias", "port_id");
CREATE INDEX "port_name_alias_lookup_idx"
ON "port_name_alias"("normalized_alias", "mapping_state");
CREATE INDEX "port_name_alias_port_state_idx"
ON "port_name_alias"("port_id", "mapping_state");

ALTER TABLE "country_code_reference"
ADD CONSTRAINT "country_code_reference_release_fkey"
FOREIGN KEY ("release_id") REFERENCES "reference_data_release"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "unlocode_area_reference"
ADD CONSTRAINT "unlocode_area_release_fkey"
FOREIGN KEY ("release_id") REFERENCES "reference_data_release"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "unlocode_area_iso_country_fkey"
FOREIGN KEY ("iso_country_id") REFERENCES "country_code_reference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "port_code_reference"
ADD CONSTRAINT "port_code_reference_release_fkey"
FOREIGN KEY ("release_id") REFERENCES "reference_data_release"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "port_code_reference_area_fkey"
FOREIGN KEY ("area_id", "release_id") REFERENCES "unlocode_area_reference"("id", "release_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "port_code_entry"
ADD CONSTRAINT "port_code_entry_port_fkey"
FOREIGN KEY ("port_id", "release_id") REFERENCES "port_code_reference"("id", "release_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "port_name_alias"
ADD CONSTRAINT "port_name_alias_port_fkey"
FOREIGN KEY ("port_id") REFERENCES "port_code_reference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
