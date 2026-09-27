BEGIN;

CREATE TABLE "market_signal" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "market_code" TEXT,
  "channel_code" TEXT,
  "category_ref" TEXT,
  "observed_fact_summary" TEXT,
  "hypothesis" TEXT,
  "current_destination" TEXT NOT NULL DEFAULT 'needs_decision',
  "owner_team_code" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by" TEXT NOT NULL,
  "updated_by" TEXT NOT NULL,
  "create_idempotency_key" TEXT NOT NULL,
  "create_payload_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "market_signal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "market_signal_destination_check" CHECK (
    "current_destination" IN ('needs_decision', 'watching', 'handed_off', 'dismissed')
  ),
  CONSTRAINT "market_signal_version_check" CHECK ("version" >= 1),
  CONSTRAINT "market_signal_title_check" CHECK (length(btrim("title")) BETWEEN 1 AND 300),
  CONSTRAINT "market_signal_optional_text_check" CHECK (
    ("market_code" IS NULL OR length(btrim("market_code")) BETWEEN 1 AND 100) AND
    ("channel_code" IS NULL OR length(btrim("channel_code")) BETWEEN 1 AND 100) AND
    ("category_ref" IS NULL OR length(btrim("category_ref")) BETWEEN 1 AND 200) AND
    ("observed_fact_summary" IS NULL OR length(btrim("observed_fact_summary")) BETWEEN 1 AND 4000) AND
    ("hypothesis" IS NULL OR length(btrim("hypothesis")) BETWEEN 1 AND 4000)
  ),
  CONSTRAINT "market_signal_audit_text_check" CHECK (
    length(btrim("tenant_id")) BETWEEN 1 AND 200 AND
    length(btrim("owner_team_code")) BETWEEN 1 AND 100 AND
    length(btrim("created_by")) BETWEEN 1 AND 200 AND
    length(btrim("updated_by")) BETWEEN 1 AND 200 AND
    length(btrim("create_idempotency_key")) BETWEEN 1 AND 200
  ),
  CONSTRAINT "market_signal_create_payload_hash_check" CHECK ("create_payload_hash" ~ '^[a-f0-9]{64}$')
);

CREATE TABLE "market_signal_decision" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "signal_id" UUID NOT NULL,
  "decision_version" INTEGER NOT NULL,
  "signal_version" INTEGER NOT NULL,
  "decision_type" TEXT NOT NULL,
  "completion_state" TEXT NOT NULL,
  "judgment_note" TEXT,
  "opportunity_statement" TEXT,
  "next_review_date" DATE,
  "watch_focus" TEXT,
  "dismiss_reason" TEXT,
  "pending_field_codes" TEXT[] NOT NULL,
  "created_by" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "market_signal_decision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "market_signal_decision_type_check" CHECK ("decision_type" IN ('watch', 'handoff', 'dismiss')),
  CONSTRAINT "market_signal_decision_completion_check" CHECK ("completion_state" IN ('pending_completion', 'completed')),
  CONSTRAINT "market_signal_decision_version_check" CHECK ("decision_version" >= 1 AND "signal_version" >= 2),
  CONSTRAINT "market_signal_decision_shape_check" CHECK (
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
    )
  ),
  CONSTRAINT "market_signal_decision_text_check" CHECK (
    ("judgment_note" IS NULL OR length(btrim("judgment_note")) BETWEEN 1 AND 4000) AND
    ("opportunity_statement" IS NULL OR length(btrim("opportunity_statement")) BETWEEN 1 AND 4000) AND
    ("watch_focus" IS NULL OR length(btrim("watch_focus")) BETWEEN 1 AND 4000) AND
    ("dismiss_reason" IS NULL OR length(btrim("dismiss_reason")) BETWEEN 1 AND 500) AND
    length(btrim("created_by")) BETWEEN 1 AND 200 AND
    length(btrim("idempotency_key")) BETWEEN 1 AND 200
  ),
  CONSTRAINT "market_signal_decision_pending_codes_check" CHECK (
    "pending_field_codes" <@ ARRAY[
      'market_code', 'channel_code', 'category_ref', 'observed_fact_summary',
      'hypothesis', 'evidence_refs', 'opportunity_statement',
      'next_review_date', 'dismiss_reason'
    ]::TEXT[]
  ),
  CONSTRAINT "market_signal_decision_payload_hash_check" CHECK ("payload_hash" ~ '^[a-f0-9]{64}$')
);

