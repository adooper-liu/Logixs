-- Product/SKU identity belongs to master-data. Shipment lines will reference it
-- logically in a later slice so this migration does not rewrite existing imports.
CREATE TABLE "product_sku" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_number" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "product_sku_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_sku_tenant_check"
      CHECK (char_length("tenant_id") BETWEEN 1 AND 128 AND "tenant_id" = btrim("tenant_id") AND "tenant_id" !~ '[[:cntrl:]]'),
    CONSTRAINT "product_sku_number_check"
      CHECK (char_length("product_number") BETWEEN 1 AND 128 AND "product_number" = btrim("product_number") AND "product_number" !~ '[[:cntrl:]]'),
    CONSTRAINT "product_sku_version_check" CHECK ("version" >= 1)
);

CREATE UNIQUE INDEX "product_sku_tenant_number_key"
ON "product_sku"("tenant_id", "product_number");

CREATE UNIQUE INDEX "product_sku_id_tenant_key"
ON "product_sku"("id", "tenant_id");

CREATE INDEX "product_sku_tenant_created_idx"
ON "product_sku"("tenant_id", "created_at", "id");

CREATE TABLE "product_sku_registration" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "product_sku_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_sku_registration_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_sku_registration_tenant_check"
      CHECK (char_length("tenant_id") BETWEEN 1 AND 128 AND "tenant_id" = btrim("tenant_id") AND "tenant_id" !~ '[[:cntrl:]]'),
    CONSTRAINT "product_sku_registration_idempotency_check"
      CHECK (char_length("idempotency_key") BETWEEN 1 AND 200 AND "idempotency_key" = btrim("idempotency_key") AND "idempotency_key" !~ '[[:cntrl:]]'),
    CONSTRAINT "product_sku_registration_payload_hash_check"
      CHECK ("payload_hash" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "product_sku_registration_tenant_key"
ON "product_sku_registration"("tenant_id", "idempotency_key");

CREATE INDEX "product_sku_registration_product_idx"
ON "product_sku_registration"("product_sku_id");

ALTER TABLE "product_sku_registration"
ADD CONSTRAINT "product_sku_registration_product_fkey"
FOREIGN KEY ("product_sku_id", "tenant_id")
REFERENCES "product_sku"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Verification: tenant/product identity and tenant/idempotency key are unique;
-- registration cannot point at another tenant's SKU.
-- Recovery: older application code may ignore these additive tables. Dropping
-- them after writes begin destroys stable SKU identities and replay audit.
