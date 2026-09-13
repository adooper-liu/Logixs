-- CreateIndex
CREATE INDEX "outbox_message_dead_letter_list_idx" ON "outbox_message"("tenant_id", "owner_module", "state", "dead_lettered_at", "id");
