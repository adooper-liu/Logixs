CREATE TABLE "container_stuffing_snapshot" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "container_record_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "state" TEXT NOT NULL,
  "supersedes_snapshot_id" UUID,
  "allocation_set_id" UUID NOT NULL,
  "allocation_set_version" INTEGER NOT NULL,
  "container_number" TEXT NOT NULL,
  "seal_number" TEXT NOT NULL,
  "package_count" INTEGER NOT NULL,
  "gross_weight" NUMERIC(18,3) NOT NULL,
  "gross_weight_unit" TEXT NOT NULL,
  "net_weight" NUMERIC(18,3),
  "volume" NUMERIC(18,3) NOT NULL,
  "volume_unit" TEXT NOT NULL,
  "vgm_weight" NUMERIC(18,3),
  "vgm_weight_unit" TEXT,
  "vgm_method" TEXT,
  "vgm_verified_at" TIMESTAMPTZ,
  "ingestion_channel" TEXT NOT NULL,
  "source_system" TEXT NOT NULL,
  "evidence_refs" JSONB NOT NULL,
  "actor_id" TEXT NOT NULL,
  "reason_code" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "superseded_at" TIMESTAMPTZ,

  CONSTRAINT "container_stuffing_snapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "container_stuffing_snapshot_version_check" CHECK ("version" > 0),
  CONSTRAINT "container_stuffing_snapshot_allocation_version_check" CHECK ("allocation_set_version" > 0),
  CONSTRAINT "container_stuffing_snapshot_state_check" CHECK ("state" IN ('active', 'superseded')),
  CONSTRAINT "container_stuffing_snapshot_state_time_check" CHECK (("state" = 'active' AND "superseded_at" IS NULL) OR ("state" = 'superseded' AND "superseded_at" IS NOT NULL)),
  CONSTRAINT "container_stuffing_snapshot_container_number_check" CHECK ("container_number" ~ '^[A-Z]{4}[0-9]{7}$'),
  CONSTRAINT "container_stuffing_snapshot_seal_check" CHECK (length("seal_number") BETWEEN 1 AND 64),
  CONSTRAINT "container_stuffing_snapshot_package_count_check" CHECK ("package_count" > 0 AND "package_count" <= 10000000),
  CONSTRAINT "container_stuffing_snapshot_gross_weight_check" CHECK ("gross_weight" > 0 AND "gross_weight_unit" = 'KGM'),
  CONSTRAINT "container_stuffing_snapshot_net_weight_check" CHECK ("net_weight" IS NULL OR ("net_weight" > 0 AND "net_weight" <= "gross_weight")),
  CONSTRAINT "container_stuffing_snapshot_volume_check" CHECK ("volume" > 0 AND "volume_unit" = 'MTQ'),
  CONSTRAINT "container_stuffing_snapshot_vgm_pair_check" CHECK (
    ("vgm_weight" IS NULL AND "vgm_weight_unit" IS NULL AND "vgm_method" IS NULL AND "vgm_verified_at" IS NULL)
    OR
    ("vgm_weight" IS NOT NULL AND "vgm_weight_unit" IS NOT NULL AND "vgm_method" IS NOT NULL AND "vgm_verified_at" IS NOT NULL)
  ),
  CONSTRAINT "container_stuffing_snapshot_vgm_value_check" CHECK ("vgm_weight" IS NULL OR ("vgm_weight" >= "gross_weight" AND "vgm_weight_unit" = 'KGM')),
  CONSTRAINT "container_stuffing_snapshot_vgm_method_check" CHECK ("vgm_method" IS NULL OR "vgm_method" IN ('method_1', 'method_2')),
  CONSTRAINT "container_stuffing_snapshot_ingestion_check" CHECK ("ingestion_channel" IN ('api', 'webhook', 'file_import', 'manual_ui')),
  CONSTRAINT "container_stuffing_snapshot_evidence_check" CHECK (jsonb_typeof("evidence_refs") = 'array' AND jsonb_array_length("evidence_refs") > 0),
  CONSTRAINT "container_stuffing_snapshot_payload_hash_check" CHECK ("payload_hash" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "container_stuffing_snapshot_id_tenant_key"
ON "container_stuffing_snapshot"("id", "tenant_id");
CREATE UNIQUE INDEX "container_stuffing_snapshot_id_scope_key"
ON "container_stuffing_snapshot"("id", "tenant_id", "container_record_id");
CREATE UNIQUE INDEX "container_cargo_set_id_scope_key"
ON "container_cargo_allocation_set"("id", "tenant_id", "container_record_id");
CREATE UNIQUE INDEX "container_stuffing_snapshot_tenant_idempotency_key"
ON "container_stuffing_snapshot"("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX "container_stuffing_snapshot_container_version_key"
ON "container_stuffing_snapshot"("container_record_id", "version");
CREATE UNIQUE INDEX "container_stuffing_snapshot_supersedes_scope_key"
ON "container_stuffing_snapshot"("supersedes_snapshot_id", "tenant_id", "container_record_id");
CREATE UNIQUE INDEX "container_stuffing_snapshot_one_active_key"
ON "container_stuffing_snapshot"("tenant_id", "container_record_id") WHERE "state" = 'active';
CREATE INDEX "container_stuffing_snapshot_active_lookup_idx"
ON "container_stuffing_snapshot"("tenant_id", "container_record_id", "state");
CREATE INDEX "container_stuffing_snapshot_allocation_idx"
ON "container_stuffing_snapshot"("tenant_id", "allocation_set_id");

ALTER TABLE "container_stuffing_snapshot"
ADD CONSTRAINT "container_stuffing_snapshot_container_fkey"
FOREIGN KEY ("container_record_id", "tenant_id")
REFERENCES "container_record"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "container_stuffing_snapshot"
ADD CONSTRAINT "container_stuffing_snapshot_allocation_fkey"
FOREIGN KEY ("allocation_set_id", "tenant_id", "container_record_id")
REFERENCES "container_cargo_allocation_set"("id", "tenant_id", "container_record_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "container_stuffing_snapshot"
ADD CONSTRAINT "container_stuffing_snapshot_supersedes_fkey"
FOREIGN KEY ("supersedes_snapshot_id", "tenant_id", "container_record_id")
REFERENCES "container_stuffing_snapshot"("id", "tenant_id", "container_record_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Recovery: older application versions ignore this additive table. Preserve any
-- recorded snapshots as audit history; stop new writes instead of deleting them.
