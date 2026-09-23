-- Expand-only foundation for the approved post-departure Shipment aggregate.
-- Existing container, replenishment, lifecycle and V1 event records keep their meaning.

ALTER TABLE "container_record"
ALTER COLUMN "order_number" DROP NOT NULL,
ADD COLUMN "container_type_code" TEXT,
ADD COLUMN "seal_number" TEXT;

CREATE TABLE "container_source_identity" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "source_system" TEXT NOT NULL,
    "source_record_id" TEXT NOT NULL,
    "container_record_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "container_source_identity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "container_source_identity_source_key"
ON "container_source_identity"("tenant_id", "source_system", "source_record_id");
CREATE INDEX "container_source_identity_container_idx"
ON "container_source_identity"("container_record_id", "tenant_id");

ALTER TABLE "container_source_identity"
ADD CONSTRAINT "container_source_identity_container_record_id_tenant_id_fkey"
FOREIGN KEY ("container_record_id", "tenant_id") REFERENCES "container_record"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "shipment" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "shipment_number" TEXT,
    "source_system" TEXT NOT NULL,
    "source_record_id" TEXT NOT NULL,
    "source_version" TEXT NOT NULL,
    "import_batch_id" TEXT,
    "transport_mode" TEXT NOT NULL,
    "carrier_code" TEXT NOT NULL,
    "vessel_name" TEXT NOT NULL,
    "voyage_number" TEXT NOT NULL,
    "origin_country_code" CHAR(2) NOT NULL,
    "origin_unlocode" TEXT NOT NULL,
    "destination_country_code" CHAR(2) NOT NULL,
    "destination_unlocode" TEXT NOT NULL,
    "final_destination_type" TEXT,
    "final_destination_id" UUID,
    "etd_at" TIMESTAMPTZ,
    "atd_at" TIMESTAMPTZ,
    "eta_at" TIMESTAMPTZ,
    "ata_at" TIMESTAMPTZ,
    "current_lifecycle_status" TEXT NOT NULL,
    "lifecycle_version" INTEGER NOT NULL DEFAULT 1,
    "relationship_version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "shipment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "shipment_transport_mode_check" CHECK ("transport_mode" = 'ocean'),
    CONSTRAINT "shipment_origin_country_check" CHECK ("origin_country_code" ~ '^[A-Z]{2}$'),
    CONSTRAINT "shipment_destination_country_check" CHECK ("destination_country_code" ~ '^[A-Z]{2}$'),
    CONSTRAINT "shipment_origin_unlocode_check" CHECK ("origin_unlocode" ~ '^[A-Z]{2}[A-Z0-9]{3}$'),
    CONSTRAINT "shipment_destination_unlocode_check" CHECK ("destination_unlocode" ~ '^[A-Z]{2}[A-Z0-9]{3}$'),
    CONSTRAINT "shipment_status_check" CHECK (
      "current_lifecycle_status" IN (
        'departed',
        'in_transit',
        'arrived',
        'customs_clearance',
        'released',
        'picked_up',
        'delivered_to_warehouse',
        'closed'
      )
    ),
    CONSTRAINT "shipment_versions_check" CHECK ("lifecycle_version" > 0 AND "relationship_version" > 0)
);

CREATE UNIQUE INDEX "shipment_id_tenant_key" ON "shipment"("id", "tenant_id");
CREATE UNIQUE INDEX "shipment_tenant_number_key" ON "shipment"("tenant_id", "shipment_number");
CREATE UNIQUE INDEX "shipment_source_identity_key" ON "shipment"("tenant_id", "source_system", "source_record_id");
CREATE INDEX "shipment_status_page_idx" ON "shipment"("tenant_id", "current_lifecycle_status", "updated_at", "id");
CREATE INDEX "shipment_carrier_voyage_idx" ON "shipment"("tenant_id", "carrier_code", "voyage_number");
CREATE INDEX "shipment_destination_eta_idx" ON "shipment"("tenant_id", "destination_unlocode", "eta_at");

