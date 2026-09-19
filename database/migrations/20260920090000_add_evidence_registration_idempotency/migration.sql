-- Existing evidence predates registration idempotency. Its stable record ID is a safe one-time legacy key.
ALTER TABLE "evidence_record"
ADD COLUMN "idempotency_key" TEXT;

UPDATE "evidence_record"
SET "idempotency_key" = 'legacy:' || "id";

ALTER TABLE "evidence_record"
ALTER COLUMN "idempotency_key" SET NOT NULL;

ALTER TABLE "evidence_record"
ADD CONSTRAINT "evidence_record_idempotency_key_check"
CHECK (length("idempotency_key") BETWEEN 1 AND 200);

CREATE UNIQUE INDEX "evidence_record_tenant_idempotency_key"
ON "evidence_record"("tenant_id", "idempotency_key");

-- Verification: no tenant can register two evidence records under the same idempotency key.
-- Recovery: retain the column while older application code ignores it; dropping it removes retry audit identity.
