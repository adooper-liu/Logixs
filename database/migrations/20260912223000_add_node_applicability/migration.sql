-- AlterTable
ALTER TABLE "flow_instance" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "node_instance" ADD COLUMN "applicability" TEXT NOT NULL DEFAULT 'required';

-- CreateTable
CREATE TABLE "node_applicability_decision" (
    "id" TEXT NOT NULL,
    "flow_instance_id" TEXT NOT NULL,
    "node_code" TEXT NOT NULL,
    "applicability" TEXT NOT NULL,
    "evidence_refs" JSONB NOT NULL,
    "reason_code" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "node_applicability_decision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "node_applicability_decision_idempotency_key_key" ON "node_applicability_decision"("idempotency_key");
