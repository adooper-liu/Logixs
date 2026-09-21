CREATE TABLE "container_dispatch_snapshot" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "container_record_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "state" TEXT NOT NULL,
  "supersedes_snapshot_id" UUID,
  "stuffing_snapshot_id" UUID NOT NULL,
  "stuffing_snapshot_version" INTEGER NOT NULL,
  "booking_number" TEXT NOT NULL,
  "carrier_code" TEXT NOT NULL,
  "vessel_name" TEXT NOT NULL,
  "voyage_number" TEXT NOT NULL,
  "master_bill_number" TEXT,
  "house_bill_number" TEXT,
  "vgm_handoff_state" TEXT NOT NULL,
  "ingestion_channel" TEXT NOT NULL,
  "source_system" TEXT NOT NULL,
  "evidence_refs" JSONB NOT NULL,
  "actor_id" TEXT NOT NULL,
  "reason_code" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "superseded_at" TIMESTAMPTZ,
  CONSTRAINT "container_dispatch_snapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "container_dispatch_snapshot_version_check" CHECK ("version" > 0),
  CONSTRAINT "container_dispatch_snapshot_stuffing_version_check" CHECK ("stuffing_snapshot_version" > 0),
  CONSTRAINT "container_dispatch_snapshot_state_check" CHECK ("state" IN ('active', 'superseded')),
  CONSTRAINT "container_dispatch_snapshot_vgm_state_check" CHECK ("vgm_handoff_state" = 'accepted'),
  CONSTRAINT "container_dispatch_snapshot_evidence_check" CHECK (jsonb_typeof("evidence_refs") = 'array' AND jsonb_array_length("evidence_refs") > 0)
);

CREATE UNIQUE INDEX "container_dispatch_snapshot_id_tenant_key" ON "container_dispatch_snapshot"("id", "tenant_id");
CREATE UNIQUE INDEX "container_dispatch_snapshot_id_scope_key" ON "container_dispatch_snapshot"("id", "tenant_id", "container_record_id");
CREATE UNIQUE INDEX "container_dispatch_snapshot_tenant_idempotency_key" ON "container_dispatch_snapshot"("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX "container_dispatch_snapshot_container_version_key" ON "container_dispatch_snapshot"("container_record_id", "version");
CREATE UNIQUE INDEX "container_dispatch_snapshot_supersedes_scope_key" ON "container_dispatch_snapshot"("supersedes_snapshot_id", "tenant_id", "container_record_id");
CREATE INDEX "container_dispatch_snapshot_active_lookup_idx" ON "container_dispatch_snapshot"("tenant_id", "container_record_id", "state");
CREATE INDEX "container_dispatch_snapshot_stuffing_idx" ON "container_dispatch_snapshot"("tenant_id", "stuffing_snapshot_id");

CREATE UNIQUE INDEX "container_dispatch_snapshot_one_active_key" ON "container_dispatch_snapshot"("tenant_id", "container_record_id") WHERE "state" = 'active';

ALTER TABLE "container_dispatch_snapshot" ADD CONSTRAINT "container_dispatch_snapshot_container_fkey" FOREIGN KEY ("container_record_id", "tenant_id") REFERENCES "container_record"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "container_dispatch_snapshot" ADD CONSTRAINT "container_dispatch_snapshot_stuffing_fkey" FOREIGN KEY ("stuffing_snapshot_id", "tenant_id", "container_record_id") REFERENCES "container_stuffing_snapshot"("id", "tenant_id", "container_record_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "container_dispatch_snapshot" ADD CONSTRAINT "container_dispatch_snapshot_supersedes_fkey" FOREIGN KEY ("supersedes_snapshot_id", "tenant_id", "container_record_id") REFERENCES "container_dispatch_snapshot"("id", "tenant_id", "container_record_id") ON DELETE RESTRICT ON UPDATE CASCADE;
