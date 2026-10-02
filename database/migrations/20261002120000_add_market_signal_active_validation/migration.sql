BEGIN;

-- 市场信号「单一当前验证承诺」：决定历史继续由 market_signal_decision 持有，
-- market_signal 上只保存可重建的当前投影，供队列、详情和跨班次续做。
ALTER TABLE "market_signal_decision"
  ADD COLUMN "waiting_reason" TEXT;

ALTER TABLE "market_signal"
  ADD COLUMN "active_validation_owner_actor_id" TEXT,
  ADD COLUMN "active_validation_due_date" DATE,
  ADD COLUMN "active_validation_focus" TEXT,
  ADD COLUMN "active_validation_waiting_reason" TEXT;

ALTER TABLE "market_signal_decision"
  ADD CONSTRAINT "market_signal_decision_waiting_reason_check" CHECK (
    "waiting_reason" IS NULL OR
    length(btrim("waiting_reason")) BETWEEN 1 AND 500
  );

ALTER TABLE "market_signal"
  ADD CONSTRAINT "market_signal_active_validation_shape_check" CHECK (
    (
      "active_validation_owner_actor_id" IS NULL AND
      "active_validation_due_date" IS NULL AND
      "active_validation_focus" IS NULL AND
      "active_validation_waiting_reason" IS NULL
    ) OR (
      "active_validation_owner_actor_id" IS NOT NULL AND
      "active_validation_due_date" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "market_signal_active_validation_text_check" CHECK (
    (
      "active_validation_owner_actor_id" IS NULL OR
      length(btrim("active_validation_owner_actor_id")) BETWEEN 1 AND 200
    ) AND (
      "active_validation_focus" IS NULL OR
      length(btrim("active_validation_focus")) BETWEEN 1 AND 4000
    ) AND (
      "active_validation_waiting_reason" IS NULL OR
      length(btrim("active_validation_waiting_reason")) BETWEEN 1 AND 500
    )
  );

-- waiting_reason 只属于 watch。旧 completed watch 可能没有 focus；历史不可变，
-- 因而数据库继续容忍旧行，应用层对所有新 completed watch 强制 date + focus。
ALTER TABLE "market_signal_decision"
  DROP CONSTRAINT "market_signal_decision_shape_check";

ALTER TABLE "market_signal_decision"
  ADD CONSTRAINT "market_signal_decision_shape_check" CHECK (
    (
      "decision_type" = 'watch' AND
      "opportunity_statement" IS NULL AND
      "dismiss_reason" IS NULL AND
      (("completion_state" = 'completed' AND "next_review_date" IS NOT NULL) OR
       ("completion_state" = 'pending_completion'))
    ) OR (
      "decision_type" = 'handoff' AND
      "completion_state" = 'completed' AND
      "next_review_date" IS NULL AND
      "watch_focus" IS NULL AND
      "waiting_reason" IS NULL AND
      "dismiss_reason" IS NULL
    ) OR (
      "decision_type" = 'dismiss' AND
      "opportunity_statement" IS NULL AND
      "next_review_date" IS NULL AND
      "watch_focus" IS NULL AND
      "waiting_reason" IS NULL AND
      (("completion_state" = 'completed' AND "dismiss_reason" IS NOT NULL) OR
       ("completion_state" = 'pending_completion' AND "dismiss_reason" IS NULL))
    ) OR (
      "decision_type" = 'selection_return' AND
      "completion_state" = 'completed' AND
      "opportunity_statement" IS NULL AND
      "next_review_date" IS NULL AND
      "watch_focus" IS NULL AND
      "waiting_reason" IS NULL AND
      "dismiss_reason" IS NULL AND
      "judgment_note" IS NOT NULL
    ) OR (
      "decision_type" IN ('void', 'archive') AND
      "opportunity_statement" IS NULL AND
      "next_review_date" IS NULL AND
      "watch_focus" IS NULL AND
      "waiting_reason" IS NULL AND
      "dismiss_reason" IS NULL AND
      (("completion_state" = 'completed' AND "judgment_note" IS NOT NULL) OR
       ("completion_state" = 'pending_completion' AND "judgment_note" IS NULL))
    )
  );

ALTER TABLE "market_signal_decision"
  DROP CONSTRAINT "market_signal_decision_text_check";

ALTER TABLE "market_signal_decision"
  ADD CONSTRAINT "market_signal_decision_text_check" CHECK (
    ("judgment_note" IS NULL OR length(btrim("judgment_note")) BETWEEN 1 AND 4000) AND
    ("opportunity_statement" IS NULL OR length(btrim("opportunity_statement")) BETWEEN 1 AND 4000) AND
    ("watch_focus" IS NULL OR length(btrim("watch_focus")) BETWEEN 1 AND 4000) AND
    ("dismiss_reason" IS NULL OR length(btrim("dismiss_reason")) BETWEEN 1 AND 500) AND
    length(btrim("created_by")) BETWEEN 1 AND 200 AND
    length(btrim("idempotency_key")) BETWEEN 1 AND 200
  );

ALTER TABLE "market_signal_decision"
  DROP CONSTRAINT "market_signal_decision_pending_codes_check";

ALTER TABLE "market_signal_decision"
  ADD CONSTRAINT "market_signal_decision_pending_codes_check" CHECK (
    "pending_field_codes" <@ ARRAY[
      'market_code', 'channel_code', 'category_ref', 'observed_fact_summary',
      'hypothesis', 'evidence_refs', 'opportunity_statement',
      'next_review_date', 'watch_focus', 'dismiss_reason', 'close_reason'
    ]::TEXT[]
  );

-- 当前处于 watching 的旧记录，从最新 completed watch 回填；不从 judgment_note
-- 猜 focus，也不为旧行制造 waiting reason。
WITH latest_watch AS (
  SELECT DISTINCT ON (d."signal_id")
    d."signal_id",
    d."created_by",
    d."next_review_date",
    d."watch_focus"
  FROM "market_signal_decision" d
  JOIN "market_signal" s
    ON s."id" = d."signal_id" AND s."tenant_id" = d."tenant_id"
  WHERE s."current_destination" = 'watching'
    AND d."decision_type" = 'watch'
    AND d."completion_state" = 'completed'
  ORDER BY d."signal_id", d."decision_version" DESC
)
UPDATE "market_signal" s
SET
  "active_validation_owner_actor_id" = w."created_by",
  "active_validation_due_date" = w."next_review_date",
  "active_validation_focus" = w."watch_focus",
  "active_validation_waiting_reason" = NULL
FROM latest_watch w
WHERE s."id" = w."signal_id";

CREATE INDEX "market_signal_validation_queue_idx"
  ON "market_signal"(
    "tenant_id",
    "current_destination",
    "active_validation_due_date" ASC,
    "updated_at" DESC,
    "id" DESC
  );

COMMIT;

-- Verification after deploy:
-- SELECT id, active_validation_owner_actor_id, active_validation_due_date,
--        active_validation_focus, active_validation_waiting_reason
-- FROM market_signal WHERE current_destination = 'watching';
-- Recovery before any business write: drop the index, new constraints and columns,
-- then restore the prior decision constraints. After business writes exist, preserve data
-- and roll forward with a corrective migration.
