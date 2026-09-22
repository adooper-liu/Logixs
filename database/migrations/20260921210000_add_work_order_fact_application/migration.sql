-- Expand: add versioned task/work-order fields and the immutable fact application ledger.
ALTER TABLE "node_task"
  ADD COLUMN "tenant_id" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "work_order"
  ADD COLUMN "applicability" TEXT NOT NULL DEFAULT 'required',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "node_task_outcome"
  ADD COLUMN "evaluated_fact_refs" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "canonical_event_id" TEXT,
  ADD COLUMN "domain_fact_id" TEXT,
  ADD COLUMN "actor_or_service_id" TEXT,
  ADD COLUMN "trace_id" TEXT;

CREATE TABLE "work_order_fact_application" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "work_order_id" TEXT NOT NULL,
  "canonical_event_id" TEXT NOT NULL,
  "node_instance_id" TEXT NOT NULL,
  "business_fact_type" TEXT NOT NULL,
  "business_fact_key" TEXT NOT NULL,
  "domain_fact_id" TEXT NOT NULL,
  "capture_source" TEXT NOT NULL,
  "evidence_refs" JSONB NOT NULL,
  "occurred_at" TIMESTAMPTZ NOT NULL,
  "received_at" TIMESTAMPTZ NOT NULL,
  "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "request_hash" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "decision_reason" TEXT,
  "previous_state" TEXT NOT NULL,
  "resulting_state" TEXT NOT NULL,
  "applied_at" TIMESTAMPTZ NOT NULL,
  "actor_or_service_id" TEXT NOT NULL,
  "trace_id" TEXT NOT NULL,

  CONSTRAINT "work_order_fact_application_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "work_order_fact_application_type_check"
    CHECK (length(BTRIM("business_fact_type")) BETWEEN 1 AND 64),
  CONSTRAINT "work_order_fact_application_key_check"
    CHECK (length(BTRIM("business_fact_key")) BETWEEN 1 AND 200),
  CONSTRAINT "work_order_fact_application_domain_fact_check"
    CHECK (length(BTRIM("domain_fact_id")) > 0),
  CONSTRAINT "work_order_fact_application_capture_source_check"
    CHECK ("capture_source" IN (
      'external_evidence', 'manual_backfill', 'controlled_import',
      'internal_operation', 'system_derived'
    )),
  CONSTRAINT "work_order_fact_application_evidence_refs_array_check"
    CHECK (jsonb_typeof("evidence_refs") = 'array'),
  CONSTRAINT "work_order_fact_application_request_hash_check"
    CHECK ("request_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "work_order_fact_application_decision_check"
    CHECK ("decision" IN ('applied', 'rejected', 'no_op')),
  CONSTRAINT "work_order_fact_application_decision_reason_check"
    CHECK (
      ("decision" = 'applied' AND "decision_reason" IS NULL)
      OR (
        "decision" IN ('rejected', 'no_op')
        AND length(BTRIM("decision_reason")) BETWEEN 1 AND 500
      )
    ),
  CONSTRAINT "work_order_fact_application_previous_state_check"
    CHECK ("previous_state" IN (
      'draft', 'ready', 'in_progress', 'blocked', 'completed', 'failed',
      'reopened', 'cancelled'
    )),
  CONSTRAINT "work_order_fact_application_resulting_state_check"
    CHECK ("resulting_state" IN (
      'draft', 'ready', 'in_progress', 'blocked', 'completed', 'failed',
      'reopened', 'cancelled'
    )),
  CONSTRAINT "work_order_fact_application_decision_state_check"
    CHECK (
      ("decision" = 'applied' AND "resulting_state" = 'completed')
      OR ("decision" IN ('rejected', 'no_op') AND "resulting_state" = "previous_state")
    ),
  CONSTRAINT "work_order_fact_application_time_order_check"
    CHECK (
      "received_at" >= "occurred_at"
      AND "recorded_at" >= "received_at"
      AND "applied_at" >= "recorded_at"
    ),
  CONSTRAINT "work_order_fact_application_actor_check"
    CHECK (length(BTRIM("actor_or_service_id")) > 0),
  CONSTRAINT "work_order_fact_application_trace_check"
    CHECK (length(BTRIM("trace_id")) BETWEEN 1 AND 128)
);

CREATE UNIQUE INDEX "work_order_fact_application_business_key"
ON "work_order_fact_application"("work_order_id", "business_fact_key");

CREATE INDEX "work_order_fact_application_tenant_event_idx"
ON "work_order_fact_application"("tenant_id", "canonical_event_id");

CREATE INDEX "work_order_fact_application_event_idx"
ON "work_order_fact_application"("canonical_event_id");

CREATE INDEX "work_order_fact_application_node_idx"
ON "work_order_fact_application"("node_instance_id");

