-- AlterTable
ALTER TABLE "canonical_event" ADD COLUMN "evidence_refs" JSONB NOT NULL DEFAULT '[]';
