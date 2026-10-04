BEGIN;

ALTER TABLE "product_initiative" ADD COLUMN "return_basis" TEXT;
ALTER TABLE "product_initiative" ADD CONSTRAINT "product_initiative_return_basis_check" CHECK (
  "return_basis" IS NULL OR "return_basis" IN ('insufficient_evidence', 'wrong_direction')
);
ALTER TABLE "product_initiative" DROP CONSTRAINT "product_initiative_destination_check";
ALTER TABLE "product_initiative" ADD CONSTRAINT "product_initiative_destination_check" CHECK (
  "current_destination" IN ('needs_decision', 'deferred', 'rejected', 'return_requested', 'returned_to_market', 'handed_off', 'returned_from_npi')
);
ALTER TABLE "product_initiative" DROP CONSTRAINT "product_initiative_shape_check";
ALTER TABLE "product_initiative" ADD CONSTRAINT "product_initiative_shape_check" CHECK (
  ("outcome" = 'approve' AND "completion_state" = 'completed' AND "current_destination" = 'handed_off' AND "reason" IS NULL AND "return_basis" IS NULL) OR
  ("outcome" = 'defer' AND "return_basis" IS NULL AND (("completion_state" = 'completed' AND "current_destination" = 'deferred' AND "reason" IS NOT NULL) OR ("completion_state" = 'pending_completion' AND "current_destination" = 'needs_decision' AND "reason" IS NULL))) OR
  ("outcome" = 'reject' AND "return_basis" IS NULL AND (("completion_state" = 'completed' AND "current_destination" = 'rejected' AND "reason" IS NOT NULL) OR ("completion_state" = 'pending_completion' AND "current_destination" = 'needs_decision' AND "reason" IS NULL))) OR
  ("outcome" = 'return_to_market' AND (("completion_state" = 'completed' AND "current_destination" = 'return_requested' AND "reason" IS NOT NULL AND "return_basis" IS NOT NULL) OR ("completion_state" = 'completed' AND "current_destination" = 'returned_to_market' AND "reason" IS NOT NULL) OR ("completion_state" = 'pending_completion' AND "current_destination" = 'needs_decision' AND ("reason" IS NULL OR "return_basis" IS NULL)))) OR
  ("outcome" = 'returned_from_npi' AND "completion_state" = 'completed' AND "current_destination" = 'returned_from_npi' AND "reason" IS NOT NULL AND "return_basis" IS NULL)
);
ALTER TABLE "product_initiative" DROP CONSTRAINT "product_initiative_pending_codes_check";
ALTER TABLE "product_initiative" ADD CONSTRAINT "product_initiative_pending_codes_check" CHECK (
  "pending_field_codes" <@ ARRAY['objective', 'target_user_and_market', 'competitive_supply', 'price_band_and_margin', 'compliance_risk', 'customer_feedback', 'defer_reason', 'reject_reason', 'return_basis', 'return_reason']::TEXT[]
);

ALTER TABLE "market_signal" DROP CONSTRAINT "market_signal_destination_check";
ALTER TABLE "market_signal" ADD CONSTRAINT "market_signal_destination_check" CHECK (
  "current_destination" IN ('needs_decision', 'watching', 'handed_off', 'dismissed', 'selection_return_requested', 'returned_from_selection', 'voided', 'archived')
);
ALTER TABLE "market_signal_decision" ADD COLUMN "return_basis" TEXT;
ALTER TABLE "market_signal_decision" ADD CONSTRAINT "market_signal_decision_return_basis_check" CHECK (
  "return_basis" IS NULL OR "return_basis" IN ('insufficient_evidence', 'wrong_direction')
);
ALTER TABLE "market_signal_decision" DROP CONSTRAINT "market_signal_decision_type_check";
ALTER TABLE "market_signal_decision" ADD CONSTRAINT "market_signal_decision_type_check" CHECK (
  "decision_type" IN ('watch', 'handoff', 'dismiss', 'selection_return_request', 'selection_return', 'void', 'archive')
);
ALTER TABLE "market_signal_decision" DROP CONSTRAINT "market_signal_decision_shape_check";
ALTER TABLE "market_signal_decision" ADD CONSTRAINT "market_signal_decision_shape_check" CHECK (
  ("decision_type" = 'watch' AND "return_basis" IS NULL AND "opportunity_statement" IS NULL AND "dismiss_reason" IS NULL AND (("completion_state" = 'completed' AND "next_review_date" IS NOT NULL) OR "completion_state" = 'pending_completion')) OR
  ("decision_type" = 'handoff' AND "return_basis" IS NULL AND "completion_state" = 'completed' AND "next_review_date" IS NULL AND "watch_focus" IS NULL AND "waiting_reason" IS NULL AND "dismiss_reason" IS NULL) OR
  ("decision_type" = 'dismiss' AND "return_basis" IS NULL AND "opportunity_statement" IS NULL AND "next_review_date" IS NULL AND "watch_focus" IS NULL AND "waiting_reason" IS NULL AND (("completion_state" = 'completed' AND "dismiss_reason" IS NOT NULL) OR ("completion_state" = 'pending_completion' AND "dismiss_reason" IS NULL))) OR
  ("decision_type" = 'selection_return_request' AND "completion_state" = 'completed' AND "return_basis" IS NOT NULL AND "opportunity_statement" IS NULL AND "next_review_date" IS NULL AND "watch_focus" IS NULL AND "waiting_reason" IS NULL AND "dismiss_reason" IS NULL AND "judgment_note" IS NOT NULL) OR
  ("decision_type" = 'selection_return' AND "completion_state" = 'completed' AND "return_basis" IS NULL AND "opportunity_statement" IS NULL AND "next_review_date" IS NULL AND "watch_focus" IS NULL AND "waiting_reason" IS NULL AND "dismiss_reason" IS NULL AND "judgment_note" IS NOT NULL) OR
  ("decision_type" IN ('void', 'archive') AND "return_basis" IS NULL AND "opportunity_statement" IS NULL AND "next_review_date" IS NULL AND "watch_focus" IS NULL AND "waiting_reason" IS NULL AND "dismiss_reason" IS NULL AND (("completion_state" = 'completed' AND "judgment_note" IS NOT NULL) OR ("completion_state" = 'pending_completion' AND "judgment_note" IS NULL)))
);

COMMIT;
