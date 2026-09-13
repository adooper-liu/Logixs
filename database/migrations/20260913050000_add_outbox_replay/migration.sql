-- AlterTable
ALTER TABLE "outbox_message" ADD COLUMN "causation_id" TEXT;

-- CreateTable
CREATE TABLE "outbox_replay_request" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "dead_letter_id" TEXT NOT NULL,
    "replayed_outbox_id" TEXT NOT NULL,
    "target_consumer_version" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "reason_code" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL,
    "trace_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_replay_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outbox_replay_idempotency_key" ON "outbox_replay_request"("tenant_id", "dead_letter_id", "idempotency_key");
