-- CreateTable
CREATE TABLE "inbox_message" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "consumer_name" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "trace_id" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbox_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inbox_message_consumer_message_key" ON "inbox_message"("consumer_name", "message_id");

-- CreateIndex
CREATE INDEX "inbox_message_tenant_state_idx" ON "inbox_message"("tenant_id", "consumer_name", "state");
