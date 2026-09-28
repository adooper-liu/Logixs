-- #73 把「售后原声」落到 customer_feedback 要点后，领域层会把它写入
-- pending_field_codes（非门槛缺口，立项仍可完成）。原 CHECK 未收录该码，
-- 且 review_points 仍限制 ≤4，导致立项写入 23514。
ALTER TABLE "product_initiative"
  DROP CONSTRAINT "product_initiative_pending_codes_check",
  DROP CONSTRAINT "product_initiative_review_points_check";

ALTER TABLE "product_initiative"
  ADD CONSTRAINT "product_initiative_pending_codes_check" CHECK (
    "pending_field_codes" <@ ARRAY[
      'objective', 'target_user_and_market', 'competitive_supply',
      'price_band_and_margin', 'compliance_risk', 'customer_feedback',
      'defer_reason', 'reject_reason', 'return_reason'
    ]::TEXT[]
  ),
  ADD CONSTRAINT "product_initiative_review_points_check" CHECK (
    jsonb_typeof("review_points") = 'array' AND
    jsonb_array_length("review_points") <= 5
  );
