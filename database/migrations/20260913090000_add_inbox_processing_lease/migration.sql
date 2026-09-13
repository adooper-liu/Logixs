-- AlterTable
ALTER TABLE "inbox_message" ADD COLUMN "locked_by" TEXT;
ALTER TABLE "inbox_message" ADD COLUMN "locked_at" TIMESTAMP(3);
ALTER TABLE "inbox_message" ADD COLUMN "lease_expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "inbox_message_lease_idx" ON "inbox_message"("tenant_id", "consumer_name", "state", "lease_expires_at", "received_at");
