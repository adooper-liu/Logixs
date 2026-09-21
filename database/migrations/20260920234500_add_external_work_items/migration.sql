CREATE TABLE "external_work_item_projection" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "source_module" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_scope_id" TEXT NOT NULL,
    "source_record_id" TEXT NOT NULL,
    "source_version" INTEGER NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "external_work_item_projection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "external_work_item_projection_version_check" CHECK ("source_version" > 0)
);

CREATE TABLE "external_work_item" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "source_module" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_scope_id" TEXT NOT NULL,
    "source_record_id" TEXT NOT NULL,
    "source_version" INTEGER NOT NULL,
    "source_item_key" TEXT NOT NULL,
    "container_id" TEXT NOT NULL,
    "task_definition_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "assigned_role_code" TEXT NOT NULL,
    "evidence_refs" JSONB NOT NULL DEFAULT '[]',
    "due_at" TIMESTAMPTZ,
    "payload_hash" TEXT NOT NULL,
    "closed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "external_work_item_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "external_work_item_version_check" CHECK ("source_version" > 0),
    CONSTRAINT "external_work_item_priority_check" CHECK ("priority" IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT "external_work_item_state_check" CHECK ("state" IN ('open', 'completed', 'cancelled')),
    CONSTRAINT "external_work_item_closed_at_check" CHECK (("state" = 'open' AND "closed_at" IS NULL) OR ("state" <> 'open' AND "closed_at" IS NOT NULL)),
    CONSTRAINT "external_work_item_evidence_refs_array_check" CHECK (jsonb_typeof("evidence_refs") = 'array')
);

CREATE UNIQUE INDEX "external_work_item_projection_scope_key"
ON "external_work_item_projection"("tenant_id", "source_module", "source_scope_id");

CREATE UNIQUE INDEX "external_work_item_source_key"
ON "external_work_item"("tenant_id", "source_module", "source_record_id", "source_item_key");

CREATE INDEX "external_work_item_tenant_state_idx"
ON "external_work_item"("tenant_id", "state", "created_at", "id");

CREATE INDEX "external_work_item_container_state_idx"
ON "external_work_item"("tenant_id", "container_id", "state", "created_at", "id");

CREATE INDEX "external_work_item_scope_state_idx"
ON "external_work_item"("tenant_id", "source_module", "source_scope_id", "state");
