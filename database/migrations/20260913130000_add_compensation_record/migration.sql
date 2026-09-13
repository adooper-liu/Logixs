-- CreateTable
CREATE TABLE "compensation_record" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "original_client_operation_id" TEXT NOT NULL,
    "compensation_action_code" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "reason_code" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "result_refs" JSONB NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "trace_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compensation_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "compensation_idempotency_key" ON "compensation_record"("tenant_id", "original_client_operation_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "compensation_original_idx" ON "compensation_record"("tenant_id", "original_client_operation_id", "created_at", "id");
