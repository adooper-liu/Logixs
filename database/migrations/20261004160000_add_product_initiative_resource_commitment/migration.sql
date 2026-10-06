BEGIN;

ALTER TABLE "product_initiative"
  ADD COLUMN "responsibility_accepted" BOOLEAN,
  ADD COLUMN "receiving_team_or_role" TEXT,
  ADD COLUMN "resource_description" TEXT,
  ADD COLUMN "target_date" DATE,
  ADD COLUMN "next_decision_date" DATE,
  ADD COLUMN "next_decision_question" TEXT,
  ADD COLUMN "validation_focus" TEXT,
  ADD COLUMN "reconsideration_date" DATE;

ALTER TABLE "product_initiative_handoff"
  ADD COLUMN "responsibility_accepted" BOOLEAN,
  ADD COLUMN "receiving_team_or_role" TEXT,
  ADD COLUMN "resource_description" TEXT,
  ADD COLUMN "target_date" DATE,
  ADD COLUMN "next_decision_date" DATE,
  ADD COLUMN "next_decision_question" TEXT;

-- 存量行全部为 NULL，原样保留；资源承诺完整提交，暂缓计划允许待补半组。
ALTER TABLE "product_initiative"
  ADD CONSTRAINT "product_initiative_resource_commitment_shape_check" CHECK (
    (
      "responsibility_accepted" IS NULL AND
      "receiving_team_or_role" IS NULL AND
      "resource_description" IS NULL AND
      "target_date" IS NULL AND
      "next_decision_date" IS NULL AND
      "next_decision_question" IS NULL
    ) OR (
      "outcome" IN ('approve', 'returned_from_npi') AND
      "responsibility_accepted" IS TRUE AND
      "receiving_team_or_role" IS NOT NULL AND
      "resource_description" IS NOT NULL AND
      "target_date" IS NOT NULL AND
      "next_decision_date" IS NOT NULL AND
      "next_decision_question" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "product_initiative_defer_plan_shape_check" CHECK (
    (
      "outcome" <> 'defer' AND
      "validation_focus" IS NULL AND
      "reconsideration_date" IS NULL
    ) OR (
      "outcome" = 'defer' AND (
        (
          "validation_focus" IS NOT NULL AND
          "reconsideration_date" IS NOT NULL AND
          "completion_state" = 'completed' AND
          "current_destination" = 'deferred'
        ) OR (
          ("validation_focus" IS NULL OR "reconsideration_date" IS NULL) AND
          "completion_state" = 'pending_completion' AND
          "current_destination" = 'needs_decision'
        )
      )
    )
  ) NOT VALID,
  ADD CONSTRAINT "product_initiative_commitment_text_check" CHECK (
    ("receiving_team_or_role" IS NULL OR length(btrim("receiving_team_or_role")) BETWEEN 1 AND 200) AND
    ("resource_description" IS NULL OR length(btrim("resource_description")) BETWEEN 1 AND 2000) AND
    ("next_decision_question" IS NULL OR length(btrim("next_decision_question")) BETWEEN 1 AND 1000) AND
    ("validation_focus" IS NULL OR length(btrim("validation_focus")) BETWEEN 1 AND 2000)
  );

ALTER TABLE "product_initiative_handoff"
  ADD CONSTRAINT "product_initiative_handoff_resource_commitment_shape_check" CHECK (
    (
      "responsibility_accepted" IS NULL AND
      "receiving_team_or_role" IS NULL AND
      "resource_description" IS NULL AND
      "target_date" IS NULL AND
      "next_decision_date" IS NULL AND
      "next_decision_question" IS NULL
    ) OR (
      "responsibility_accepted" IS TRUE AND
      "receiving_team_or_role" IS NOT NULL AND
      "resource_description" IS NOT NULL AND
      "target_date" IS NOT NULL AND
      "next_decision_date" IS NOT NULL AND
      "next_decision_question" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "product_initiative_handoff_commitment_text_check" CHECK (
    ("receiving_team_or_role" IS NULL OR length(btrim("receiving_team_or_role")) BETWEEN 1 AND 200) AND
    ("resource_description" IS NULL OR length(btrim("resource_description")) BETWEEN 1 AND 2000) AND
    ("next_decision_question" IS NULL OR length(btrim("next_decision_question")) BETWEEN 1 AND 1000)
  );

ALTER TABLE "product_initiative"
  DROP CONSTRAINT "product_initiative_pending_codes_check";
ALTER TABLE "product_initiative"
  ADD CONSTRAINT "product_initiative_pending_codes_check" CHECK (
    "pending_field_codes" <@ ARRAY[
      'objective', 'target_user_and_market', 'competitive_supply',
      'price_band_and_margin', 'compliance_risk', 'customer_feedback',
      'defer_reason', 'responsibility_commitment', 'receiving_team_or_role',
      'resource_description', 'target_date', 'next_decision_date',
      'next_decision_question', 'validation_focus', 'reconsideration_date',
      'reject_reason', 'return_basis', 'return_reason'
    ]::TEXT[]
  );

CREATE INDEX "product_initiative_reconsideration_queue_idx"
  ON "product_initiative"(
    "tenant_id", "current_destination", "reconsideration_date", "updated_at" DESC, "id" DESC
  );

COMMIT;

-- Verification after deploy:
-- SELECT responsibility_accepted, receiving_team_or_role, reconsideration_date
-- FROM product_initiative ORDER BY updated_at DESC LIMIT 10;
-- Recovery before any new writes: drop the index, constraints, and added columns.
-- After new writes exist, preserve the rows and roll forward with a corrective migration.
