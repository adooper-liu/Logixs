-- Shipment rows gain an explicit tenant and an optional logical Product/SKU
-- reference. Historical rows are tenant-backfilled from their owning order;
-- SKU identity is intentionally not guessed.
ALTER TABLE "replenishment_order_line"
ADD COLUMN "tenant_id" TEXT,
ADD COLUMN "product_sku_id" UUID,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

UPDATE "replenishment_order_line" AS line
SET "tenant_id" = orders."tenant_id"
FROM "replenishment_order" AS orders
WHERE orders."id" = line."replenishment_order_id";

ALTER TABLE "replenishment_order_line"
ALTER COLUMN "tenant_id" SET NOT NULL,
ADD CONSTRAINT "replenishment_order_line_tenant_check"
  CHECK (char_length("tenant_id") BETWEEN 1 AND 128 AND "tenant_id" = btrim("tenant_id") AND "tenant_id" !~ '[[:cntrl:]]'),
ADD CONSTRAINT "replenishment_order_line_version_check" CHECK ("version" >= 1);

CREATE UNIQUE INDEX "replenishment_order_id_tenant_key"
ON "replenishment_order"("id", "tenant_id");

CREATE UNIQUE INDEX "container_record_id_tenant_key"
ON "container_record"("id", "tenant_id");

CREATE UNIQUE INDEX "replenishment_order_line_id_tenant_key"
ON "replenishment_order_line"("id", "tenant_id");

CREATE INDEX "replenishment_order_line_sku_current_idx"
ON "replenishment_order_line"("tenant_id", "product_sku_id", "is_current");

ALTER TABLE "replenishment_order_line"
ADD CONSTRAINT "replenishment_order_line_order_tenant_fkey"
FOREIGN KEY ("replenishment_order_id", "tenant_id")
REFERENCES "replenishment_order"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "container_cargo_allocation_set" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "container_record_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "supersedes_set_id" UUID,
    "ingestion_channel" TEXT NOT NULL,
    "source_system" TEXT NOT NULL,
    "evidence_refs" JSONB NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "superseded_at" TIMESTAMPTZ,

    CONSTRAINT "container_cargo_allocation_set_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "container_cargo_set_tenant_check"
      CHECK (char_length("tenant_id") BETWEEN 1 AND 128 AND "tenant_id" = btrim("tenant_id") AND "tenant_id" !~ '[[:cntrl:]]'),
    CONSTRAINT "container_cargo_set_version_check" CHECK ("version" >= 1),
    CONSTRAINT "container_cargo_set_state_check" CHECK ("state" IN ('active', 'superseded')),
    CONSTRAINT "container_cargo_set_supersession_check"
      CHECK (("version" = 1 AND "supersedes_set_id" IS NULL) OR ("version" > 1 AND "supersedes_set_id" IS NOT NULL)),
    CONSTRAINT "container_cargo_set_state_time_check"
      CHECK (("state" = 'active' AND "superseded_at" IS NULL) OR ("state" = 'superseded' AND "superseded_at" IS NOT NULL)),
    CONSTRAINT "container_cargo_set_channel_check"
      CHECK ("ingestion_channel" IN ('api', 'webhook', 'file_import', 'manual_ui')),
    CONSTRAINT "container_cargo_set_source_check"
      CHECK (char_length("source_system") BETWEEN 1 AND 128 AND "source_system" = btrim("source_system") AND "source_system" !~ '[[:cntrl:]]'),
    CONSTRAINT "container_cargo_set_evidence_check"
      CHECK (jsonb_typeof("evidence_refs") = 'array' AND jsonb_array_length("evidence_refs") > 0),
    CONSTRAINT "container_cargo_set_idempotency_check"
      CHECK (char_length("idempotency_key") BETWEEN 1 AND 200 AND "idempotency_key" = btrim("idempotency_key") AND "idempotency_key" !~ '[[:cntrl:]]'),
    CONSTRAINT "container_cargo_set_payload_hash_check" CHECK ("payload_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "container_cargo_set_not_self_superseding_check" CHECK ("supersedes_set_id" IS NULL OR "supersedes_set_id" <> "id")
);

CREATE UNIQUE INDEX "container_cargo_set_id_tenant_key"
ON "container_cargo_allocation_set"("id", "tenant_id");

CREATE UNIQUE INDEX "container_cargo_set_tenant_idempotency_key"
ON "container_cargo_allocation_set"("tenant_id", "idempotency_key");

CREATE UNIQUE INDEX "container_cargo_set_container_version_key"
ON "container_cargo_allocation_set"("container_record_id", "version");

CREATE UNIQUE INDEX "container_cargo_set_supersedes_tenant_key"
ON "container_cargo_allocation_set"("supersedes_set_id", "tenant_id");

CREATE UNIQUE INDEX "container_cargo_set_one_active_key"
ON "container_cargo_allocation_set"("tenant_id", "container_record_id")
WHERE "state" = 'active';

CREATE INDEX "container_cargo_set_active_lookup_idx"
ON "container_cargo_allocation_set"("tenant_id", "container_record_id", "state");

ALTER TABLE "container_cargo_allocation_set"
ADD CONSTRAINT "container_cargo_set_container_fkey"
FOREIGN KEY ("container_record_id", "tenant_id")
REFERENCES "container_record"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "container_cargo_allocation_set"
ADD CONSTRAINT "container_cargo_set_supersedes_fkey"
FOREIGN KEY ("supersedes_set_id", "tenant_id")
REFERENCES "container_cargo_allocation_set"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "container_cargo_allocation" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "allocation_set_id" UUID NOT NULL,
    "replenishment_order_line_id" TEXT NOT NULL,
    "allocated_quantity" DECIMAL(18,3) NOT NULL,
    "quantity_unit" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "container_cargo_allocation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "container_cargo_allocation_tenant_check"
      CHECK (char_length("tenant_id") BETWEEN 1 AND 128 AND "tenant_id" = btrim("tenant_id") AND "tenant_id" !~ '[[:cntrl:]]'),
    CONSTRAINT "container_cargo_allocation_quantity_check" CHECK ("allocated_quantity" > 0),
    CONSTRAINT "container_cargo_allocation_unit_check"
      CHECK (char_length("quantity_unit") BETWEEN 1 AND 32 AND "quantity_unit" = btrim("quantity_unit") AND "quantity_unit" !~ '[[:cntrl:]]')
);

CREATE UNIQUE INDEX "container_cargo_allocation_set_line_key"
ON "container_cargo_allocation"("allocation_set_id", "replenishment_order_line_id");

CREATE INDEX "container_cargo_allocation_line_idx"
ON "container_cargo_allocation"("tenant_id", "replenishment_order_line_id");

ALTER TABLE "container_cargo_allocation"
ADD CONSTRAINT "container_cargo_allocation_set_fkey"
FOREIGN KEY ("allocation_set_id", "tenant_id")
REFERENCES "container_cargo_allocation_set"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "container_cargo_allocation"
ADD CONSTRAINT "container_cargo_allocation_line_fkey"
FOREIGN KEY ("replenishment_order_line_id", "tenant_id")
REFERENCES "replenishment_order_line"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Recovery: older application code can ignore the additive allocation tables
-- and nullable product_sku_id. Do not drop populated allocation sets during
-- rollback; they are append-only evidence of actual loading.
