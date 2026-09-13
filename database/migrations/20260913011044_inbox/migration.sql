-- AlterTable
ALTER TABLE "canonical_event" ALTER COLUMN "evidence_refs" DROP DEFAULT;

-- AlterTable
ALTER TABLE "outbox_replay_request" ALTER COLUMN "request_hash" DROP DEFAULT;
