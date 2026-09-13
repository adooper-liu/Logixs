-- CreateTable
CREATE TABLE "evidence_record" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "evidence_type" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "authority_level" TEXT NOT NULL,
    "content_ref" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "source" JSONB NOT NULL,
    "verification_state" TEXT NOT NULL,
    "confidence_state" TEXT NOT NULL,
    "validity" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evidence_record_tenant_id_subject_type_subject_id_idx" ON "evidence_record"("tenant_id", "subject_type", "subject_id");
