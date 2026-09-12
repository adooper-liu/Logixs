-- CreateTable
CREATE TABLE "flow_instance" (
    "id" TEXT NOT NULL,
    "container_id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "current_node_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_instance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_instance" (
    "id" TEXT NOT NULL,
    "flow_instance_id" TEXT NOT NULL,
    "node_code" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "node_instance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "flow_instance_container_id_key" ON "flow_instance"("container_id");

-- CreateIndex
CREATE UNIQUE INDEX "node_instance_flow_instance_id_node_code_key" ON "node_instance"("flow_instance_id", "node_code");

-- AddForeignKey
ALTER TABLE "node_instance" ADD CONSTRAINT "node_instance_flow_instance_id_fkey" FOREIGN KEY ("flow_instance_id") REFERENCES "flow_instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
