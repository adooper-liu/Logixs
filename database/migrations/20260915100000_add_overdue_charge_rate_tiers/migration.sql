-- CreateTable
CREATE TABLE "overdue_charge_rate_tier" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "standard_id" TEXT NOT NULL,
    "from_day" INTEGER NOT NULL,
    "to_day" INTEGER,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "overdue_charge_rate_tier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "overdue_rate_tier_standard_idx" ON "overdue_charge_rate_tier"("tenant_id", "standard_id");

-- AddForeignKey
ALTER TABLE "overdue_charge_rate_tier" ADD CONSTRAINT "overdue_charge_rate_tier_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "overdue_charge_standard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
