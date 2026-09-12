-- CreateTable
CREATE TABLE "import_batch" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "operator_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "row_count" INTEGER NOT NULL,
    "column_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_row" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "row_no" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_row_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "import_batch_idempotency_key_key" ON "import_batch"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "import_row_batch_id_row_no_key" ON "import_row"("batch_id", "row_no");

-- AddForeignKey
ALTER TABLE "import_row" ADD CONSTRAINT "import_row_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "import_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
