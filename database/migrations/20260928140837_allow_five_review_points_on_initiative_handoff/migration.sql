-- 与 product_initiative 对齐：评审要点现含 customer_feedback，最多 5 条。
ALTER TABLE "product_initiative_handoff"
  DROP CONSTRAINT "product_initiative_handoff_review_points_check";

ALTER TABLE "product_initiative_handoff"
  ADD CONSTRAINT "product_initiative_handoff_review_points_check" CHECK (
    jsonb_typeof("review_points") = 'array' AND
    jsonb_array_length("review_points") <= 5
  );
