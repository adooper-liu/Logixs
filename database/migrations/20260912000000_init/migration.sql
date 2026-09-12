-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ContainerStatus" AS ENUM ('not_shipped', 'shipped', 'in_transit', 'at_port', 'picked_up', 'unloaded', 'returned_empty', 'cancelled');

-- CreateTable
CREATE TABLE "container_record" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "main_order_number" TEXT,
    "container_number" TEXT,
    "current_status" "ContainerStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "container_record_pkey" PRIMARY KEY ("id")
);

