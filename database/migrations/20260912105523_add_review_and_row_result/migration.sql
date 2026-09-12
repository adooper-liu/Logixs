-- CreateTable
CREATE TABLE "import_review" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "column" TEXT NOT NULL,
    "field_code" TEXT,
    "operator_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_row_result" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "row_id" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "container_record_id" TEXT,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_row_result_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "import_review" ADD CONSTRAINT "import_review_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "import_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_row_result" ADD CONSTRAINT "import_row_result_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "import_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
