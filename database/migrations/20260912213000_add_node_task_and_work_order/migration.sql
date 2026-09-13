-- CreateTable
CREATE TABLE "node_task" (
    "id" TEXT NOT NULL,
    "flow_instance_id" TEXT NOT NULL,
    "node_instance_id" TEXT NOT NULL,
    "node_code" TEXT NOT NULL,
    "task_definition_key" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "node_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order" (
    "id" TEXT NOT NULL,
    "node_task_id" TEXT NOT NULL,
    "work_order_definition_key" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "assignment_state" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "node_task_node_instance_id_key" ON "node_task"("node_instance_id");

-- AddForeignKey
ALTER TABLE "work_order" ADD CONSTRAINT "work_order_node_task_id_fkey" FOREIGN KEY ("node_task_id") REFERENCES "node_task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
