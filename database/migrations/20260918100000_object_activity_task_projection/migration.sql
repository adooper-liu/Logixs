-- 0.1 + 0.2: additive object references, occurrence time, and work-order due time.
ALTER TABLE "work_order"
  ADD COLUMN "due_at" TIMESTAMPTZ;

ALTER TABLE "ops_notification"
  ADD COLUMN "container_id" TEXT,
  ADD COLUMN "task_id" TEXT,
  ADD COLUMN "work_order_id" TEXT,
  ADD COLUMN "occurred_at" TIMESTAMPTZ;

-- Existing notifications were generated inside Logix; their creation time is the
-- only defensible occurrence time. Preserve it explicitly instead of reinterpreting
-- future imported/business timestamps as created_at.
UPDATE "ops_notification"
SET "occurred_at" = "created_at";

ALTER TABLE "ops_notification"
  ALTER COLUMN "occurred_at" SET NOT NULL;

-- Backfill only registered entity types. Unknown historical entity types remain
-- unlinked and visible in the global notification list; no guessed relation is made.
UPDATE "ops_notification"
SET "container_id" = "entity_id"
WHERE "entity_type" = 'container';

UPDATE "ops_notification"
SET "task_id" = "entity_id"
WHERE "entity_type" = 'node_task';

UPDATE "ops_notification"
SET "work_order_id" = "entity_id"
WHERE "entity_type" = 'work_order';

UPDATE "ops_notification" AS notification
SET "container_id" = task."container_id"
FROM "node_task" AS task
WHERE notification."task_id" = task."id"
  AND notification."container_id" IS NULL;

UPDATE "ops_notification" AS notification
SET
  "task_id" = work_order."node_task_id",
  "container_id" = task."container_id"
FROM "work_order" AS work_order
JOIN "node_task" AS task ON task."id" = work_order."node_task_id"
WHERE notification."work_order_id" = work_order."id"
  AND notification."task_id" IS NULL
  AND notification."container_id" IS NULL;

CREATE INDEX "ops_notification_container_activity_idx"
  ON "ops_notification"("tenant_id", "container_id", "occurred_at", "id");

CREATE INDEX "ops_notification_task_idx"
  ON "ops_notification"("tenant_id", "task_id");

-- Verification (all queries must return no rows after upgrade):
-- SELECT id FROM ops_notification WHERE occurred_at IS NULL;
-- SELECT notification.id
-- FROM ops_notification AS notification
-- JOIN node_task AS task ON task.id = notification.task_id
-- WHERE notification.container_id IS DISTINCT FROM task.container_id;
-- SELECT notification.id
-- FROM ops_notification AS notification
-- JOIN work_order AS work_order ON work_order.id = notification.work_order_id
-- WHERE notification.task_id IS DISTINCT FROM work_order.node_task_id;

-- Recovery: deploy the previous application first, then drop the two indexes and
-- the five additive columns. No existing row or legacy entity_type/entity_id value
-- is changed, so restoring the old application does not require data deletion.
