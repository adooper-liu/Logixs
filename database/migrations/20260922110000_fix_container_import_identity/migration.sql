-- Resolve a container number only inside an explicit import batch. Container
-- numbers remain reusable across transport instances and are never global IDs.
CREATE TABLE "container_import_binding" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "source_batch_id" TEXT NOT NULL,
    "container_number" TEXT NOT NULL,
    "container_record_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "container_import_binding_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "container_import_binding_tenant_check"
      CHECK (char_length("tenant_id") BETWEEN 1 AND 128 AND "tenant_id" = btrim("tenant_id") AND "tenant_id" !~ '[[:cntrl:]]'),
    CONSTRAINT "container_import_binding_batch_check"
      CHECK (char_length("source_batch_id") BETWEEN 1 AND 200 AND "source_batch_id" = btrim("source_batch_id") AND "source_batch_id" !~ '[[:cntrl:]]'),
    CONSTRAINT "container_import_binding_number_check"
      CHECK (char_length("container_number") BETWEEN 1 AND 64 AND "container_number" = btrim("container_number") AND "container_number" !~ '[[:cntrl:]]')
);

CREATE UNIQUE INDEX "container_import_binding_scope_key"
ON "container_import_binding"("tenant_id", "source_batch_id", "container_number");

CREATE INDEX "container_import_binding_container_idx"
ON "container_import_binding"("container_record_id", "tenant_id");

ALTER TABLE "container_import_binding"
ADD CONSTRAINT "container_import_binding_container_fkey"
FOREIGN KEY ("container_record_id", "tenant_id")
REFERENCES "container_record"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Verification after deploy:
-- 1. A batch can resolve a given container number to only one stable container.
-- 2. The binding cannot cross tenant boundaries.
-- 3. No uniqueness is added to container_record.container_number.
-- Recovery: application rollback may leave this additive table unused. Keep it
-- while imports referencing its scope exist; dropping it removes replay identity.
