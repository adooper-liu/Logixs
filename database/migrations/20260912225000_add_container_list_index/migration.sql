-- CreateIndex
CREATE INDEX "container_record_tenant_id_updated_at_id_idx" ON "container_record"("tenant_id", "updated_at", "id");
