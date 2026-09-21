-- Preserve legacy timestamp-without-time-zone values as UTC while aligning the
-- physical schema with the UTC-aware Prisma contract.
ALTER TABLE "node_task_outcome"
  ALTER COLUMN "evaluated_at" TYPE TIMESTAMPTZ
    USING "evaluated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ
    USING "created_at" AT TIME ZONE 'UTC';

-- Fact reconciliation resolves a task inside the full tenant/container/flow/node scope.
DROP INDEX "node_task_tenant_flow_node_idx";

CREATE INDEX "node_task_tenant_container_flow_node_idx"
ON "node_task"("tenant_id", "container_id", "flow_instance_id", "node_instance_id");

-- Verification:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'node_task_outcome'
--   AND column_name IN ('evaluated_at', 'created_at');
-- Both rows must report 'timestamp with time zone'.
-- Recovery: converting back to timestamp without time zone would discard the
-- explicit UTC semantics and requires an approved data migration.
