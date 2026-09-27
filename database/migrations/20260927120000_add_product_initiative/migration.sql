BEGIN;

CREATE TABLE "product_initiative" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "handoff_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "outcome" TEXT NOT NULL,
  "completion_state" TEXT NOT NULL,
  "current_destination" TEXT NOT NULL,
  "responsible_actor_id" TEXT NOT NULL,
  "objective" TEXT,
  "review_points" JSONB NOT NULL,
  "reason" TEXT,
  "pending_field_codes" TEXT[] NOT NULL,
  "acted_by" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "product_initiative_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_initiative_outcome_check" CHECK (
    "outcome" IN ('approve', 'defer', 'reject', 'return_to_market')
  ),
  CONSTRAINT "product_initiative_completion_check" CHECK (
    "completion_state" IN ('pending_completion', 'completed')
  ),
  CONSTRAINT "product_initiative_destination_check" CHECK (
    "current_destination" IN ('needs_decision', 'deferred', 'rejected', 'returned_to_market', 'handed_off')
  ),
  CONSTRAINT "product_initiative_version_check" CHECK ("version" >= 1),
  -- 去向与完成度必须自洽：只有立项能交到产品侧；其余三个去向都是"原因填了就关闭，
  -- 没填就保存但不关闭"，不允许出现"已暂缓但没原因"这种半状态。
  CONSTRAINT "product_initiative_shape_check" CHECK (
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
    )
  ),
  CONSTRAINT "product_initiative_text_check" CHECK (
    ("objective" IS NULL OR length(btrim("objective")) BETWEEN 1 AND 4000) AND
    ("reason" IS NULL OR length(btrim("reason")) BETWEEN 1 AND 500) AND
    length(btrim("responsible_actor_id")) BETWEEN 1 AND 200 AND
    length(btrim("acted_by")) BETWEEN 1 AND 200 AND
    length(btrim("idempotency_key")) BETWEEN 1 AND 200
  ),
  -- 元素内部形状由领域层校验：CHECK 不允许子查询，无法在数据库里逐元素断言。
  -- 这里只保证它是数组且不超过四个要点。
  CONSTRAINT "product_initiative_review_points_check" CHECK (
    jsonb_typeof("review_points") = 'array' AND
    jsonb_array_length("review_points") <= 4
  ),
  CONSTRAINT "product_initiative_pending_codes_check" CHECK (
    "pending_field_codes" <@ ARRAY[
      'objective', 'target_user_and_market', 'competitive_supply',
      'price_band_and_margin', 'compliance_risk',
      'defer_reason', 'reject_reason', 'return_reason'
    ]::TEXT[]
  ),
  CONSTRAINT "product_initiative_payload_hash_check" CHECK ("payload_hash" ~ '^[a-f0-9]{64}$')
);

CREATE TABLE "product_initiative_handoff" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "initiative_id" UUID NOT NULL,
  "signal_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "market_code" TEXT,
  "user_problem" TEXT,
  "objective" TEXT NOT NULL,
  "responsible_actor_id" TEXT NOT NULL,
  "review_points" JSONB NOT NULL,
  "evidence_refs" UUID[] NOT NULL,
  "created_by" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "product_initiative_handoff_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_initiative_handoff_version_check" CHECK ("version" >= 1),
  CONSTRAINT "product_initiative_handoff_objective_check" CHECK (
    length(btrim("objective")) BETWEEN 1 AND 4000
  ),
  CONSTRAINT "product_initiative_handoff_text_check" CHECK (
    ("market_code" IS NULL OR length(btrim("market_code")) BETWEEN 1 AND 100) AND
    ("user_problem" IS NULL OR length(btrim("user_problem")) BETWEEN 1 AND 4000) AND
    length(btrim("responsible_actor_id")) BETWEEN 1 AND 200 AND
    length(btrim("created_by")) BETWEEN 1 AND 200 AND
    length(btrim("idempotency_key")) BETWEEN 1 AND 200
  ),
  CONSTRAINT "product_initiative_handoff_review_points_check" CHECK (
    jsonb_typeof("review_points") = 'array' AND
    jsonb_array_length("review_points") <= 4
  ),
  CONSTRAINT "product_initiative_handoff_array_shape_check" CHECK (
    cardinality("evidence_refs") <= 100 AND
    (cardinality("evidence_refs") = 0 OR array_ndims("evidence_refs") = 1)
  ),
  CONSTRAINT "product_initiative_handoff_payload_hash_check" CHECK ("payload_hash" ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX "product_initiative_id_tenant_key" ON "product_initiative"("id", "tenant_id");
-- 一条机会只有一份立项判断：暂缓后回来接着补，是同一行版本递增，不另开一行。
CREATE UNIQUE INDEX "product_initiative_handoff_key" ON "product_initiative"("tenant_id", "handoff_id");
CREATE UNIQUE INDEX "product_initiative_idempotency_key" ON "product_initiative"("tenant_id", "idempotency_key");
CREATE INDEX "product_initiative_queue_idx" ON "product_initiative"("tenant_id", "current_destination", "updated_at" DESC, "id" DESC);

CREATE UNIQUE INDEX "product_initiative_handoff_id_tenant_key" ON "product_initiative_handoff"("id", "tenant_id");
CREATE UNIQUE INDEX "product_initiative_handoff_idempotency_key" ON "product_initiative_handoff"("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX "product_initiative_handoff_version_key" ON "product_initiative_handoff"("initiative_id", "version");
CREATE INDEX "product_initiative_handoff_queue_idx" ON "product_initiative_handoff"("tenant_id", "created_at" DESC, "id" DESC);

ALTER TABLE "product_initiative"
ADD CONSTRAINT "product_initiative_handoff_fkey"
FOREIGN KEY ("handoff_id", "tenant_id")
REFERENCES "market_opportunity_handoff"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_initiative_handoff"
ADD CONSTRAINT "product_initiative_handoff_initiative_fkey"
FOREIGN KEY ("initiative_id", "tenant_id")
REFERENCES "product_initiative"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;

-- Verification after deploy:
-- SELECT to_regclass('public.product_initiative'), to_regclass('public.product_initiative_handoff');
-- SELECT conname, convalidated FROM pg_constraint
-- WHERE conrelid IN ('product_initiative'::regclass, 'product_initiative_handoff'::regclass)
-- ORDER BY conname;
-- Recovery before any business write: drop the two tables in reverse dependency order.
-- After business writes exist, preserve the rows and roll forward with a corrective migration.
