-- Task-scoped internal collaboration. Messages and references are append-only;
-- they never mutate task, responsibility, evidence or lifecycle facts.
BEGIN;

CREATE TABLE "task_collaboration_thread" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "subject_kind" TEXT NOT NULL,
  "subject_id" UUID NOT NULL,
  "work_kind" TEXT NOT NULL,
  "work_id" UUID NOT NULL,
  "visibility_scope" TEXT NOT NULL,
  "policy_version" INTEGER NOT NULL,
  "created_by_actor_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "task_collaboration_thread_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "task_collaboration_thread_subject_kind_check"
    CHECK ("subject_kind" = 'container'),
  CONSTRAINT "task_collaboration_thread_work_kind_check"
    CHECK ("work_kind" = 'node_task'),
  CONSTRAINT "task_collaboration_thread_visibility_check"
    CHECK ("visibility_scope" = 'task_scope'),
  CONSTRAINT "task_collaboration_thread_policy_version_check"
    CHECK ("policy_version" >= 1),
  CONSTRAINT "task_collaboration_thread_actor_check"
    CHECK (length(btrim("created_by_actor_id")) BETWEEN 1 AND 128)
);

CREATE UNIQUE INDEX "task_collaboration_thread_scope_key"
ON "task_collaboration_thread"(
  "tenant_id",
  "subject_kind",
  "subject_id",
  "work_kind",
  "work_id",
  "visibility_scope"
);

CREATE INDEX "task_collaboration_thread_work_idx"
ON "task_collaboration_thread"("tenant_id", "work_kind", "work_id");

CREATE TABLE "task_collaboration_message" (
  "id" UUID NOT NULL,
  "thread_id" UUID NOT NULL,
  "author_actor_id" TEXT NOT NULL,
  "parent_message_id" UUID,
  "body" TEXT NOT NULL,
  "occurred_at" TIMESTAMPTZ NOT NULL,
  "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,

  CONSTRAINT "task_collaboration_message_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "task_collaboration_message_thread_key" UNIQUE ("id", "thread_id"),
  CONSTRAINT "task_collaboration_message_thread_fkey"
    FOREIGN KEY ("thread_id")
    REFERENCES "task_collaboration_thread"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "task_collaboration_message_parent_fkey"
    FOREIGN KEY ("parent_message_id", "thread_id")
    REFERENCES "task_collaboration_message"("id", "thread_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "task_collaboration_message_body_check"
    CHECK (length(btrim("body")) BETWEEN 1 AND 4000),
  CONSTRAINT "task_collaboration_message_actor_check"
    CHECK (length(btrim("author_actor_id")) BETWEEN 1 AND 128),
  CONSTRAINT "task_collaboration_message_idempotency_check"
    CHECK (length(btrim("idempotency_key")) BETWEEN 1 AND 200),
  CONSTRAINT "task_collaboration_message_payload_hash_check"
    CHECK ("payload_hash" ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX "task_collaboration_message_idempotency_key"
ON "task_collaboration_message"(
  "thread_id",
  "author_actor_id",
  "idempotency_key"
);

CREATE INDEX "task_collaboration_message_page_idx"
ON "task_collaboration_message"("thread_id", "recorded_at" DESC, "id" DESC);

CREATE TABLE "task_collaboration_message_mention" (
  "message_id" UUID NOT NULL,
  "actor_id" TEXT NOT NULL,

  CONSTRAINT "task_collaboration_message_mention_pkey"
    PRIMARY KEY ("message_id", "actor_id"),
  CONSTRAINT "task_collaboration_message_mention_message_fkey"
    FOREIGN KEY ("message_id")
    REFERENCES "task_collaboration_message"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "task_collaboration_message_mention_actor_check"
    CHECK (length(btrim("actor_id")) BETWEEN 1 AND 128)
);

CREATE TABLE "task_collaboration_message_evidence_ref" (
  "message_id" UUID NOT NULL,
  "evidence_record_id" UUID NOT NULL,

  CONSTRAINT "task_collaboration_message_evidence_ref_pkey"
    PRIMARY KEY ("message_id", "evidence_record_id"),
  CONSTRAINT "task_collaboration_message_evidence_ref_message_fkey"
    FOREIGN KEY ("message_id")
    REFERENCES "task_collaboration_message"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "task_collaboration_message_evidence_lookup_idx"
ON "task_collaboration_message_evidence_ref"("evidence_record_id");

CREATE TABLE "task_collaboration_message_source_ref" (
  "id" UUID NOT NULL,
  "message_id" UUID NOT NULL,
  "source_kind" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "source_version" INTEGER,

  CONSTRAINT "task_collaboration_message_source_ref_pkey"
    PRIMARY KEY ("id"),
  CONSTRAINT "task_collaboration_message_source_ref_message_fkey"
    FOREIGN KEY ("message_id")
    REFERENCES "task_collaboration_message"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "task_collaboration_message_source_ref_kind_check"
    CHECK ("source_kind" IN ('action', 'result', 'evidence')),
  CONSTRAINT "task_collaboration_message_source_ref_id_check"
    CHECK (length(btrim("source_id")) BETWEEN 1 AND 200),
  CONSTRAINT "task_collaboration_message_source_ref_version_check"
    CHECK ("source_version" IS NULL OR "source_version" >= 1)
);

CREATE UNIQUE INDEX "task_collaboration_message_source_ref_key"
ON "task_collaboration_message_source_ref"(
  "message_id",
  "source_kind",
  "source_id",
  "source_version"
) NULLS NOT DISTINCT;

CREATE FUNCTION "reject_task_collaboration_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $task_collaboration_immutable$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$task_collaboration_immutable$;

CREATE TRIGGER "task_collaboration_thread_immutable"
BEFORE UPDATE OR DELETE ON "task_collaboration_thread"
FOR EACH ROW EXECUTE FUNCTION "reject_task_collaboration_mutation"();

CREATE TRIGGER "task_collaboration_message_immutable"
BEFORE UPDATE OR DELETE ON "task_collaboration_message"
FOR EACH ROW EXECUTE FUNCTION "reject_task_collaboration_mutation"();

CREATE TRIGGER "task_collaboration_message_mention_immutable"
BEFORE UPDATE OR DELETE ON "task_collaboration_message_mention"
FOR EACH ROW EXECUTE FUNCTION "reject_task_collaboration_mutation"();

CREATE TRIGGER "task_collaboration_message_evidence_ref_immutable"
BEFORE UPDATE OR DELETE ON "task_collaboration_message_evidence_ref"
FOR EACH ROW EXECUTE FUNCTION "reject_task_collaboration_mutation"();

CREATE TRIGGER "task_collaboration_message_source_ref_immutable"
BEFORE UPDATE OR DELETE ON "task_collaboration_message_source_ref"
FOR EACH ROW EXECUTE FUNCTION "reject_task_collaboration_mutation"();

COMMIT;

-- Verification after deployment:
-- SELECT conname FROM pg_constraint WHERE conrelid = 'task_collaboration_message'::regclass;
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'task_collaboration_message'::regclass AND NOT tgisinternal;
-- Recovery: this is an additive migration. Roll back the application first; preserve rows and roll forward with a corrective migration.
