-- Expand shipment-registry with a tenant-scoped replenishment-order identity and
-- auditable product-line versions. The container 1:1 contract remains deferred
-- until legacy duplicate containers have been reviewed.

-- AlterTable
ALTER TABLE "import_batch"
ADD COLUMN "confirmed_quantity_unit" TEXT;

-- Idempotency keys are tenant scoped; a key from one tenant must not block another.
DROP INDEX "import_batch_idempotency_key_key";
CREATE UNIQUE INDEX "import_batch_tenant_idempotency_key"
ON "import_batch"("tenant_id", "idempotency_key");

-- CreateTable
CREATE TABLE "replenishment_order" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "replenishment_order_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "replenishment_order_tenant_order_key"
ON "replenishment_order"("tenant_id", "order_number");

-- Backfill one identity row per tenant/order without guessing product details.
INSERT INTO "replenishment_order" (
    "id", "tenant_id", "order_number", "created_at", "updated_at"
)
SELECT
    'legacy-' || md5("tenant_id" || chr(31) || "order_number"),
    "tenant_id",
    "order_number",
    MIN("created_at"),
    MAX("updated_at")
FROM "container_record"
GROUP BY "tenant_id", "order_number";

-- AlterTable
ALTER TABLE "container_record"
ADD COLUMN "replenishment_order_id" TEXT;

UPDATE "container_record" AS container
SET "replenishment_order_id" = orders."id"
FROM "replenishment_order" AS orders
WHERE orders."tenant_id" = container."tenant_id"
  AND orders."order_number" = container."order_number";

CREATE INDEX "container_record_replenishment_order_id_idx"
ON "container_record"("replenishment_order_id");

ALTER TABLE "container_record"
ADD CONSTRAINT "container_record_replenishment_order_id_fkey"
FOREIGN KEY ("replenishment_order_id") REFERENCES "replenishment_order"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "replenishment_order_line" (
    "id" TEXT NOT NULL,
    "replenishment_order_id" TEXT NOT NULL,
    "product_number" TEXT NOT NULL,
    "shipped_quantity" DECIMAL(18,3) NOT NULL,
    "quantity_unit" TEXT NOT NULL,
    "contract_number" TEXT,
    "source_batch_id" TEXT NOT NULL,
    "source_row_id" TEXT NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "superseded_by_batch_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "replenishment_order_line_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "replenishment_order_line_positive_quantity_check"
      CHECK ("shipped_quantity" > 0),
    CONSTRAINT "replenishment_order_line_quantity_unit_check"
      CHECK ("quantity_unit" IN ('piece', 'carton', 'set', 'pallet'))
);

CREATE UNIQUE INDEX "replenishment_order_line_source_key"
ON "replenishment_order_line"("source_batch_id", "source_row_id");

CREATE INDEX "replenishment_order_line_current_idx"
ON "replenishment_order_line"("replenishment_order_id", "is_current");

ALTER TABLE "replenishment_order_line"
ADD CONSTRAINT "replenishment_order_line_replenishment_order_id_fkey"
FOREIGN KEY ("replenishment_order_id") REFERENCES "replenishment_order"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Verification after deploy:
-- SELECT COUNT(*) FROM container_record WHERE replenishment_order_id IS NULL;
-- SELECT tenant_id, order_number, COUNT(*) FROM replenishment_order GROUP BY 1,2 HAVING COUNT(*) > 1;
-- Recovery is additive: drop the new line/order tables and nullable link only if no
-- post-migration imports have executed; otherwise restore from backup and replay.
