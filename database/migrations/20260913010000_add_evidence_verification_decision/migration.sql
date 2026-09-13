-- CreateTable
CREATE TABLE "evidence_verification_decision" (
    "id" TEXT NOT NULL,
    "evidence_id" TEXT NOT NULL,
    "verification_sequence" INTEGER NOT NULL,
    "decision" TEXT NOT NULL,
    "checks" JSONB NOT NULL,
    "policy_id" TEXT NOT NULL,
    "policy_version" INTEGER NOT NULL,
    "decided_at" TIMESTAMP(3) NOT NULL,
    "actor_or_service_id" TEXT NOT NULL,
    "reason_code" TEXT NOT NULL,
    "reason" TEXT,
    "previous_decision_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_verification_decision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "evidence_decision_seq_key" ON "evidence_verification_decision"("evidence_id", "verification_sequence");

-- AddForeignKey
ALTER TABLE "evidence_verification_decision" ADD CONSTRAINT "evidence_verification_decision_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "evidence_record"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
