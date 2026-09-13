-- AlterTable
ALTER TABLE "inbox_message" ADD COLUMN "causation_id" TEXT;

-- CreateIndex
CREATE INDEX "inbox_message_dead_letter_list_idx" ON "inbox_message"("tenant_id", "consumer_name", "state", "dead_lettered_at", "id");

-- CreateTable
CREATE TABLE "inbox_replay_request" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "dead_letter_id" TEXT NOT NULL,
    "replayed_inbox_id" TEXT NOT NULL,
    "replayed_message_id" TEXT NOT NULL,
    "target_consumer_version" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "reason_code" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL,
    "trace_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_replay_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inbox_replay_idempotency_key" ON "inbox_replay_request"("tenant_id", "dead_letter_id", "idempotency_key");
