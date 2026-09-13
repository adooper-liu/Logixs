-- CreateIndex
CREATE INDEX "canonical_event_container_occurred_idx" ON "canonical_event"("container_id", "occurred_at", "id");
