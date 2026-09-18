-- 0.3: persist the server-confirmed object reference used by read-only assistant sessions.
ALTER TABLE "ops_assistant_session"
  ADD COLUMN "container_id" TEXT;

-- Existing notification-backed sessions inherit only an already-confirmed object
-- reference. Unlinked notifications remain null; no entity_type guess is made.
UPDATE "ops_assistant_session" AS session
SET "container_id" = notification."container_id"
FROM "ops_notification" AS notification
WHERE session."notification_id" = notification."id"
  AND notification."container_id" IS NOT NULL;

CREATE INDEX "ops_assistant_session_container_idx"
  ON "ops_assistant_session"("tenant_id", "container_id", "created_at");

-- Verification (must return no rows after upgrade):
-- SELECT session.id
-- FROM ops_assistant_session AS session
-- JOIN ops_notification AS notification ON notification.id = session.notification_id
-- WHERE notification.container_id IS NOT NULL
--   AND session.container_id IS DISTINCT FROM notification.container_id;
--
-- Recovery: deploy the previous application first, then drop the index and the
-- additive container_id column. Existing notification/message rows are untouched.