CREATE TABLE "market_opportunity_handoff" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "signal_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "signal_version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "recipient_queue_code" TEXT NOT NULL,
  "market_code" TEXT,
  "channel_code" TEXT,
  "category_ref" TEXT,
  "observed_fact_summary" TEXT,
  "evidence_refs" UUID[] NOT NULL,
  "hypothesis" TEXT,
  "opportunity_statement" TEXT,
  "judgment_note" TEXT,
  "pending_field_codes" TEXT[] NOT NULL,
  "created_by" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "is_current" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "market_opportunity_handoff_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "market_opportunity_handoff_version_check" CHECK ("version" >= 1 AND "signal_version" >= 2),
  CONSTRAINT "market_opportunity_handoff_queue_check" CHECK ("recipient_queue_code" = 'product_selection'),
  CONSTRAINT "market_opportunity_handoff_title_check" CHECK (length(btrim("title")) BETWEEN 1 AND 300),
  CONSTRAINT "market_opportunity_handoff_optional_text_check" CHECK (
    ("market_code" IS NULL OR length(btrim("market_code")) BETWEEN 1 AND 100) AND
    ("channel_code" IS NULL OR length(btrim("channel_code")) BETWEEN 1 AND 100) AND
    ("category_ref" IS NULL OR length(btrim("category_ref")) BETWEEN 1 AND 200) AND
    ("observed_fact_summary" IS NULL OR length(btrim("observed_fact_summary")) BETWEEN 1 AND 4000) AND
    ("hypothesis" IS NULL OR length(btrim("hypothesis")) BETWEEN 1 AND 4000) AND
    ("opportunity_statement" IS NULL OR length(btrim("opportunity_statement")) BETWEEN 1 AND 4000) AND
    ("judgment_note" IS NULL OR length(btrim("judgment_note")) BETWEEN 1 AND 4000)
  ),
  CONSTRAINT "market_opportunity_handoff_audit_text_check" CHECK (
    length(btrim("created_by")) BETWEEN 1 AND 200 AND
    length(btrim("idempotency_key")) BETWEEN 1 AND 200
  ),
  CONSTRAINT "market_opportunity_handoff_pending_codes_check" CHECK (
    "pending_field_codes" <@ ARRAY[
      'market_code', 'channel_code', 'category_ref', 'observed_fact_summary',
      'hypothesis', 'evidence_refs', 'opportunity_statement',
      'next_review_date', 'dismiss_reason'
    ]::TEXT[]
  ),
  CONSTRAINT "market_opportunity_handoff_array_shape_check" CHECK (
    cardinality("evidence_refs") <= 100 AND
    (cardinality("evidence_refs") = 0 OR array_ndims("evidence_refs") = 1) AND
    (cardinality("pending_field_codes") = 0 OR array_ndims("pending_field_codes") = 1)
  ),
  CONSTRAINT "market_opportunity_handoff_payload_hash_check" CHECK ("payload_hash" ~ '^[a-f0-9]{64}$')
);