CREATE TABLE "shipment_handoff_record" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "source_profile" TEXT NOT NULL,
    "ingestion_channel" TEXT NOT NULL,
    "source_system" TEXT NOT NULL,
    "external_handoff_id" TEXT NOT NULL,
    "handoff_version" INTEGER NOT NULL,
    "supersedes_handoff_id" UUID,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "lifecycle_request_json" JSONB,
    "status" TEXT NOT NULL,
    "superseded_at" TIMESTAMPTZ,
    "shipment_id" UUID,
    "actor_id" UUID NOT NULL,
    "trace_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "shipment_handoff_record_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "shipment_handoff_profile_check" CHECK ("source_profile" IN ('legacy_departed_file_v1', 'packing_platform_v1', 'api_v1')),
    CONSTRAINT "shipment_handoff_channel_check" CHECK ("ingestion_channel" IN ('file_import', 'api', 'webhook', 'manual')),
    CONSTRAINT "shipment_handoff_version_check" CHECK ("handoff_version" > 0),
    CONSTRAINT "shipment_handoff_hash_check" CHECK ("payload_hash" ~ '^[a-f0-9]{64}$'),
    CONSTRAINT "shipment_handoff_payload_check" CHECK (jsonb_typeof("payload_json") = 'object'),
    CONSTRAINT "shipment_handoff_lifecycle_request_check" CHECK ("lifecycle_request_json" IS NULL OR jsonb_typeof("lifecycle_request_json") = 'object'),
    CONSTRAINT "shipment_handoff_status_check" CHECK ("status" IN ('received', 'validating', 'accepted', 'review_required', 'rejected', 'superseded')),
    CONSTRAINT "shipment_handoff_superseded_check" CHECK (("status" = 'superseded') = ("superseded_at" IS NOT NULL))
);

CREATE UNIQUE INDEX "shipment_handoff_id_tenant_key" ON "shipment_handoff_record"("id", "tenant_id");
CREATE UNIQUE INDEX "shipment_handoff_source_version_key" ON "shipment_handoff_record"("tenant_id", "source_system", "external_handoff_id", "handoff_version");
CREATE UNIQUE INDEX "shipment_handoff_tenant_idempotency_key" ON "shipment_handoff_record"("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX "shipment_handoff_supersedes_tenant_key" ON "shipment_handoff_record"("supersedes_handoff_id", "tenant_id");
CREATE INDEX "shipment_handoff_status_idx" ON "shipment_handoff_record"("tenant_id", "status", "created_at");
CREATE INDEX "shipment_handoff_shipment_idx" ON "shipment_handoff_record"("shipment_id", "tenant_id");

ALTER TABLE "shipment_handoff_record"
ADD CONSTRAINT "shipment_handoff_record_supersedes_handoff_id_tenant_id_fkey"
FOREIGN KEY ("supersedes_handoff_id", "tenant_id") REFERENCES "shipment_handoff_record"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "shipment_handoff_record_shipment_id_tenant_id_fkey"
FOREIGN KEY ("shipment_id", "tenant_id") REFERENCES "shipment"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "shipment_handoff_object_result" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "handoff_id" UUID NOT NULL,
    "object_type" TEXT NOT NULL,
    "source_ref" TEXT NOT NULL,
    "result_state" TEXT NOT NULL,
    "entity_id" UUID,
    "issue_codes" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_handoff_object_result_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "shipment_handoff_object_type_check" CHECK ("object_type" IN ('container', 'cargo_line', 'transport_document')),
    CONSTRAINT "shipment_handoff_object_state_check" CHECK ("result_state" IN ('accepted', 'duplicate', 'review_required', 'rejected')),
    CONSTRAINT "shipment_handoff_object_issues_check" CHECK (jsonb_typeof("issue_codes") = 'array')
);

CREATE UNIQUE INDEX "shipment_handoff_object_result_key"
ON "shipment_handoff_object_result"("handoff_id", "object_type", "source_ref");
CREATE INDEX "shipment_handoff_object_result_lookup_idx"
ON "shipment_handoff_object_result"("tenant_id", "handoff_id", "object_type");

ALTER TABLE "shipment_handoff_object_result"
ADD CONSTRAINT "shipment_handoff_object_result_handoff_id_tenant_id_fkey"
FOREIGN KEY ("handoff_id", "tenant_id") REFERENCES "shipment_handoff_record"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "shipment_container_link" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "shipment_id" UUID NOT NULL,
    "container_record_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "supersedes_link_id" UUID,
    "source_handoff_id" UUID NOT NULL,
    "evidence_refs" JSONB NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "joined_at" TIMESTAMPTZ NOT NULL,
    "removed_at" TIMESTAMPTZ,
    "superseded_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_container_link_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "shipment_container_link_version_check" CHECK ("version" > 0),
    CONSTRAINT "shipment_container_link_state_check" CHECK ("state" IN ('active', 'removed', 'superseded')),
    CONSTRAINT "shipment_container_link_removed_check" CHECK (("state" = 'removed') = ("removed_at" IS NOT NULL)),
    CONSTRAINT "shipment_container_link_superseded_check" CHECK (("state" = 'superseded') = ("superseded_at" IS NOT NULL)),
    CONSTRAINT "shipment_container_link_evidence_check" CHECK (jsonb_typeof("evidence_refs") = 'array')
);

