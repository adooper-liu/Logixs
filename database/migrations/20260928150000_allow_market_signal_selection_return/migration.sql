BEGIN;

-- 选品退回闭环：信号可回到经营队列（returned_from_selection），
-- 并以 selection_return 决策留下不可变退回事实（理由写在 judgment_note）。

ALTER TABLE "market_signal"
  DROP CONSTRAINT "market_signal_destination_check";

ALTER TABLE "market_signal"
  ADD CONSTRAINT "market_signal_destination_check" CHECK (
    "current_destination" IN (
      'needs_decision',
      'watching',
      'handed_off',
      'dismissed',
      'returned_from_selection'
    )
  );

ALTER TABLE "market_signal_decision"
  DROP CONSTRAINT "market_signal_decision_type_check";

ALTER TABLE "market_signal_decision"
  ADD CONSTRAINT "market_signal_decision_type_check" CHECK (
    "decision_type" IN ('watch', 'handoff', 'dismiss', 'selection_return')
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
    )
  );

COMMIT;