CREATE INDEX "work_order_fact_application_domain_fact_idx"
ON "work_order_fact_application"("domain_fact_id");

ALTER TABLE "work_order_fact_application"
  ADD CONSTRAINT "work_order_fact_application_work_order_id_fkey"
  FOREIGN KEY ("work_order_id") REFERENCES "work_order"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "work_order_fact_application_canonical_event_id_fkey"
  FOREIGN KEY ("canonical_event_id") REFERENCES "canonical_event"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "work_order_fact_application_node_instance_id_fkey"
  FOREIGN KEY ("node_instance_id") REFERENCES "node_instance"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "reject_work_order_fact_application_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $immutable_fact_application$
BEGIN
  RAISE EXCEPTION 'work_order_fact_application is immutable';
END;
$immutable_fact_application$;

CREATE TRIGGER "work_order_fact_application_immutable"
BEFORE UPDATE OR DELETE ON "work_order_fact_application"
FOR EACH ROW EXECUTE FUNCTION "reject_work_order_fact_application_mutation"();

-- Backfill: a task belongs to exactly one flow/node/container chain. Refuse to
-- guess tenant scope when historical rows do not satisfy that chain.
DO $validate_node_task_scope$
DECLARE
  invalid_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM "node_task" AS task
  LEFT JOIN "flow_instance" AS flow
    ON flow."id" = task."flow_instance_id"
  LEFT JOIN "node_instance" AS node
    ON node."id" = task."node_instance_id"
   AND node."flow_instance_id" = flow."id"
  LEFT JOIN "container_record" AS container
    ON container."id" = flow."container_id"
  WHERE flow."id" IS NULL
     OR node."id" IS NULL
     OR container."id" IS NULL
     OR NULLIF(BTRIM(container."tenant_id"), '') IS NULL
     OR (
       task."container_id" IS NOT NULL
       AND task."container_id" <> container."id"
     );

  IF invalid_count > 0 THEN
    RAISE EXCEPTION
      'cannot backfill node_task.tenant_id: % task rows have a missing or ambiguous flow/node/container scope',
      invalid_count;
  END IF;
END;
$validate_node_task_scope$;

UPDATE "node_task" AS task
SET "tenant_id" = container."tenant_id"
FROM "flow_instance" AS flow
JOIN "container_record" AS container
  ON container."id" = flow."container_id"
WHERE flow."id" = task."flow_instance_id";

-- Existing work orders predate applicability. They represented the first-slice
-- required order; this restores that historical meaning and is not a future defaulting policy.
UPDATE "work_order"
SET "applicability" = 'required';

-- Historical applied node facts receive one dedicated, replayable reconciliation
-- message. The message id/event id are deterministic and intentionally differ from
-- canonical_event.id, which is already globally unique in outbox_message.event_id.
WITH applied AS (
  SELECT
    application."id" AS "application_id",
    application."event_id" AS "canonical_event_id",
    application."target_node_instance_id" AS "node_instance_id",
    COALESCE(application."applied_at", application."evaluated_at") AS "applied_at",
    event."occurred_at",
    flow."id" AS "flow_instance_id",
    flow."container_id",
    container."tenant_id",
    md5(
      'work-fact-reconciliation:' || application."event_id" || ':' ||
      application."target_node_instance_id"
    ) AS "message_hash"
  FROM "node_event_application" AS application
  JOIN "canonical_event" AS event ON event."id" = application."event_id"
  JOIN "node_instance" AS node
    ON node."id" = application."target_node_instance_id"
  JOIN "flow_instance" AS flow ON flow."id" = node."flow_instance_id"
  JOIN "container_record" AS container ON container."id" = flow."container_id"
  WHERE application."state" = 'applied'
), messages AS (
  SELECT
    applied.*,
    SUBSTR("message_hash", 1, 8) || '-' ||
      SUBSTR("message_hash", 9, 4) || '-5' ||
      SUBSTR("message_hash", 14, 3) || '-8' ||
      SUBSTR("message_hash", 18, 3) || '-' ||
      SUBSTR("message_hash", 21, 12) AS "message_id",
    jsonb_build_object(
      'canonicalEventId', "canonical_event_id",
      'containerId', "container_id",
      'flowInstanceId', "flow_instance_id",
      'nodeEventApplicationId', "application_id",
      'nodeInstanceId', "node_instance_id",
      'tenantId', "tenant_id"
    )::text AS "payload"
  FROM applied
)
INSERT INTO "outbox_message" (
  "id", "tenant_id", "owner_module", "event_id", "event_type",
  "event_version", "aggregate_type", "aggregate_id", "payload_ref",
  "payload_hash", "causation_id", "state", "attempt_count",
  "next_attempt_at", "occurred_at", "idempotency_key", "trace_id",
  "created_at", "updated_at"
)
SELECT
  "message_id",
  "tenant_id",
  'lifecycle-control',
  "message_id",
  'work_execution.reconcile_applied_lifecycle_fact.requested',
  1,
  'node_event_application',
  "application_id",
  'node-event-application/' || "application_id",
  encode(sha256(convert_to("payload", 'UTF8')), 'hex'),
  "canonical_event_id",
  'pending',
  0,
  NULL,
  "occurred_at",
  'reconcile-applied-lifecycle-fact/' || "canonical_event_id" || '/' || "node_instance_id",
  'migration:work-fact-reconciliation:' || "application_id",
  "applied_at",
  "applied_at"
