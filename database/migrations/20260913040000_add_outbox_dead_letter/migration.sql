-- AlterTable
ALTER TABLE "outbox_message" ADD COLUMN "failure_category" TEXT;
ALTER TABLE "outbox_message" ADD COLUMN "dead_lettered_at" TIMESTAMP(3);
ALTER TABLE "outbox_message" ADD COLUMN "owner_queue" TEXT;
