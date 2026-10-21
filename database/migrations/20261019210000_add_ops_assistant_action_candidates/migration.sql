-- Immutable, task-bound assistant action candidates and human decisions.
-- This migration does not add an execution path or mutate work-execution state.
BEGIN;

CREATE UNIQUE INDEX "work_order_id_node_task_key"
ON "work_order"("id", "node_task_id");

CREATE FUNCTION "ops_assistant_typed_refs_valid"(
  "refs" JSONB,
  "allowed_kinds" TEXT[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $ops_assistant_typed_refs$
DECLARE
  "item" JSONB;
  "current_key" TEXT;
  "previous_key" TEXT;
BEGIN
  IF jsonb_typeof("refs") <> 'array' OR jsonb_array_length("refs") > 20 THEN
    RETURN FALSE;
  END IF;
  FOR "item" IN SELECT value FROM jsonb_array_elements("refs") LOOP
    IF jsonb_typeof("item") <> 'object'
       OR (SELECT count(*) FROM jsonb_object_keys("item")) <> 3
       OR NOT ("item" ?& ARRAY['id', 'kind', 'version'])
       OR jsonb_typeof("item"->'kind') <> 'string'
       OR jsonb_typeof("item"->'id') <> 'string'
       OR NOT ("item"->>'kind' = ANY("allowed_kinds"))
       OR NOT (("item"->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
       OR jsonb_typeof("item"->'version') NOT IN ('number', 'null')
       OR (
         jsonb_typeof("item"->'version') = 'number'
         AND (
           (("item"->>'version')::NUMERIC % 1) <> 0
           OR ("item"->>'version')::NUMERIC < 0
         )
       ) THEN
      RETURN FALSE;
    END IF;
    "current_key" := concat_ws(
      E'\x1f',
      "item"->>'kind',
      lower("item"->>'id'),
      COALESCE("item"->>'version', '')
    );
    IF "previous_key" IS NOT NULL AND "current_key" <= "previous_key" THEN
      RETURN FALSE;
    END IF;
    "previous_key" := "current_key";
  END LOOP;
  RETURN TRUE;
END;
$ops_assistant_typed_refs$;

CREATE FUNCTION "ops_assistant_warning_codes_valid"("codes" TEXT[])
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $ops_assistant_warning_codes$
DECLARE
  "code" TEXT;
  "previous_code" TEXT;
BEGIN
  IF cardinality("codes") > 20 THEN
    RETURN FALSE;
  END IF;
  FOREACH "code" IN ARRAY "codes" LOOP
    IF "code" IS NULL
       OR "code" !~ '^[a-z][a-z0-9_.-]{0,99}$'
       OR ("previous_code" IS NOT NULL AND "code" <= "previous_code") THEN
      RETURN FALSE;
    END IF;
    "previous_code" := "code";
  END LOOP;
  RETURN TRUE;
END;
$ops_assistant_warning_codes$;

CREATE FUNCTION "ops_assistant_decision_links_valid"(
  "decision_value" TEXT,
  "client_operation_id" TEXT,
  "execution_state" TEXT,
  "result_refs" JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $ops_assistant_decision_links$
DECLARE
  "item" JSONB;
BEGIN
  IF jsonb_typeof("result_refs") <> 'array' THEN
    RETURN FALSE;
  END IF;
  IF "decision_value" = 'rejected' THEN
    RETURN "client_operation_id" IS NULL
      AND "execution_state" IS NULL
      AND jsonb_array_length("result_refs") = 0;
  END IF;
  IF "client_operation_id" IS NULL THEN
    IF "execution_state" IN ('applied', 'failed') THEN
      RETURN FALSE;
    END IF;
    FOR "item" IN SELECT value FROM jsonb_array_elements("result_refs") LOOP
      IF "item"->>'kind' = 'client_operation' THEN
        RETURN FALSE;
      END IF;
    END LOOP;
    RETURN TRUE;
  END IF;
  IF "execution_state" IS NULL THEN
    RETURN FALSE;
  END IF;
  FOR "item" IN SELECT value FROM jsonb_array_elements("result_refs") LOOP
    IF "item"->>'kind' = 'client_operation'
       AND "item"->>'id' <> "client_operation_id" THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  RETURN TRUE;
END;
$ops_assistant_decision_links$;

CREATE TABLE "ops_assistant_action_candidate" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "subject_kind" TEXT NOT NULL,
  "subject_id" UUID NOT NULL,
  "work_kind" TEXT NOT NULL,
  "work_id" TEXT NOT NULL,
  "work_order_id" TEXT NOT NULL,
  "action_code" TEXT NOT NULL,
  "action_version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "rationale" TEXT NOT NULL,
  "impact" TEXT NOT NULL,
  "risk_level" TEXT NOT NULL,
  "warning_codes" TEXT[] NOT NULL,
  "status" TEXT NOT NULL,
  "candidate_hash" TEXT NOT NULL,
  "source_kind" TEXT NOT NULL,
  "capability_id" TEXT NOT NULL,
  "capability_version" INTEGER NOT NULL,
  "schema_version" INTEGER NOT NULL,
  "prompt_version" TEXT,
  "model_id" TEXT,
  "input_snapshot_hash" TEXT NOT NULL,
  "input_refs" JSONB NOT NULL,
  "generated_at" TIMESTAMPTZ NOT NULL,
  "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ops_assistant_action_candidate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ops_assistant_action_candidate_task_fkey"
    FOREIGN KEY ("work_id") REFERENCES "node_task"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ops_assistant_action_candidate_work_order_fkey"
    FOREIGN KEY ("work_order_id") REFERENCES "work_order"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ops_assistant_action_candidate_work_order_task_fkey"
    FOREIGN KEY ("work_order_id", "work_id")
    REFERENCES "work_order"("id", "node_task_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ops_assistant_action_candidate_actor_check"
    CHECK (length(btrim("actor_id")) BETWEEN 1 AND 128),
  CONSTRAINT "ops_assistant_action_candidate_subject_check"
    CHECK ("subject_kind" = 'container'),
  CONSTRAINT "ops_assistant_action_candidate_work_check"
    CHECK ("work_kind" = 'node_task'),
  CONSTRAINT "ops_assistant_action_candidate_action_check"
    CHECK ("action_code" = 'work_execution.claim_work_order' AND "action_version" = 1),
  CONSTRAINT "ops_assistant_action_candidate_text_check"
    CHECK (
      length(btrim("title")) BETWEEN 1 AND 200
      AND length(btrim("rationale")) BETWEEN 1 AND 4000
      AND length(btrim("impact")) BETWEEN 1 AND 4000
    ),
  CONSTRAINT "ops_assistant_action_candidate_risk_check"
    CHECK ("risk_level" = 'low'),
  CONSTRAINT "ops_assistant_action_candidate_warning_check"
    CHECK ("ops_assistant_warning_codes_valid"("warning_codes")),
  CONSTRAINT "ops_assistant_action_candidate_status_check"
    CHECK ("status" = 'proposed'),
  CONSTRAINT "ops_assistant_action_candidate_hash_check"
    CHECK ("candidate_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "ops_assistant_action_candidate_source_check"
    CHECK (
      "source_kind" IN ('rule', 'model', 'fallback')
      AND "capability_id" = 'task.claim-assistance'
      AND "capability_version" = 1
      AND "schema_version" = 1
      AND (
        ("source_kind" = 'model' AND "prompt_version" IS NOT NULL AND "model_id" IS NOT NULL AND length(btrim("prompt_version")) BETWEEN 1 AND 100 AND length(btrim("model_id")) BETWEEN 1 AND 200)
        OR ("source_kind" IN ('rule', 'fallback') AND "prompt_version" IS NULL AND "model_id" IS NULL)
      )
    ),
  CONSTRAINT "ops_assistant_action_candidate_snapshot_hash_check"
    CHECK ("input_snapshot_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "ops_assistant_action_candidate_input_refs_check"
    CHECK ("ops_assistant_typed_refs_valid"(
      "input_refs",
      ARRAY['container', 'node_task', 'work_order']
    ))
);

CREATE INDEX "ops_assistant_action_candidate_hash_idx"
ON "ops_assistant_action_candidate"("candidate_hash");

CREATE INDEX "ops_assistant_action_candidate_actor_idx"
ON "ops_assistant_action_candidate"("tenant_id", "actor_id", "recorded_at", "id");

CREATE INDEX "ops_assistant_action_candidate_work_idx"
ON "ops_assistant_action_candidate"("tenant_id", "work_id", "recorded_at", "id");

CREATE TABLE "ops_assistant_action_decision" (
  "id" UUID NOT NULL,
  "candidate_id" UUID NOT NULL,
  "decided_by_actor_id" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "reason" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "decision_hash" TEXT NOT NULL,
  "decided_at" TIMESTAMPTZ NOT NULL,
  "client_operation_id" TEXT,
  "trace_id" TEXT,
  "execution_state" TEXT,
  "result_refs" JSONB NOT NULL,
  "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ops_assistant_action_decision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ops_assistant_action_decision_candidate_fkey"
    FOREIGN KEY ("candidate_id")
    REFERENCES "ops_assistant_action_candidate"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ops_assistant_action_decision_client_operation_fkey"
    FOREIGN KEY ("client_operation_id") REFERENCES "client_operation"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ops_assistant_action_decision_actor_check"
    CHECK (length(btrim("decided_by_actor_id")) BETWEEN 1 AND 128),
  CONSTRAINT "ops_assistant_action_decision_value_check"
    CHECK ("decision" IN ('accepted', 'rejected')),
  CONSTRAINT "ops_assistant_action_decision_reason_check"
    CHECK ("reason" IS NULL OR length(btrim("reason")) BETWEEN 1 AND 500),
  CONSTRAINT "ops_assistant_action_decision_idempotency_check"
    CHECK (length(btrim("idempotency_key")) BETWEEN 1 AND 200),
  CONSTRAINT "ops_assistant_action_decision_hash_check"
    CHECK ("decision_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "ops_assistant_action_decision_trace_check"
    CHECK ("trace_id" IS NULL OR length(btrim("trace_id")) BETWEEN 1 AND 128),
  CONSTRAINT "ops_assistant_action_decision_execution_state_check"
    CHECK ("execution_state" IS NULL OR "execution_state" IN ('pending', 'applied', 'failed')),
  CONSTRAINT "ops_assistant_action_decision_result_refs_check"
    CHECK ("ops_assistant_typed_refs_valid"(
      "result_refs",
      ARRAY['container', 'node_task', 'work_order', 'client_operation']
    )),
  CONSTRAINT "ops_assistant_action_decision_links_check"
    CHECK ("ops_assistant_decision_links_valid"(
      "decision",
      "client_operation_id",
      "execution_state",
      "result_refs"
    ))
);

CREATE UNIQUE INDEX "ops_assistant_action_decision_candidate_key"
ON "ops_assistant_action_decision"("candidate_id");

CREATE UNIQUE INDEX "ops_assistant_action_decision_idempotency_key"
ON "ops_assistant_action_decision"(
  "candidate_id", "decided_by_actor_id", "idempotency_key"
);

CREATE INDEX "ops_assistant_action_decision_candidate_idx"
ON "ops_assistant_action_decision"("candidate_id", "recorded_at", "id");

CREATE INDEX "ops_assistant_action_decision_client_operation_idx"
ON "ops_assistant_action_decision"("client_operation_id");

CREATE FUNCTION "reject_ops_assistant_action_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $ops_assistant_action_immutable$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$ops_assistant_action_immutable$;

CREATE TRIGGER "ops_assistant_action_candidate_immutable"
BEFORE UPDATE OR DELETE ON "ops_assistant_action_candidate"
FOR EACH ROW EXECUTE FUNCTION "reject_ops_assistant_action_mutation"();

CREATE TRIGGER "ops_assistant_action_decision_immutable"
BEFORE UPDATE OR DELETE ON "ops_assistant_action_decision"
FOR EACH ROW EXECUTE FUNCTION "reject_ops_assistant_action_mutation"();

COMMIT;

-- Verification after deployment:
-- SELECT conname FROM pg_constraint WHERE conrelid = 'ops_assistant_action_candidate'::regclass;
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'ops_assistant_action_decision'::regclass AND NOT tgisinternal;
-- Recovery: additive migration. Roll back the application first; preserve rows and roll forward with a corrective migration.