FROM messages
ON CONFLICT ("tenant_id", "owner_module", "event_type", "idempotency_key")
DO NOTHING;

-- Constrain after all recoverable historical data has been restored.
ALTER TABLE "node_task"
  ALTER COLUMN "tenant_id" SET NOT NULL,
  ADD CONSTRAINT "node_task_tenant_check"
    CHECK (length(BTRIM("tenant_id")) > 0),
  ADD CONSTRAINT "node_task_version_check"
    CHECK ("version" >= 0),
  ADD CONSTRAINT "node_task_state_check"
    CHECK ("state" IN (
      'pending', 'in_progress', 'blocked', 'completed', 'reopened', 'cancelled'
    ));

CREATE INDEX "node_task_tenant_flow_node_idx"
ON "node_task"("tenant_id", "flow_instance_id", "node_instance_id");

ALTER TABLE "work_order"
  ADD CONSTRAINT "work_order_version_check"
    CHECK ("version" >= 0),
  ADD CONSTRAINT "work_order_applicability_check"
    CHECK ("applicability" IN (
      'required', 'optional', 'conditional_required', 'not_applicable'
    )),
  ADD CONSTRAINT "work_order_state_check"
    CHECK ("state" IN (
      'draft', 'ready', 'in_progress', 'blocked', 'completed', 'failed',
      'reopened', 'cancelled'
    )),
  ADD CONSTRAINT "work_order_assignment_state_check"
    CHECK ("assignment_state" IN ('unassigned', 'assigned', 'pool', 'automatic'));

CREATE INDEX "work_order_node_task_idx" ON "work_order"("node_task_id");

ALTER TABLE "node_task_outcome"
  ADD CONSTRAINT "node_task_outcome_required_ids_array_check"
    CHECK (jsonb_typeof("required_work_order_ids") = 'array'),
  ADD CONSTRAINT "node_task_outcome_completed_ids_array_check"
    CHECK (jsonb_typeof("completed_work_order_ids") = 'array'),
  ADD CONSTRAINT "node_task_outcome_evaluated_fact_refs_array_check"
    CHECK (jsonb_typeof("evaluated_fact_refs") = 'array'),
  ADD CONSTRAINT "node_task_outcome_fact_causation_check"
    CHECK (
      (
        "canonical_event_id" IS NULL
        AND "domain_fact_id" IS NULL
        AND "actor_or_service_id" IS NULL
        AND "trace_id" IS NULL
        AND "evaluated_fact_refs" = '[]'::jsonb
      )
      OR (
        NULLIF(BTRIM("canonical_event_id"), '') IS NOT NULL
        AND NULLIF(BTRIM("domain_fact_id"), '') IS NOT NULL
        AND NULLIF(BTRIM("actor_or_service_id"), '') IS NOT NULL
        AND length(BTRIM("trace_id")) BETWEEN 1 AND 128
        AND jsonb_array_length("evaluated_fact_refs") > 0
      )
    );

DO $verify_reconciliation_backfill$
DECLARE
  invalid_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM (
    SELECT application."id"
    FROM "node_event_application" AS application
    LEFT JOIN "outbox_message" AS message
      ON message."event_type" = 'work_execution.reconcile_applied_lifecycle_fact.requested'
     AND message."payload_ref" = 'node-event-application/' || application."id"
    WHERE application."state" = 'applied'
    GROUP BY application."id"
    HAVING COUNT(message."id") <> 1
  ) AS invalid;

  IF invalid_count > 0 THEN
    RAISE EXCEPTION
      'reconciliation outbox backfill failed: % applied node event applications do not have exactly one message',
      invalid_count;
  END IF;
END;
$verify_reconciliation_backfill$;

-- Upgrade verification for tenant scope (must return no rows):
-- SELECT task.id
-- FROM node_task AS task
-- JOIN flow_instance AS flow ON flow.id = task.flow_instance_id
-- JOIN container_record AS container ON container.id = flow.container_id
-- WHERE task.tenant_id IS DISTINCT FROM container.tenant_id;
-- Recovery: application rollback may leave additive columns/table unread. Preserve
-- work_order_fact_application and reconciliation Outbox as audit records; do not
-- drop them without an approved export and restore plan.
