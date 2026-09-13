-- CreateIndex
CREATE INDEX "node_task_container_id_created_at_id_idx" ON "node_task"("container_id", "created_at", "id");
