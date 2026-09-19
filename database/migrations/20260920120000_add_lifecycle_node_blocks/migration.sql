-- Node blocks are append-only facts. node_instance.state is only the current unresolved-block projection.
CREATE TABLE "node_block" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "flow_instance_id" TEXT NOT NULL,
    "node_instance_id" TEXT NOT NULL,
    "block_type" TEXT NOT NULL,
    "source_fact_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "actor_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "trace_id" TEXT NOT NULL,
    "projection_version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "node_block_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "node_block_type_check"
      CHECK ("block_type" ~ '^[a-z][a-z0-9_]{0,99}$'),
    CONSTRAINT "node_block_actor_check"
      CHECK (char_length("actor_id") BETWEEN 1 AND 128),
    CONSTRAINT "node_block_idempotency_check"
      CHECK (char_length("idempotency_key") BETWEEN 1 AND 200),
    CONSTRAINT "node_block_trace_check"
      CHECK (char_length("trace_id") BETWEEN 1 AND 128),
    CONSTRAINT "node_block_projection_version_check"
      CHECK ("projection_version" >= 0)
);

CREATE TABLE "node_block_resolution" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "block_id" TEXT NOT NULL,
    "resolved_at" TIMESTAMPTZ NOT NULL,
    "reason_code" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "trace_id" TEXT NOT NULL,
    "projection_version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "node_block_resolution_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "node_block_resolution_reason_check"
      CHECK (char_length("reason_code") BETWEEN 1 AND 64),
    CONSTRAINT "node_block_resolution_actor_check"
      CHECK (char_length("actor_id") BETWEEN 1 AND 128),
    CONSTRAINT "node_block_resolution_idempotency_check"
      CHECK (char_length("idempotency_key") BETWEEN 1 AND 200),
    CONSTRAINT "node_block_resolution_trace_check"
      CHECK (char_length("trace_id") BETWEEN 1 AND 128),
    CONSTRAINT "node_block_resolution_projection_version_check"
      CHECK ("projection_version" >= 0)
);

CREATE UNIQUE INDEX "node_block_tenant_idempotency_key"
ON "node_block"("tenant_id", "idempotency_key");

CREATE INDEX "node_block_flow_node_idx"
ON "node_block"("flow_instance_id", "node_instance_id");

CREATE INDEX "node_block_node_occurred_idx"
ON "node_block"("node_instance_id", "occurred_at");

CREATE UNIQUE INDEX "node_block_resolution_block_key"
ON "node_block_resolution"("block_id");

CREATE UNIQUE INDEX "node_block_resolution_tenant_idempotency_key"
ON "node_block_resolution"("tenant_id", "idempotency_key");

ALTER TABLE "node_block"
ADD CONSTRAINT "node_block_flow_instance_id_fkey"
FOREIGN KEY ("flow_instance_id") REFERENCES "flow_instance"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "node_block"
ADD CONSTRAINT "node_block_node_instance_id_fkey"
FOREIGN KEY ("node_instance_id") REFERENCES "node_instance"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "node_block"
ADD CONSTRAINT "node_block_source_fact_id_fkey"
FOREIGN KEY ("source_fact_id") REFERENCES "lifecycle_date_fact"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "node_block_resolution"
ADD CONSTRAINT "node_block_resolution_block_id_fkey"
FOREIGN KEY ("block_id") REFERENCES "node_block"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Verification: every block has a real source fact; one block has at most one resolution.
-- Recovery: retain block and resolution facts if application code rolls back; dropping them loses audit history.
