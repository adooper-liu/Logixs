-- Persist the original typed claim receipt with the formal ClientOperation.
-- Existing operations are intentionally not reconstructed from mutable task rows.
BEGIN;

CREATE TABLE "client_operation_claim_result" (
  "client_operation_id" TEXT NOT NULL,
  "work_order_id" TEXT NOT NULL,
  "work_order_state" TEXT NOT NULL,
  "assignment_state" TEXT NOT NULL,
  "assignee_id" TEXT,
  "task_id" TEXT NOT NULL,
  "task_state" TEXT NOT NULL,
  "applied" BOOLEAN NOT NULL,
  "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "client_operation_claim_result_pkey"
    PRIMARY KEY ("client_operation_id"),
  CONSTRAINT "client_operation_claim_result_client_operation_id_fkey"
    FOREIGN KEY ("client_operation_id") REFERENCES "client_operation"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "client_operation_claim_result_work_order_state_check"
    CHECK ("work_order_state" IN (
      'draft', 'ready', 'in_progress', 'blocked', 'completed', 'failed',
      'reopened', 'cancelled'
    )),
  CONSTRAINT "client_operation_claim_result_assignment_state_check"
    CHECK ("assignment_state" IN (
      'unassigned', 'assigned', 'pool', 'automatic'
    )),
  CONSTRAINT "client_operation_claim_result_task_state_check"
    CHECK ("task_state" IN (
      'pending', 'in_progress', 'blocked', 'completed', 'reopened', 'cancelled'
    )),
  CONSTRAINT "client_operation_claim_result_actor_check"
    CHECK ("assignee_id" IS NULL OR length(btrim("assignee_id")) BETWEEN 1 AND 128),
  CONSTRAINT "client_operation_claim_result_applied_check"
    CHECK (
      NOT "applied"
      OR (
        "work_order_state" = 'in_progress'
        AND "assignment_state" = 'assigned'
        AND "assignee_id" IS NOT NULL
        AND "task_state" = 'in_progress'
      )
    )
);

CREATE INDEX "client_operation_claim_result_work_order_idx"
ON "client_operation_claim_result"("work_order_id");

CREATE INDEX "client_operation_claim_result_task_idx"
ON "client_operation_claim_result"("task_id");

CREATE FUNCTION "reject_client_operation_claim_result_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $client_operation_claim_result_immutable$
BEGIN
  RAISE EXCEPTION 'client_operation_claim_result is append-only';
END;
$client_operation_claim_result_immutable$;

CREATE TRIGGER "client_operation_claim_result_immutable"
BEFORE UPDATE OR DELETE ON "client_operation_claim_result"
FOR EACH ROW EXECUTE FUNCTION "reject_client_operation_claim_result_mutation"();

COMMIT;

-- Existing committed claim operations predate typed receipts and remain unchanged.
-- They cannot be backfilled without inventing the original state from mutable rows.
-- New successful claims write the operation and this receipt in one transaction.
-- Recovery: additive migration. Roll back the application first; preserve receipt rows
-- and roll forward with a corrective migration rather than dropping audit history.
