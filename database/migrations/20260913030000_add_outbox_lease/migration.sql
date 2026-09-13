-- AlterTable
ALTER TABLE "outbox_message" ADD COLUMN "locked_by" TEXT;
ALTER TABLE "outbox_message" ADD COLUMN "locked_at" TIMESTAMP(3);
ALTER TABLE "outbox_message" ADD COLUMN "lease_expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "outbox_message_lease_idx" ON "outbox_message"("state", "lease_expires_at");
