-- AlterTable
ALTER TABLE "inbox_message" ADD COLUMN "payload_json" JSONB;
ALTER TABLE "inbox_message" ADD COLUMN "next_attempt_at" TIMESTAMP(3);
ALTER TABLE "inbox_message" ADD COLUMN "last_error_code" TEXT;
ALTER TABLE "inbox_message" ADD COLUMN "failure_category" TEXT;
ALTER TABLE "inbox_message" ADD COLUMN "dead_lettered_at" TIMESTAMP(3);
ALTER TABLE "inbox_message" ADD COLUMN "owner_queue" TEXT;

-- CreateIndex
CREATE INDEX "inbox_message_retry_idx" ON "inbox_message"("state", "next_attempt_at");

-- CreateTable
CREATE TABLE "client_operation" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action_code" TEXT NOT NULL,
    "action_version" INTEGER NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "target_owner_module" TEXT NOT NULL,
    "correlation_id" TEXT NOT NULL,
    "causation_id" TEXT,
    "trace_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "reception_state" TEXT NOT NULL,
    "business_decision_state" TEXT NOT NULL,
    "commit_state" TEXT NOT NULL,
    "result_refs" JSONB NOT NULL,
    "rejection_reason_code" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "next_attempt_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "decided_at" TIMESTAMP(3),
    "committed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_operation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_operation_idempotency_key" ON "client_operation"("tenant_id", "actor_id", "action_code", "idempotency_key");

-- CreateIndex
CREATE INDEX "client_operation_tenant_created_idx" ON "client_operation"("tenant_id", "created_at", "id");
