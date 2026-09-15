-- CreateTable
CREATE TABLE "inland_planning_parameter" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value_text" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inland_planning_parameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inland_planning_strategy" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inland_planning_strategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_unload_capacity" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "daily_limit" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_unload_capacity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fleet_haulage_capacity" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "fleet_id" TEXT NOT NULL,
    "daily_trips" INTEGER NOT NULL,
    "buffer_declared" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fleet_haulage_capacity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "port_fleet_warehouse_allocation" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "port_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "fleet_id" TEXT NOT NULL,
    "assignment_role" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "port_fleet_warehouse_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inland_plan" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "container_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "port_id" TEXT NOT NULL,
    "fleet_id" TEXT,
    "pickup_at" TIMESTAMP(3),
    "delivery_at" TIMESTAMP(3),
    "unload_at" TIMESTAMP(3),
    "return_at" TIMESTAMP(3),
    "customs_must_complete_by" TIMESTAMP(3),
    "scheme_code" TEXT NOT NULL,
    "needs_human_decision" BOOLEAN NOT NULL,
    "occupied" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inland_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inland_resource_occupancy" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "occupancy_date" DATE NOT NULL,
    "quantity" INTEGER NOT NULL,
    "plan_id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inland_resource_occupancy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inland_planning_parameter_tenant_key" ON "inland_planning_parameter"("tenant_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "inland_planning_strategy_tenant_key" ON "inland_planning_strategy"("tenant_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_unload_capacity_tenant_wh" ON "warehouse_unload_capacity"("tenant_id", "warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "fleet_haulage_capacity_tenant_fleet" ON "fleet_haulage_capacity"("tenant_id", "fleet_id");

-- CreateIndex
CREATE UNIQUE INDEX "port_fleet_wh_alloc_unique" ON "port_fleet_warehouse_allocation"("tenant_id", "port_id", "warehouse_id", "fleet_id");

-- CreateIndex
CREATE UNIQUE INDEX "inland_plan_container_version" ON "inland_plan"("tenant_id", "container_id", "version");

-- CreateIndex
CREATE INDEX "inland_plan_container_idx" ON "inland_plan"("tenant_id", "container_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "inland_occupancy_resource_day" ON "inland_resource_occupancy"("tenant_id", "resource_type", "resource_id", "occupancy_date");
