BEGIN;

-- 市场信号作废 / 归档（HW-D18 B 片）：去向 voided/archived，决策 void/archive。
-- 关闭理由落在 judgment_note；完成关闭时由应用层 supersede 当前机会交接。

ALTER TABLE "market_signal"
  DROP CONSTRAINT "market_signal_destination_check";

ALTER TABLE "market_signal"
  ADD CONSTRAINT "market_signal_destination_check" CHECK (
    "current_destination" IN (
      'needs_decision',
      'watching',
      'handed_off',
      'dismissed',
      'returned_from_selection',
      'voided',
      'archived'
    )
  );

ALTER TABLE "market_signal_decision"
  DROP CONSTRAINT "market_signal_decision_type_check";

ALTER TABLE "market_signal_decision"
  ADD CONSTRAINT "market_signal_decision_type_check" CHECK (
    "decision_type" IN (
      'watch', 'handoff', 'dismiss', 'selection_return', 'void', 'archive'
    )
  );

ALTER TABLE "market_signal_decision"
  DROP CONSTRAINT "market_signal_decision_shape_check";

ALTER TABLE "market_signal_decision"
  ADD CONSTRAINT "market_signal_decision_shape_check" CHECK (
    (
      "decision_type" = 'watch' AND
      "opportunity_statement" IS NULL AND
      "dismiss_reason" IS NULL AND
      (("completion_state" = 'completed' AND "next_review_date" IS NOT NULL) OR
       ("completion_state" = 'pending_completion' AND "next_review_date" IS NULL))
    ) OR
    (
      "decision_type" = 'handoff' AND
      "completion_state" = 'completed' AND
      "next_review_date" IS NULL AND
      "watch_focus" IS NULL AND
      "dismiss_reason" IS NULL
    ) OR
    (
      "decision_type" = 'dismiss' AND
      "opportunity_statement" IS NULL AND
      "next_review_date" IS NULL AND
      "watch_focus" IS NULL AND
      (("completion_state" = 'completed' AND "dismiss_reason" IS NOT NULL) OR
       ("completion_state" = 'pending_completion' AND "dismiss_reason" IS NULL))
    ) OR
    (
      "decision_type" = 'selection_return' AND
      "completion_state" = 'completed' AND
      "opportunity_statement" IS NULL AND
      "next_review_date" IS NULL AND
      "watch_focus" IS NULL AND
      "dismiss_reason" IS NULL AND
      "judgment_note" IS NOT NULL
    ) OR
    (
      "decision_type" IN ('void', 'archive') AND
      "opportunity_statement" IS NULL AND
      "next_review_date" IS NULL AND
      "watch_focus" IS NULL AND
      "dismiss_reason" IS NULL AND
      (("completion_state" = 'completed' AND "judgment_note" IS NOT NULL) OR
       ("completion_state" = 'pending_completion' AND "judgment_note" IS NULL))
    )
  );

ALTER TABLE "market_signal_decision"
  DROP CONSTRAINT "market_signal_decision_pending_codes_check";

ALTER TABLE "market_signal_decision"
  ADD CONSTRAINT "market_signal_decision_pending_codes_check" CHECK (
    "pending_field_codes" <@ ARRAY[
      'market_code', 'channel_code', 'category_ref', 'observed_fact_summary',
      'hypothesis', 'evidence_refs', 'opportunity_statement',
      'next_review_date', 'dismiss_reason', 'close_reason'
    ]::TEXT[]
  );

COMMIT;
