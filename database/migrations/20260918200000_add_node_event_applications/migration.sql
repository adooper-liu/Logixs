-- A canonical event is received once, then evaluated independently for every eligible target node.
CREATE TABLE "node_event_application" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "target_node_instance_id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "evaluated_at" TIMESTAMPTZ NOT NULL,
    "guard_results" JSONB NOT NULL,
    "reason_code" TEXT,
    "applied_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "node_event_application_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "node_event_application_state_check"
      CHECK ("state" IN ('pending_application', 'applied', 'rejected')),
    CONSTRAINT "node_event_application_guards_check"
      CHECK (jsonb_typeof("guard_results") = 'array'),
    CONSTRAINT "node_event_application_reason_check"
      CHECK (
        ("state" = 'applied' AND "reason_code" IS NULL AND "applied_at" IS NOT NULL)
        OR ("state" <> 'applied' AND "reason_code" IS NOT NULL AND "applied_at" IS NULL)
      )
);

CREATE UNIQUE INDEX "node_event_application_event_target_key"
ON "node_event_application"("event_id", "target_node_instance_id");

CREATE INDEX "node_event_application_target_state_idx"
ON "node_event_application"("target_node_instance_id", "state", "evaluated_at");

ALTER TABLE "node_event_application"
ADD CONSTRAINT "node_event_application_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "canonical_event"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "node_event_application"
ADD CONSTRAINT "node_event_application_target_node_instance_id_fkey"
FOREIGN KEY ("target_node_instance_id") REFERENCES "node_instance"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Verification: one row per event/target pair; applied rows always have applied_at.
-- Recovery: retain these audit rows if application code rolls back; dropping them loses replay state.
