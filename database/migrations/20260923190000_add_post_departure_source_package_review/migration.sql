CREATE UNIQUE INDEX "import_batch_id_tenant_key"
ON "import_batch"("id", "tenant_id");

CREATE TABLE "post_departure_source_package_review" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "package_hash" CHAR(64) NOT NULL,
    "contract_version" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "candidate_count" INTEGER NOT NULL,
    "review_required_count" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "snapshot_hash" CHAR(64) NOT NULL,
    "operator_id" TEXT NOT NULL,
    "trace_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_departure_source_package_review_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "post_departure_source_package_review_hash_check" CHECK (
      "package_hash" ~ '^[0-9a-f]{64}$' AND
      "snapshot_hash" ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT "post_departure_source_package_review_contract_check" CHECK (
      "contract_version" = 'post-departure-source-package-review.v1'
    ),
    CONSTRAINT "post_departure_source_package_review_decision_check" CHECK (
      "decision" = 'review_required'
    ),
    CONSTRAINT "post_departure_source_package_review_count_check" CHECK (
      "candidate_count" > 0 AND
      "review_required_count" = "candidate_count"
    ),
    CONSTRAINT "post_departure_source_package_review_text_check" CHECK (
      "tenant_id" = btrim("tenant_id") AND "tenant_id" <> '' AND
      "operator_id" = btrim("operator_id") AND "operator_id" <> '' AND
      "trace_id" = btrim("trace_id") AND "trace_id" <> ''
    )
);

CREATE UNIQUE INDEX "post_departure_source_package_review_id_tenant_key"
ON "post_departure_source_package_review"("id", "tenant_id");
CREATE UNIQUE INDEX "post_departure_source_package_review_tenant_package_key"
ON "post_departure_source_package_review"("tenant_id", "package_hash");
CREATE INDEX "post_departure_source_package_review_tenant_created_idx"
ON "post_departure_source_package_review"("tenant_id", "created_at", "id");

CREATE TABLE "post_departure_source_package_source" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "review_id" UUID NOT NULL,
    "source_kind" TEXT NOT NULL,
    "import_batch_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_departure_source_package_source_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "post_departure_source_package_source_kind_check" CHECK (
      "source_kind" IN ('container', 'customs', 'logistics', 'warehouse')
    )
);

CREATE UNIQUE INDEX "post_departure_source_package_source_review_kind_key"
ON "post_departure_source_package_source"("review_id", "source_kind");
CREATE INDEX "post_departure_source_package_source_review_idx"
ON "post_departure_source_package_source"("review_id", "tenant_id");
CREATE INDEX "post_departure_source_package_source_batch_idx"
ON "post_departure_source_package_source"("import_batch_id", "tenant_id");
CREATE INDEX "post_departure_source_package_source_tenant_created_idx"
ON "post_departure_source_package_source"("tenant_id", "created_at", "id");

ALTER TABLE "post_departure_source_package_source"
ADD CONSTRAINT "post_departure_source_package_source_review_fkey"
FOREIGN KEY ("review_id", "tenant_id")
REFERENCES "post_departure_source_package_review"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "post_departure_source_package_source_batch_fkey"
FOREIGN KEY ("import_batch_id", "tenant_id")
REFERENCES "import_batch"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;