CREATE TABLE "product_opportunity_intake" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "handoff_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "state" TEXT NOT NULL,
  "assigned_actor_id" TEXT,
  "acted_by" TEXT NOT NULL,
  "acted_at" TIMESTAMPTZ NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "product_opportunity_intake_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_opportunity_intake_version_check" CHECK ("version" >= 1),
  CONSTRAINT "product_opportunity_intake_state_check" CHECK ("state" IN ('claimed', 'accepted', 'superseded')),
  CONSTRAINT "product_opportunity_intake_assignment_check" CHECK (
    ("state" IN ('claimed', 'accepted') AND "assigned_actor_id" IS NOT NULL) OR
    "state" = 'superseded'
  ),
  CONSTRAINT "product_opportunity_intake_audit_text_check" CHECK (
    ("assigned_actor_id" IS NULL OR length(btrim("assigned_actor_id")) BETWEEN 1 AND 200) AND
    length(btrim("acted_by")) BETWEEN 1 AND 200 AND
    length(btrim("idempotency_key")) BETWEEN 1 AND 200
  ),
  CONSTRAINT "product_opportunity_intake_payload_hash_check" CHECK ("payload_hash" ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX "market_signal_id_tenant_key" ON "market_signal"("id", "tenant_id");
CREATE UNIQUE INDEX "market_signal_create_idempotency_key" ON "market_signal"("tenant_id", "create_idempotency_key");
CREATE INDEX "market_signal_queue_idx" ON "market_signal"("tenant_id", "current_destination", "updated_at" DESC, "id" DESC);

CREATE UNIQUE INDEX "market_signal_decision_idempotency_key" ON "market_signal_decision"("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX "market_signal_decision_version_key" ON "market_signal_decision"("signal_id", "decision_version");
CREATE INDEX "market_signal_decision_signal_idx" ON "market_signal_decision"("tenant_id", "signal_id", "created_at" DESC);

CREATE UNIQUE INDEX "market_opportunity_handoff_id_tenant_key" ON "market_opportunity_handoff"("id", "tenant_id");
CREATE UNIQUE INDEX "market_opportunity_handoff_idempotency_key" ON "market_opportunity_handoff"("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX "market_opportunity_handoff_signal_version_key" ON "market_opportunity_handoff"("signal_id", "version");
CREATE UNIQUE INDEX "market_opportunity_handoff_current_signal_key" ON "market_opportunity_handoff"("tenant_id", "signal_id") WHERE "is_current";
CREATE INDEX "market_opportunity_handoff_queue_idx" ON "market_opportunity_handoff"("tenant_id", "recipient_queue_code", "is_current", "created_at" DESC, "id" DESC);

CREATE UNIQUE INDEX "product_opportunity_intake_idempotency_key" ON "product_opportunity_intake"("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX "product_opportunity_intake_version_key" ON "product_opportunity_intake"("handoff_id", "version");
CREATE INDEX "product_opportunity_intake_handoff_idx" ON "product_opportunity_intake"("tenant_id", "handoff_id", "version" DESC);
CREATE INDEX "product_opportunity_intake_actor_idx" ON "product_opportunity_intake"("tenant_id", "assigned_actor_id", "state", "acted_at" DESC);

ALTER TABLE "market_signal_decision"
ADD CONSTRAINT "market_signal_decision_signal_fkey"
FOREIGN KEY ("signal_id", "tenant_id")
REFERENCES "market_signal"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "market_opportunity_handoff"
ADD CONSTRAINT "market_opportunity_handoff_signal_fkey"
FOREIGN KEY ("signal_id", "tenant_id")
REFERENCES "market_signal"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_opportunity_intake"
ADD CONSTRAINT "product_opportunity_intake_handoff_fkey"
FOREIGN KEY ("handoff_id", "tenant_id")
REFERENCES "market_opportunity_handoff"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;

-- Verification after deploy:
-- SELECT to_regclass('public.market_signal'), to_regclass('public.market_signal_decision'),
--        to_regclass('public.market_opportunity_handoff'), to_regclass('public.product_opportunity_intake');
-- SELECT conname, convalidated FROM pg_constraint
-- WHERE conrelid IN ('market_signal'::regclass, 'market_signal_decision'::regclass,
--                    'market_opportunity_handoff'::regclass, 'product_opportunity_intake'::regclass)
-- ORDER BY conname;
-- Recovery before any business write: drop the four tables in reverse dependency order.
-- After business writes exist, preserve the rows and roll forward with a corrective migration.
