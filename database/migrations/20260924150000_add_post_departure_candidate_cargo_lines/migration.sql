CREATE TABLE "post_departure_source_candidate_cargo_line" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "correction_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL,
    "source_line_id" TEXT NOT NULL,
    "replenishment_order_number" TEXT NOT NULL,
    "product_sku_id" UUID NOT NULL,
    "product_number" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "quantity_unit" TEXT NOT NULL,
    "replenishment_order_line_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_departure_source_candidate_cargo_line_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "post_departure_candidate_cargo_line_number_check" CHECK ("line_number" >= 1),
    CONSTRAINT "post_departure_candidate_cargo_source_line_check" CHECK (length(btrim("source_line_id")) BETWEEN 1 AND 200),
    CONSTRAINT "post_departure_candidate_cargo_order_check" CHECK (length(btrim("replenishment_order_number")) BETWEEN 1 AND 100),
    CONSTRAINT "post_departure_candidate_cargo_product_check" CHECK (length(btrim("product_number")) BETWEEN 1 AND 200),
    CONSTRAINT "post_departure_candidate_cargo_quantity_check" CHECK ("quantity" > 0),
    CONSTRAINT "post_departure_candidate_cargo_unit_check" CHECK ("quantity_unit" IN ('piece', 'carton', 'set', 'pallet'))
);

CREATE UNIQUE INDEX "post_departure_candidate_cargo_line_number_key"
ON "post_departure_source_candidate_cargo_line"("correction_id", "line_number");

CREATE UNIQUE INDEX "post_departure_candidate_cargo_source_line_key"
ON "post_departure_source_candidate_cargo_line"("correction_id", "source_line_id");

CREATE INDEX "post_departure_candidate_cargo_sku_idx"
ON "post_departure_source_candidate_cargo_line"("tenant_id", "product_sku_id");

CREATE INDEX "post_departure_candidate_cargo_order_idx"
ON "post_departure_source_candidate_cargo_line"("tenant_id", "replenishment_order_number");

ALTER TABLE "post_departure_source_candidate_cargo_line"
ADD CONSTRAINT "post_departure_candidate_cargo_correction_fkey"
FOREIGN KEY ("correction_id", "tenant_id")
REFERENCES "post_departure_source_candidate_correction"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- product_sku_id and replenishment_order_line_id are cross-module logical references.
-- The integration-import application validates them through public Ports before insert.
