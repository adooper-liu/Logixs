-- AlterTable
ALTER TABLE "outbox_replay_request" ADD COLUMN "request_hash" TEXT NOT NULL DEFAULT '';
