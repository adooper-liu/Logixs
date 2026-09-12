-- CreateTable
CREATE TABLE "canonical_event" (
    "id" TEXT NOT NULL,
    "container_id" TEXT NOT NULL,
    "event_code" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "canonical_event_idempotency_key_key" ON "canonical_event"("idempotency_key");
