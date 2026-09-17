-- The immutable 20260913011044 migration attempted this before the table existed.
ALTER TABLE "outbox_replay_request" ALTER COLUMN "request_hash" DROP DEFAULT;
