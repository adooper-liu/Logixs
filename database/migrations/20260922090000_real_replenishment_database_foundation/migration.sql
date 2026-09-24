-- Complete the approved V1.1 replenishment-line snapshot fields and enforce
-- tenant scope on the legacy container-to-order compatibility reference.

ALTER TABLE "replenishment_order_line"
ADD COLUMN "contains_battery" BOOLEAN,
ADD COLUMN "contains_refrigerant" BOOLEAN,
ADD COLUMN "phytosanitary_required" BOOLEAN,
ADD COLUMN "commodity_inspection_required" BOOLEAN,
ADD COLUMN "domestic_markup_amount" DECIMAL(18,4),
ADD COLUMN "domestic_markup_currency" TEXT,
ADD COLUMN "replenishment_fob_unit_price" DECIMAL(18,4),
ADD COLUMN "replenishment_fob_currency" TEXT,
ADD COLUMN "negotiation_fob_unit_price" DECIMAL(18,4),
ADD COLUMN "negotiation_fob_currency" TEXT;

ALTER TABLE "replenishment_order_line"
ADD CONSTRAINT "replenishment_order_line_domestic_markup_pair_check"
  CHECK (("domestic_markup_amount" IS NULL) = ("domestic_markup_currency" IS NULL)),
ADD CONSTRAINT "replenishment_order_line_domestic_markup_currency_check"
  CHECK ("domestic_markup_currency" IS NULL OR "domestic_markup_currency" ~ '^[A-Z]{3}$'),
ADD CONSTRAINT "replenishment_order_line_replenishment_fob_pair_check"
  CHECK (("replenishment_fob_unit_price" IS NULL) = ("replenishment_fob_currency" IS NULL)),
ADD CONSTRAINT "replenishment_order_line_replenishment_fob_currency_check"
  CHECK ("replenishment_fob_currency" IS NULL OR "replenishment_fob_currency" ~ '^[A-Z]{3}$'),
ADD CONSTRAINT "replenishment_order_line_negotiation_fob_pair_check"
  CHECK (("negotiation_fob_unit_price" IS NULL) = ("negotiation_fob_currency" IS NULL)),
ADD CONSTRAINT "replenishment_order_line_negotiation_fob_currency_check"
  CHECK ("negotiation_fob_currency" IS NULL OR "negotiation_fob_currency" ~ '^[A-Z]{3}$');

-- The tenant-composite order FK was added in the cargo-allocation migration.
-- Remove the older single-column FK so the physical relation has one authority.
ALTER TABLE "replenishment_order_line"
DROP CONSTRAINT "replenishment_order_line_replenishment_order_id_fkey";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "container_record" AS container
    JOIN "replenishment_order" AS orders
      ON orders."id" = container."replenishment_order_id"
    WHERE container."replenishment_order_id" IS NOT NULL
      AND container."tenant_id" <> orders."tenant_id"
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'container_record contains cross-tenant replenishment_order references';
  END IF;
END $$;

ALTER TABLE "container_record"
DROP CONSTRAINT "container_record_replenishment_order_id_fkey";

ALTER TABLE "container_record"
ADD CONSTRAINT "container_record_replenishment_order_tenant_fkey"
FOREIGN KEY ("replenishment_order_id", "tenant_id")
REFERENCES "replenishment_order"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Import resolution prefers a known container number so another order can
-- reuse the same physical container record. This is intentionally non-unique:
-- container numbers can be reused across transport instances.
CREATE INDEX "container_record_tenant_number_idx"
ON "container_record"("tenant_id", "container_number");

-- Verification after deploy:
-- 1. No amount may exist without its currency (or vice versa), and currencies
--    must be uppercase ISO-4217-shaped codes.
-- 2. A container cannot reference an order owned by another tenant.
-- 3. Container/order N:M remains authoritative through cargo allocations; the
--    singular container reference is only a backward-compatible import anchor.
-- 4. Existing replenishment lines remain unchanged; all new fields are nullable.
-- Recovery: older applications ignore the additive columns. Keep populated
-- values during application rollback. The composite FK may be reverted only
-- after verifying no cross-tenant references and preserving tenant validation
-- in the write path.
