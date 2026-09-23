CREATE TABLE "operational_exception_case" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "container_record_id" TEXT NOT NULL,
    "shipment_id" UUID,
    "exception_code" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source_domain" TEXT NOT NULL,
    "source_record_id" TEXT NOT NULL,
    "source_version" TEXT NOT NULL,
    "summary" TEXT,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "resolved_at" TIMESTAMPTZ,
    "evidence_refs" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "operational_exception_case_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "operational_exception_case_version_check" CHECK ("version" > 0),
    CONSTRAINT "operational_exception_case_severity_check" CHECK ("severity" IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT "operational_exception_case_status_check" CHECK ("status" IN ('open', 'investigating', 'resolved', 'dismissed')),
    CONSTRAINT "operational_exception_case_resolution_check" CHECK (("status" IN ('resolved', 'dismissed')) = ("resolved_at" IS NOT NULL)),
    CONSTRAINT "operational_exception_case_evidence_check" CHECK (jsonb_typeof("evidence_refs") = 'array')
);

CREATE UNIQUE INDEX "operational_exception_case_id_tenant_key"
ON "operational_exception_case"("id", "tenant_id");

CREATE UNIQUE INDEX "operational_exception_case_source_key"
ON "operational_exception_case"("tenant_id", "source_domain", "source_record_id", "source_version");

CREATE UNIQUE INDEX "operational_exception_case_idempotency_key"
ON "operational_exception_case"("tenant_id", "idempotency_key");

CREATE INDEX "operational_exception_case_container_status_idx"
ON "operational_exception_case"("tenant_id", "container_record_id", "status", "occurred_at", "id");

CREATE INDEX "operational_exception_case_shipment_status_idx"
ON "operational_exception_case"("tenant_id", "shipment_id", "status", "occurred_at", "id");

ALTER TABLE "operational_exception_case"
ADD CONSTRAINT "operational_exception_case_container_tenant_fkey"
FOREIGN KEY ("container_record_id", "tenant_id") REFERENCES "container_record"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "operational_exception_case_shipment_tenant_fkey"
FOREIGN KEY ("shipment_id", "tenant_id") REFERENCES "shipment"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
