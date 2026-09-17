-- Additive task-condition projection. Existing task state values keep their meaning.
ALTER TABLE "node_task"
  ADD COLUMN "applicability" TEXT NOT NULL DEFAULT 'required',
  ADD COLUMN "readiness_state" TEXT NOT NULL DEFAULT 'waiting_conditions',
  ADD COLUMN "completion_eligibility" TEXT NOT NULL DEFAULT 'awaiting_evidence',
  ADD COLUMN "condition_fact_refs" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "conditions_evaluated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "node_task"
  ADD CONSTRAINT "node_task_applicability_check"
    CHECK ("applicability" IN ('required', 'optional_applicable', 'optional_not_applicable')),
  ADD CONSTRAINT "node_task_readiness_state_check"
    CHECK ("readiness_state" IN ('waiting_conditions', 'ready')),
  ADD CONSTRAINT "node_task_completion_eligibility_check"
    CHECK ("completion_eligibility" IN ('awaiting_evidence', 'eligible')),
  ADD CONSTRAINT "node_task_condition_fact_refs_array_check"
    CHECK (jsonb_typeof("condition_fact_refs") = 'array');

-- Tasks created under the previous contract were activated tasks and therefore ready.
UPDATE "node_task" AS task
SET
  "applicability" = node."applicability",
  "readiness_state" = 'ready',
  "conditions_evaluated_at" = CURRENT_TIMESTAMP
FROM "node_instance" AS node
WHERE node."id" = task."node_instance_id";

-- A real container number starts the container lifecycle. Header-only replenishment
-- orders remain outside FlowInstance until the number is bound.
INSERT INTO "flow_instance" (
  "id",
  "container_id",
  "state",
  "current_node_code",
  "version",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid()::text,
  container."id",
  'active',
  'cargo_ready',
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "container_record" AS container
WHERE NULLIF(BTRIM(container."container_number"), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "flow_instance" AS flow
    WHERE flow."container_id" = container."id"
  );

WITH node_catalog("node_code", "sequence", "applicability") AS (
  VALUES
    ('cargo_ready', 1, 'required'),
    ('container_stuffing', 2, 'required'),
    ('shipment_dispatch', 3, 'required'),
    ('origin_departure', 4, 'required'),
    ('ocean_transit', 5, 'required'),
    ('transshipment', 6, 'optional_applicable'),
    ('customs_clearance', 7, 'required'),
    ('destination_arrival', 8, 'required'),
    ('rail_transfer', 9, 'optional_applicable'),
    ('container_pickup', 10, 'required'),
    ('warehouse_delivery', 11, 'required'),
    ('container_unloading', 12, 'required'),
    ('container_unstuffing', 13, 'required'),
    ('empty_return', 14, 'required')
)
INSERT INTO "node_instance" (
  "id",
  "flow_instance_id",
  "node_code",
  "state",
  "applicability",
  "completed_at"
)
SELECT
  gen_random_uuid()::text,
  flow."id",
  catalog."node_code",
  CASE
    WHEN catalog."node_code" = flow."current_node_code" THEN 'active'
    ELSE 'pending'
  END,
  catalog."applicability",
  NULL
FROM "flow_instance" AS flow
CROSS JOIN node_catalog AS catalog
ON CONFLICT ("flow_instance_id", "node_code") DO NOTHING;

WITH matched_facts AS (
  SELECT
    node."id" AS "node_instance_id",
    COALESCE(
      jsonb_agg(fact."id" ORDER BY fact."created_at", fact."id")
        FILTER (WHERE fact."id" IS NOT NULL),
      '[]'::jsonb
    ) AS "fact_refs",
    COALESCE(
      bool_or(
        fact."time_kind" = 'actual'
        AND fact."capture_source" <> 'system_derived'
        AND fact."evidence_ref" IS NOT NULL
      ),
      FALSE
    ) AS "has_completion_fact",
    count(fact."id") > 0 AS "has_condition_fact"
  FROM "node_instance" AS node
  JOIN "flow_instance" AS flow ON flow."id" = node."flow_instance_id"
  LEFT JOIN "shipment_time_fact" AS fact
    ON fact."container_record_id" = flow."container_id"
    AND fact."is_current" = TRUE
    AND CASE fact."fact_code"
      WHEN 'customs_clearance_completed' THEN 'customs_clearance'
      WHEN 'container_unloading_completed' THEN 'container_unloading'
      WHEN 'container_empty_confirmed' THEN 'empty_return'
      WHEN 'container_empty_estimated' THEN 'empty_return'
      ELSE NULL
    END = node."node_code"
  GROUP BY node."id"
)
INSERT INTO "node_task" (
  "id",
  "flow_instance_id",
  "node_instance_id",
  "node_code",
  "container_id",
  "task_definition_key",
  "state",
  "applicability",
  "readiness_state",
  "completion_eligibility",
  "condition_fact_refs",
  "conditions_evaluated_at",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid()::text,
  flow."id",
  node."id",
  node."node_code",
  flow."container_id",
  'node-' || node."node_code",
  'pending',
  node."applicability",
  CASE
    WHEN node."node_code" = flow."current_node_code" OR facts."has_condition_fact"
      THEN 'ready'
    ELSE 'waiting_conditions'
  END,
  CASE
    WHEN facts."has_completion_fact" THEN 'eligible'
    ELSE 'awaiting_evidence'
  END,
  facts."fact_refs",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "node_instance" AS node
JOIN "flow_instance" AS flow ON flow."id" = node."flow_instance_id"
JOIN matched_facts AS facts ON facts."node_instance_id" = node."id"
ON CONFLICT ("node_instance_id") DO NOTHING;

INSERT INTO "work_order" (
  "id",
  "node_task_id",
  "work_order_definition_key",
  "state",
  "assignment_state",
  "assignee_id",
  "completed_at",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid()::text,
  task."id",
  'wo-' || task."node_code",
  CASE WHEN task."readiness_state" = 'ready' THEN 'ready' ELSE 'draft' END,
  'unassigned',
  NULL,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "node_task" AS task
WHERE NOT EXISTS (
  SELECT 1
  FROM "work_order" AS work_order
  WHERE work_order."node_task_id" = task."id"
);

-- Verification (must return no rows after upgrade):
-- SELECT container.id
-- FROM container_record AS container
-- LEFT JOIN flow_instance AS flow ON flow.container_id = container.id
-- WHERE NULLIF(BTRIM(container.container_number), '') IS NOT NULL
--   AND flow.id IS NULL;
-- SELECT flow.id
-- FROM flow_instance AS flow
-- LEFT JOIN node_instance AS node ON node.flow_instance_id = flow.id
-- LEFT JOIN node_task AS task ON task.node_instance_id = node.id
-- GROUP BY flow.id
-- HAVING count(node.id) <> 14 OR count(task.id) <> 14;

-- Recovery: application code remains backward compatible while rolling back.
-- After restoring the pre-migration application, drop only rows identified by an
-- audited deployment timestamp, then drop the four constraints and five columns.
-- Do not delete pre-existing FlowInstance/NodeTask rows during recovery.
