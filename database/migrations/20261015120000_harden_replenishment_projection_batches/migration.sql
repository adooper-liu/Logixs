ALTER TABLE "full_chain_stuffing_line"
ADD COLUMN "quantity_unit" TEXT;

DROP INDEX "replenishment_order_line_source_key";

CREATE UNIQUE INDEX "replenishment_order_line_tenant_source_key"
ON "replenishment_order_line"("tenant_id", "source_batch_id", "source_row_id");

CREATE TABLE "replenishment_order_projection_batch" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "replenishment_order_id" TEXT NOT NULL,
  "source_batch_id" TEXT NOT NULL,
  "content_hash" CHAR(64) NOT NULL,
  "line_count" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "replenishment_order_projection_batch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "replenishment_order_projection_batch_order_tenant_fkey"
    FOREIGN KEY ("replenishment_order_id", "tenant_id")
    REFERENCES "replenishment_order"("id", "tenant_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "replenishment_order_projection_batch_line_count_check"
    CHECK ("line_count" >= 0)
);

CREATE UNIQUE INDEX "replenishment_order_projection_batch_scope_key"
ON "replenishment_order_projection_batch"(
  "tenant_id",
  "replenishment_order_id",
  "source_batch_id"
);

CREATE INDEX "replenishment_order_projection_batch_source_idx"
ON "replenishment_order_projection_batch"("tenant_id", "source_batch_id");
