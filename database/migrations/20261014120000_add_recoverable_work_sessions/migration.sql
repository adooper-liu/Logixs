CREATE TABLE "product_initiative_decision_draft" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "handoff_id" UUID NOT NULL,
  "initiative_id" UUID,
  "draft_version" INTEGER NOT NULL,
  "initiative_version_seen" INTEGER NOT NULL,
  "objective" TEXT,
  "review_points" JSONB NOT NULL,
  "business_case_draft" JSONB NOT NULL,
  "risk_assessment_draft" JSONB NOT NULL,
  "unit_economics_draft" JSONB,
  "negative_conservative_reason" TEXT,
  "acted_by" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "product_initiative_decision_draft_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_initiative_decision_draft_versions_check"
    CHECK ("draft_version" >= 1 AND "initiative_version_seen" >= 0),
  CONSTRAINT "product_initiative_decision_draft_text_check"
    CHECK (
      length(btrim("tenant_id")) > 0
      AND length(btrim("acted_by")) > 0
      AND length(btrim("idempotency_key")) > 0
      AND length("idempotency_key") <= 200
      AND "payload_hash" ~ '^[0-9a-f]{64}$'
    )
);

CREATE UNIQUE INDEX "product_initiative_decision_draft_id_tenant_key"
  ON "product_initiative_decision_draft" ("id", "tenant_id");
CREATE UNIQUE INDEX "product_initiative_decision_draft_handoff_key"
  ON "product_initiative_decision_draft" ("tenant_id", "handoff_id");
CREATE UNIQUE INDEX "product_initiative_decision_draft_initiative_key"
  ON "product_initiative_decision_draft" ("initiative_id", "tenant_id");
CREATE UNIQUE INDEX "product_initiative_decision_draft_idempotency_key"
  ON "product_initiative_decision_draft" ("tenant_id", "idempotency_key");

ALTER TABLE "product_initiative_decision_draft"
  ADD CONSTRAINT "product_initiative_decision_draft_handoff_fkey"
  FOREIGN KEY ("handoff_id", "tenant_id")
  REFERENCES "market_opportunity_handoff" ("id", "tenant_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_initiative_decision_draft"
  ADD CONSTRAINT "product_initiative_decision_draft_initiative_fkey"
  FOREIGN KEY ("initiative_id", "tenant_id")
  REFERENCES "product_initiative" ("id", "tenant_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "work_session" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "owner_actor_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "workbench_code" TEXT NOT NULL,
  "context_kind" TEXT NOT NULL,
  "context_key" TEXT NOT NULL,
  "subject_kind" TEXT NOT NULL,
  "subject_id" UUID NOT NULL,
  "task_kind" TEXT,
  "task_id" UUID,
  "draft_kind" TEXT,
  "draft_id" UUID,
  "draft_version" INTEGER,
  "domain_version_seen" INTEGER,
  "active_item_key" TEXT,
  "context_mode" TEXT,
  "display_summary" TEXT NOT NULL,
  "last_opened_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "work_session_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "work_session_version_check" CHECK ("version" >= 1),
  CONSTRAINT "work_session_domain_version_check"
    CHECK ("domain_version_seen" IS NULL OR "domain_version_seen" >= 0),
  CONSTRAINT "work_session_draft_version_check"
    CHECK ("draft_version" IS NULL OR "draft_version" >= 1),
  CONSTRAINT "work_session_status_check"
    CHECK ("status" IN ('current', 'resumable', 'draft_saved', 'browser_held', 'conflict', 'closed')),
  CONSTRAINT "work_session_workbench_check"
    CHECK ("workbench_code" IN ('product_selection', 'stuffing')),
  CONSTRAINT "work_session_context_check"
    CHECK (
      ("workbench_code" = 'product_selection' AND "context_kind" = 'product_selection.v1'
        AND "subject_kind" = 'product_initiative_handoff' AND "task_kind" IS NULL AND "task_id" IS NULL)
      OR
      ("workbench_code" = 'stuffing' AND "context_kind" = 'stuffing.v1'
        AND "subject_kind" = 'container' AND "task_kind" = 'node_task' AND "task_id" IS NOT NULL)
    ),
  CONSTRAINT "work_session_draft_ref_check"
    CHECK (
      ("draft_kind" IS NULL AND "draft_id" IS NULL AND "draft_version" IS NULL)
      OR
      ("draft_kind" = 'product_initiative_decision_draft' AND "draft_id" IS NOT NULL AND "draft_version" IS NOT NULL)
    ),
  CONSTRAINT "work_session_text_check"
    CHECK (
      length(btrim("tenant_id")) > 0
      AND length(btrim("owner_actor_id")) > 0
      AND length(btrim("context_key")) > 0
      AND length("context_key") <= 500
      AND length(btrim("display_summary")) > 0
      AND length("display_summary") <= 200
    )
);

CREATE UNIQUE INDEX "work_session_owner_key"
  ON "work_session" ("id", "tenant_id", "owner_actor_id");
CREATE INDEX "work_session_owner_list_idx"
  ON "work_session" ("tenant_id", "owner_actor_id", "last_opened_at", "id");
CREATE UNIQUE INDEX "work_session_one_current_key"
  ON "work_session" ("tenant_id", "owner_actor_id")
  WHERE "status" = 'current';
CREATE UNIQUE INDEX "work_session_live_context_key"
  ON "work_session" ("tenant_id", "owner_actor_id", "context_key")
  WHERE "status" <> 'closed';
