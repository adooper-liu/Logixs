-- AlterTable
ALTER TABLE "inland_plan" ADD COLUMN "latest_pickup_at" TIMESTAMP(3);
ALTER TABLE "inland_plan" ADD COLUMN "latest_return_at" TIMESTAMP(3);
ALTER TABLE "inland_plan" ADD COLUMN "overdue_deadlines_code" TEXT;

-- CreateTable
CREATE TABLE "overdue_charge_standard" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "port_id" TEXT NOT NULL,
    "shipping_company_id" TEXT NOT NULL,
    "freight_forwarder_id" TEXT NOT NULL,
    "charge_type" TEXT NOT NULL,
    "free_days" INTEGER NOT NULL,
    "free_days_basis" TEXT NOT NULL,
    "calculation_basis" TEXT NOT NULL,
    "include_start_day" BOOLEAN NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "transport_mode" TEXT,
    "terminal_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overdue_charge_standard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "overdue_standard_match_idx" ON "overdue_charge_standard"("tenant_id", "port_id", "shipping_company_id", "freight_forwarder_id");
