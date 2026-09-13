-- CreateTable
CREATE TABLE "node_task_outcome" (
    "id" TEXT NOT NULL,
    "node_task_id" TEXT NOT NULL,
    "previous_state" TEXT NOT NULL,
    "next_state" TEXT NOT NULL,
    "result_policy_mode" TEXT NOT NULL,
    "policy_snapshot_hash" TEXT NOT NULL,
    "required_work_order_ids" JSONB NOT NULL,
    "completed_work_order_ids" JSONB NOT NULL,
    "evaluated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "node_task_outcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "node_task_outcome_node_task_id_key" ON "node_task_outcome"("node_task_id");

-- AddForeignKey
ALTER TABLE "node_task_outcome" ADD CONSTRAINT "node_task_outcome_node_task_id_fkey" FOREIGN KEY ("node_task_id") REFERENCES "node_task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