CREATE UNIQUE INDEX "shipment_container_link_id_tenant_key" ON "shipment_container_link"("id", "tenant_id");
CREATE UNIQUE INDEX "shipment_container_link_id_scope_key" ON "shipment_container_link"("id", "tenant_id", "container_record_id");
CREATE UNIQUE INDEX "shipment_container_link_tenant_idempotency_key" ON "shipment_container_link"("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX "shipment_container_link_version_key" ON "shipment_container_link"("shipment_id", "container_record_id", "version");
CREATE UNIQUE INDEX "shipment_container_link_supersedes_scope_key" ON "shipment_container_link"("supersedes_link_id", "tenant_id", "container_record_id");
CREATE UNIQUE INDEX "shipment_container_link_active_container_key" ON "shipment_container_link"("tenant_id", "container_record_id") WHERE "state" = 'active';
CREATE UNIQUE INDEX "shipment_container_link_active_pair_key" ON "shipment_container_link"("tenant_id", "shipment_id", "container_record_id") WHERE "state" = 'active';
CREATE INDEX "shipment_container_link_shipment_idx" ON "shipment_container_link"("tenant_id", "shipment_id", "state");
CREATE INDEX "shipment_container_link_container_idx" ON "shipment_container_link"("tenant_id", "container_record_id", "state");
CREATE INDEX "shipment_container_link_handoff_idx" ON "shipment_container_link"("source_handoff_id", "tenant_id");

ALTER TABLE "shipment_container_link"
ADD CONSTRAINT "shipment_container_link_shipment_id_tenant_id_fkey"
FOREIGN KEY ("shipment_id", "tenant_id") REFERENCES "shipment"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "shipment_container_link_container_record_id_tenant_id_fkey"
FOREIGN KEY ("container_record_id", "tenant_id") REFERENCES "container_record"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "shipment_container_link_supersedes_link_id_tenant_id_container_record_id_fkey"
FOREIGN KEY ("supersedes_link_id", "tenant_id", "container_record_id") REFERENCES "shipment_container_link"("id", "tenant_id", "container_record_id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "shipment_container_link_source_handoff_id_tenant_id_fkey"
FOREIGN KEY ("source_handoff_id", "tenant_id") REFERENCES "shipment_handoff_record"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "shipment_cargo_line" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "shipment_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_sku_id" UUID,
    "product_number_snapshot" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "quantity_unit" TEXT NOT NULL,
    "package_count" DECIMAL(18,4),
    "package_unit" TEXT,
    "gross_weight" DECIMAL(18,4),
    "weight_unit" TEXT,
    "volume" DECIMAL(18,4),
    "volume_unit" TEXT,
    "destination_id" UUID,
    "replenishment_order_line_id" TEXT,
    "source_handoff_id" UUID NOT NULL,
    "source_line_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "state" TEXT NOT NULL DEFAULT 'active',
    "supersedes_cargo_line_id" UUID,
    "superseded_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "shipment_cargo_line_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "shipment_cargo_line_values_check" CHECK ("line_no" > 0 AND "version" > 0 AND "quantity" > 0),
    CONSTRAINT "shipment_cargo_line_state_check" CHECK ("state" IN ('active', 'superseded')),
    CONSTRAINT "shipment_cargo_line_superseded_check" CHECK (("state" = 'superseded') = ("superseded_at" IS NOT NULL)),
    CONSTRAINT "shipment_cargo_line_package_pair_check" CHECK (("package_count" IS NULL) = ("package_unit" IS NULL)),
    CONSTRAINT "shipment_cargo_line_weight_pair_check" CHECK (("gross_weight" IS NULL) = ("weight_unit" IS NULL)),
    CONSTRAINT "shipment_cargo_line_volume_pair_check" CHECK (("volume" IS NULL) = ("volume_unit" IS NULL)),
    CONSTRAINT "shipment_cargo_line_nonnegative_check" CHECK (COALESCE("package_count", 0) >= 0 AND COALESCE("gross_weight", 0) >= 0 AND COALESCE("volume", 0) >= 0)
);

CREATE UNIQUE INDEX "shipment_cargo_line_id_tenant_key" ON "shipment_cargo_line"("id", "tenant_id");
CREATE UNIQUE INDEX "shipment_cargo_line_id_scope_key" ON "shipment_cargo_line"("id", "tenant_id", "shipment_id");
CREATE UNIQUE INDEX "shipment_cargo_line_number_version_key" ON "shipment_cargo_line"("shipment_id", "version", "line_no");
CREATE UNIQUE INDEX "shipment_cargo_line_source_version_key" ON "shipment_cargo_line"("tenant_id", "shipment_id", "source_line_id", "version");
CREATE UNIQUE INDEX "shipment_cargo_line_supersedes_scope_key" ON "shipment_cargo_line"("supersedes_cargo_line_id", "tenant_id", "shipment_id");
CREATE UNIQUE INDEX "shipment_cargo_line_source_key" ON "shipment_cargo_line"("tenant_id", "source_handoff_id", "source_line_id");
CREATE UNIQUE INDEX "shipment_cargo_line_active_source_key" ON "shipment_cargo_line"("tenant_id", "shipment_id", "source_line_id") WHERE "state" = 'active';
CREATE UNIQUE INDEX "shipment_cargo_line_active_number_key" ON "shipment_cargo_line"("tenant_id", "shipment_id", "line_no") WHERE "state" = 'active';
CREATE INDEX "shipment_cargo_line_active_idx" ON "shipment_cargo_line"("tenant_id", "shipment_id", "state");
CREATE INDEX "shipment_cargo_line_sku_idx" ON "shipment_cargo_line"("tenant_id", "product_sku_id");
CREATE INDEX "shipment_cargo_line_replenishment_idx" ON "shipment_cargo_line"("replenishment_order_line_id", "tenant_id");

ALTER TABLE "shipment_cargo_line"
ADD CONSTRAINT "shipment_cargo_line_shipment_id_tenant_id_fkey"
FOREIGN KEY ("shipment_id", "tenant_id") REFERENCES "shipment"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "shipment_cargo_line_replenishment_order_line_id_tenant_id_fkey"
FOREIGN KEY ("replenishment_order_line_id", "tenant_id") REFERENCES "replenishment_order_line"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "shipment_cargo_line_product_sku_id_tenant_id_fkey"
FOREIGN KEY ("product_sku_id", "tenant_id") REFERENCES "product_sku"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "shipment_cargo_line_source_handoff_id_tenant_id_fkey"
FOREIGN KEY ("source_handoff_id", "tenant_id") REFERENCES "shipment_handoff_record"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "shipment_cargo_line_supersedes_cargo_line_id_tenant_id_shipment_id_fkey"
FOREIGN KEY ("supersedes_cargo_line_id", "tenant_id", "shipment_id") REFERENCES "shipment_cargo_line"("id", "tenant_id", "shipment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "shipment_transport_document" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "shipment_id" UUID NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "scac" TEXT,
    "parent_document_id" UUID,
    "version" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "source_handoff_id" UUID NOT NULL,
    "effective_from" TIMESTAMPTZ NOT NULL,
    "superseded_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_transport_document_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "shipment_document_type_check" CHECK ("document_type" IN ('booking', 'mbl', 'hbl', 'ams')),
    CONSTRAINT "shipment_document_version_check" CHECK ("version" > 0),
    CONSTRAINT "shipment_document_state_check" CHECK ("state" IN ('active', 'superseded', 'revoked')),
    CONSTRAINT "shipment_document_superseded_check" CHECK (("state" = 'active') = ("superseded_at" IS NULL)),
    CONSTRAINT "shipment_document_scac_check" CHECK ("scac" IS NULL OR "scac" ~ '^[A-Z0-9]{2,4}$')
);

CREATE UNIQUE INDEX "shipment_document_id_tenant_key" ON "shipment_transport_document"("id", "tenant_id");
CREATE UNIQUE INDEX "shipment_document_id_scope_key" ON "shipment_transport_document"("id", "tenant_id", "shipment_id");
CREATE UNIQUE INDEX "shipment_document_version_key" ON "shipment_transport_document"("shipment_id", "document_type", "document_number", "version");
CREATE UNIQUE INDEX "shipment_document_active_key" ON "shipment_transport_document"("tenant_id", "shipment_id", "document_type", "document_number") WHERE "state" = 'active';
CREATE INDEX "shipment_document_number_idx" ON "shipment_transport_document"("tenant_id", "document_type", "document_number");
CREATE INDEX "shipment_document_handoff_idx" ON "shipment_transport_document"("source_handoff_id", "tenant_id");

ALTER TABLE "shipment_transport_document"
ADD CONSTRAINT "shipment_transport_document_shipment_id_tenant_id_fkey"
FOREIGN KEY ("shipment_id", "tenant_id") REFERENCES "shipment"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "shipment_transport_document_parent_document_id_tenant_id_shipment_id_fkey"
FOREIGN KEY ("parent_document_id", "tenant_id", "shipment_id") REFERENCES "shipment_transport_document"("id", "tenant_id", "shipment_id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "shipment_transport_document_source_handoff_id_tenant_id_fkey"
FOREIGN KEY ("source_handoff_id", "tenant_id") REFERENCES "shipment_handoff_record"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "shipment_container_document_link" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "shipment_id" UUID NOT NULL,
    "container_record_id" TEXT NOT NULL,
    "shipment_container_link_id" UUID NOT NULL,
    "transport_document_id" UUID NOT NULL,
    "source_handoff_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_container_document_link_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shipment_container_document_link_key"
ON "shipment_container_document_link"("tenant_id", "shipment_container_link_id", "transport_document_id");
CREATE INDEX "shipment_container_document_document_idx"
ON "shipment_container_document_link"("tenant_id", "transport_document_id");
CREATE INDEX "shipment_container_document_handoff_idx"
ON "shipment_container_document_link"("source_handoff_id", "tenant_id");

ALTER TABLE "shipment_container_document_link"
ADD CONSTRAINT "shipment_container_document_container_record_id_tenant_id_fkey"
FOREIGN KEY ("container_record_id", "tenant_id") REFERENCES "container_record"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "shipment_container_document_link_id_tenant_id_container_record_id_fkey"
FOREIGN KEY ("shipment_container_link_id", "tenant_id", "container_record_id") REFERENCES "shipment_container_link"("id", "tenant_id", "container_record_id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "shipment_container_document_document_id_tenant_id_shipment_id_fkey"
FOREIGN KEY ("transport_document_id", "tenant_id", "shipment_id") REFERENCES "shipment_transport_document"("id", "tenant_id", "shipment_id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "shipment_container_document_source_handoff_id_tenant_id_fkey"
FOREIGN KEY ("source_handoff_id", "tenant_id") REFERENCES "shipment_handoff_record"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "shipment_upstream_reference" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "shipment_id" UUID NOT NULL,
    "container_record_id" TEXT NOT NULL,
    "shipment_cargo_line_id" UUID,
    "reference_type" TEXT NOT NULL,
    "source_system" TEXT NOT NULL,
    "source_record_id" TEXT NOT NULL,
    "source_version" TEXT,
    "source_line_id" TEXT,
    "metadata" JSONB,
    "source_handoff_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "state" TEXT NOT NULL DEFAULT 'active',
    "supersedes_reference_id" UUID,
    "superseded_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_upstream_reference_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "shipment_upstream_reference_type_check" CHECK ("reference_type" IN ('shipping_plan', 'stocking_order', 'packing_order', 'purchase_order')),
    CONSTRAINT "shipment_upstream_reference_version_check" CHECK ("version" > 0),
    CONSTRAINT "shipment_upstream_reference_state_check" CHECK ("state" IN ('active', 'superseded')),
    CONSTRAINT "shipment_upstream_reference_superseded_check" CHECK (("state" = 'superseded') = ("superseded_at" IS NOT NULL)),
    CONSTRAINT "shipment_upstream_reference_metadata_check" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object')
);

CREATE UNIQUE INDEX "shipment_upstream_reference_id_scope_key" ON "shipment_upstream_reference"("id", "tenant_id", "shipment_id");
CREATE UNIQUE INDEX "shipment_upstream_reference_source_version_key" ON "shipment_upstream_reference"("tenant_id", "shipment_id", "container_record_id", "reference_type", "source_system", "source_record_id", "source_line_id", "version") NULLS NOT DISTINCT;
CREATE UNIQUE INDEX "shipment_upstream_reference_supersedes_scope_key" ON "shipment_upstream_reference"("supersedes_reference_id", "tenant_id", "shipment_id");
CREATE UNIQUE INDEX "shipment_upstream_reference_active_source_key" ON "shipment_upstream_reference"("tenant_id", "shipment_id", "container_record_id", "reference_type", "source_system", "source_record_id", "source_line_id") NULLS NOT DISTINCT WHERE "state" = 'active';
CREATE INDEX "shipment_upstream_reference_active_idx" ON "shipment_upstream_reference"("tenant_id", "shipment_id", "state");
CREATE INDEX "shipment_upstream_reference_lookup_idx" ON "shipment_upstream_reference"("tenant_id", "reference_type", "source_record_id");
CREATE INDEX "shipment_upstream_reference_cargo_idx" ON "shipment_upstream_reference"("shipment_cargo_line_id", "tenant_id");
CREATE INDEX "shipment_upstream_reference_handoff_idx" ON "shipment_upstream_reference"("source_handoff_id", "tenant_id");

ALTER TABLE "shipment_upstream_reference"
ADD CONSTRAINT "shipment_upstream_reference_shipment_id_tenant_id_fkey"
FOREIGN KEY ("shipment_id", "tenant_id") REFERENCES "shipment"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "shipment_upstream_reference_container_record_id_tenant_id_fkey"
FOREIGN KEY ("container_record_id", "tenant_id") REFERENCES "container_record"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "shipment_upstream_reference_shipment_cargo_line_id_tenant_id_shipment_id_fkey"
FOREIGN KEY ("shipment_cargo_line_id", "tenant_id", "shipment_id") REFERENCES "shipment_cargo_line"("id", "tenant_id", "shipment_id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "shipment_upstream_reference_source_handoff_id_tenant_id_fkey"
FOREIGN KEY ("source_handoff_id", "tenant_id") REFERENCES "shipment_handoff_record"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "shipment_upstream_reference_supersedes_reference_id_tenant_id_shipment_id_fkey"
FOREIGN KEY ("supersedes_reference_id", "tenant_id", "shipment_id") REFERENCES "shipment_upstream_reference"("id", "tenant_id", "shipment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Compatibility expansion: an allocation references exactly one legacy
-- replenishment line or one new Shipment cargo line during dual-write.
ALTER TABLE "container_cargo_allocation"
ALTER COLUMN "replenishment_order_line_id" DROP NOT NULL,
ALTER COLUMN "allocated_quantity" TYPE DECIMAL(18,4),
ADD COLUMN "shipment_cargo_line_id" UUID,
ADD COLUMN "package_count" DECIMAL(18,4),
ADD COLUMN "package_unit" TEXT,
ADD COLUMN "gross_weight" DECIMAL(18,4),
ADD COLUMN "weight_unit" TEXT,
ADD COLUMN "volume" DECIMAL(18,4),
ADD COLUMN "volume_unit" TEXT;

ALTER TABLE "container_cargo_allocation"
ADD CONSTRAINT "container_cargo_allocation_line_reference_check"
CHECK (("replenishment_order_line_id" IS NOT NULL) <> ("shipment_cargo_line_id" IS NOT NULL)),
ADD CONSTRAINT "container_cargo_allocation_package_pair_check"
CHECK (("package_count" IS NULL) = ("package_unit" IS NULL)),
ADD CONSTRAINT "container_cargo_allocation_weight_pair_check"
CHECK (("gross_weight" IS NULL) = ("weight_unit" IS NULL)),
ADD CONSTRAINT "container_cargo_allocation_volume_pair_check"
CHECK (("volume" IS NULL) = ("volume_unit" IS NULL)),
ADD CONSTRAINT "container_cargo_allocation_nonnegative_check"
CHECK ("allocated_quantity" > 0 AND COALESCE("package_count", 0) >= 0 AND COALESCE("gross_weight", 0) >= 0 AND COALESCE("volume", 0) >= 0),
ADD CONSTRAINT "container_cargo_allocation_shipment_cargo_line_id_tenant_id_fkey"
FOREIGN KEY ("shipment_cargo_line_id", "tenant_id") REFERENCES "shipment_cargo_line"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "container_cargo_allocation_set_shipment_line_key"
ON "container_cargo_allocation"("allocation_set_id", "shipment_cargo_line_id")
WHERE "shipment_cargo_line_id" IS NOT NULL;
CREATE INDEX "container_cargo_allocation_shipment_line_idx"
ON "container_cargo_allocation"("tenant_id", "shipment_cargo_line_id");

-- Versioned post-departure flow metadata. Existing flows retain their original
-- 14-node meaning under the explicit legacy definition.
ALTER TABLE "flow_instance"
ADD COLUMN "definition_code" TEXT NOT NULL DEFAULT 'legacy_full_container',
ADD COLUMN "definition_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "shipment_id" UUID,
ADD COLUMN "shipment_relationship_version" INTEGER;

ALTER TABLE "flow_instance"
ADD CONSTRAINT "flow_instance_definition_check"
CHECK (
  ("definition_code" = 'legacy_full_container' AND "shipment_id" IS NULL AND "shipment_relationship_version" IS NULL)
  OR
  ("definition_code" = 'post_departure_ocean' AND "definition_version" = 1 AND "shipment_id" IS NOT NULL AND "shipment_relationship_version" > 0)
),
ADD CONSTRAINT "flow_instance_shipment_id_fkey"
FOREIGN KEY ("shipment_id") REFERENCES "shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "flow_instance_shipment_scope_idx"
ON "flow_instance"("shipment_id", "shipment_relationship_version");

-- Canonical Event V2 adds an explicit subject and permits one Shipment event to
-- target a frozen set of containers. V1 rows remain container-scoped.
ALTER TABLE "canonical_event"
ALTER COLUMN "container_id" DROP NOT NULL,
ADD COLUMN "tenant_id" TEXT,
ADD COLUMN "subject_type" TEXT,
ADD COLUMN "subject_id" TEXT,
ADD COLUMN "subject_version" INTEGER,
ADD COLUMN "scope_version" INTEGER,
ADD COLUMN "event_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "domain_fact_type" TEXT,
ADD COLUMN "domain" TEXT,
ADD COLUMN "role" TEXT,
ADD COLUMN "event_sequence" INTEGER,
ADD COLUMN "source" JSONB,
ADD COLUMN "confidence_state" TEXT,
ADD COLUMN "validity" TEXT,
ADD COLUMN "data" JSONB,
ADD COLUMN "correlation_id" UUID,
ADD COLUMN "causation_id" UUID,
ADD COLUMN "trace_id" TEXT,
ADD COLUMN "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "canonical_event" AS event
SET
  "tenant_id" = container."tenant_id",
  "subject_type" = 'container',
  "subject_id" = event."container_id",
  "subject_version" = 1,
  "domain_fact_type" = CASE
    WHEN event."domain_fact_id" IS NOT NULL THEN 'lifecycle_date_fact'
    ELSE NULL
  END
FROM "container_record" AS container
WHERE container."id" = event."container_id";

ALTER TABLE "canonical_event"
DROP CONSTRAINT "canonical_event_domain_fact_id_fkey";

ALTER TABLE "canonical_event"
ADD CONSTRAINT "canonical_event_version_check" CHECK ("event_version" IN (1, 2)),
ADD CONSTRAINT "canonical_event_v2_shape_check" CHECK (
  "event_version" = 1
  OR (
    "tenant_id" IS NOT NULL
    AND "subject_type" IN ('shipment', 'container')
    AND length("subject_id") BETWEEN 1 AND 100
    AND "subject_version" > 0
    AND ("subject_type" <> 'shipment' OR "scope_version" > 0)
    AND length("domain_fact_type") BETWEEN 1 AND 64
    AND length("domain") BETWEEN 1 AND 64
    AND "role" IN ('milestone', 'evidence', 'exception', 'prerequisite')
    AND "event_sequence" > 0
    AND jsonb_typeof("source") = 'object'
    AND "confidence_state" IN ('confirmed', 'provisional', 'disputed', 'unknown')
    AND "validity" IN ('effective', 'superseded', 'corrected', 'revoked')
    AND jsonb_typeof("data") = 'object'
    AND "correlation_id" IS NOT NULL
    AND length("trace_id") BETWEEN 1 AND 128
  )
),
ADD CONSTRAINT "canonical_event_subject_container_check" CHECK (
  "event_version" = 1
  OR ("subject_type" = 'container' AND "container_id" = "subject_id")
  OR ("subject_type" = 'shipment' AND "container_id" IS NULL)
);

CREATE INDEX "canonical_event_subject_occurred_idx"
ON "canonical_event"("tenant_id", "subject_type", "subject_id", "occurred_at", "id");

CREATE OR REPLACE FUNCTION "validate_canonical_event_domain_fact"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."domain_fact_id" IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW."domain_fact_type" = 'lifecycle_date_fact' THEN
    IF NOT EXISTS (SELECT 1 FROM "lifecycle_date_fact" WHERE "id" = NEW."domain_fact_id") THEN
      RAISE EXCEPTION 'canonical event lifecycle date fact does not exist';
    END IF;
  ELSIF NEW."domain_fact_type" = 'shipment_handoff' THEN
    IF NOT EXISTS (SELECT 1 FROM "shipment_handoff_record" WHERE "id"::text = NEW."domain_fact_id") THEN
      RAISE EXCEPTION 'canonical event shipment handoff does not exist';
    END IF;
  ELSE
    RAISE EXCEPTION 'canonical event domain fact type is unsupported';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path FROM CURRENT;

CREATE CONSTRAINT TRIGGER "canonical_event_domain_fact_exists"
AFTER INSERT OR UPDATE OF "domain_fact_id", "domain_fact_type" ON "canonical_event"
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION "validate_canonical_event_domain_fact"();

CREATE TABLE "canonical_event_scope_member" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "container_record_id" TEXT NOT NULL,
    "shipment_container_link_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_event_scope_member_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "canonical_event_scope_member_key"
ON "canonical_event_scope_member"("event_id", "container_record_id");
CREATE INDEX "canonical_event_scope_container_idx"
ON "canonical_event_scope_member"("tenant_id", "container_record_id", "event_id");

ALTER TABLE "canonical_event_scope_member"
ADD CONSTRAINT "canonical_event_scope_member_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "canonical_event"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "canonical_event_scope_member_container_record_id_tenant_id_fkey"
FOREIGN KEY ("container_record_id", "tenant_id") REFERENCES "container_record"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "canonical_event_scope_member_link_scope_fkey"
FOREIGN KEY ("shipment_container_link_id", "tenant_id", "container_record_id") REFERENCES "shipment_container_link"("id", "tenant_id", "container_record_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "shipment_event_application" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "shipment_id" UUID NOT NULL,
    "event_id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "previous_status" TEXT NOT NULL,
    "resulting_status" TEXT NOT NULL,
    "aggregation_rule" TEXT NOT NULL,
    "rule_version" INTEGER NOT NULL,
    "guard_results" JSONB NOT NULL,
    "projection_version" INTEGER NOT NULL,
    "applied_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_event_application_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "shipment_event_application_state_check" CHECK ("state" IN ('applied', 'rejected')),
    CONSTRAINT "shipment_event_application_rule_check" CHECK ("rule_version" > 0 AND "projection_version" > 0),
    CONSTRAINT "shipment_event_application_guards_check" CHECK (jsonb_typeof("guard_results") = 'array')
);

CREATE UNIQUE INDEX "shipment_event_application_event_key"
ON "shipment_event_application"("event_id");
CREATE UNIQUE INDEX "shipment_event_application_projection_key"
ON "shipment_event_application"("shipment_id", "projection_version");
CREATE INDEX "shipment_event_application_shipment_idx"
ON "shipment_event_application"("tenant_id", "shipment_id", "applied_at");

ALTER TABLE "shipment_event_application"
ADD CONSTRAINT "shipment_event_application_shipment_id_tenant_id_fkey"
FOREIGN KEY ("shipment_id", "tenant_id") REFERENCES "shipment"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "shipment_event_application_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "canonical_event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Verification after deploy:
-- 1. Composite foreign keys reject every cross-tenant Shipment relationship.
-- 2. The partial active-container index rejects one container instance in two active Shipments.
-- 3. Handoff source/version and idempotency identities reject conflicting duplicates.
-- 4. Cargo quantities are positive and optional quantity/unit pairs are complete.
-- 5. Existing replenishment allocations remain valid and reference exactly their legacy line.
-- 6. post_departure_ocean flows contain only origin_departure through empty_return.
-- 7. Shipment V2 events have one frozen scope member per active container link.
-- Recovery: this is an expand migration. Older applications ignore the new tables and columns.
-- Keep populated rows on application rollback; dropping them loses accepted Shipment facts and is
-- only permitted after exporting handoff payload hashes, links, cargo, documents and references.
