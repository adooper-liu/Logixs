BEGIN;

-- NPI → 选品退回：立项可回到选品队列（returned_from_npi），
-- 以独立 outcome 留下不可变退回事实（理由写在 reason）。
-- 不混入选品→经营的 return_to_market，也不混入产品定义发布枚举。

ALTER TABLE "product_initiative"
  DROP CONSTRAINT "product_initiative_outcome_check";

ALTER TABLE "product_initiative"
  ADD CONSTRAINT "product_initiative_outcome_check" CHECK (
    "outcome" IN (
      'approve',
      'defer',
      'reject',
      'return_to_market',
      'returned_from_npi'
    )
  );

ALTER TABLE "product_initiative"
  DROP CONSTRAINT "product_initiative_destination_check";

ALTER TABLE "product_initiative"
  ADD CONSTRAINT "product_initiative_destination_check" CHECK (
    "current_destination" IN (
      'needs_decision',
      'deferred',
      'rejected',
      'returned_to_market',
      'handed_off',
      'returned_from_npi'
    )
  );

ALTER TABLE "product_initiative"
  DROP CONSTRAINT "product_initiative_shape_check";

ALTER TABLE "product_initiative"
  ADD CONSTRAINT "product_initiative_shape_check" CHECK (
    (
      "outcome" = 'approve' AND
      "completion_state" = 'completed' AND
      "current_destination" = 'handed_off' AND
      "reason" IS NULL
    ) OR
    (
      "outcome" = 'defer' AND
      (("completion_state" = 'completed' AND "current_destination" = 'deferred' AND "reason" IS NOT NULL) OR
       ("completion_state" = 'pending_completion' AND "current_destination" = 'needs_decision' AND "reason" IS NULL))
    ) OR
    (
      "outcome" = 'reject' AND
      (("completion_state" = 'completed' AND "current_destination" = 'rejected' AND "reason" IS NOT NULL) OR
       ("completion_state" = 'pending_completion' AND "current_destination" = 'needs_decision' AND "reason" IS NULL))
    ) OR
    (
      "outcome" = 'return_to_market' AND
      (("completion_state" = 'completed' AND "current_destination" = 'returned_to_market' AND "reason" IS NOT NULL) OR
       ("completion_state" = 'pending_completion' AND "current_destination" = 'needs_decision' AND "reason" IS NULL))
    ) OR
    (
      "outcome" = 'returned_from_npi' AND
      "completion_state" = 'completed' AND
      "current_destination" = 'returned_from_npi' AND
      "reason" IS NOT NULL
    )
  );

COMMIT;
