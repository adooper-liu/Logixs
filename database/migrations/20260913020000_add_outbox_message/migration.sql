-- CreateTable
CREATE TABLE "outbox_message" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "owner_module" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_version" INTEGER NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "payload_ref" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3),
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "broker_reference" TEXT,
    "published_at" TIMESTAMP(3),
    "last_error_code" TEXT,
    "trace_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outbox_message_event_id_key" ON "outbox_message"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_message_idempotency_key" ON "outbox_message"("tenant_id", "owner_module", "event_type", "idempotency_key");

-- CreateIndex
CREATE INDEX "outbox_message_poll_idx" ON "outbox_message"("state", "next_attempt_at", "created_at");
