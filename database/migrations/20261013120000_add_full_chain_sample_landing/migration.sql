BEGIN;

-- CreateTable
CREATE TABLE "full_chain_landing_run" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "package_hash" TEXT NOT NULL,
    "semantic_hash" TEXT NOT NULL,
    "manifest_version" TEXT NOT NULL,
    "workbook_version" TEXT NOT NULL,
    "compiler_version" TEXT NOT NULL,
    "mapping_version" TEXT NOT NULL,
    "policy_version" TEXT NOT NULL,
    "source_fingerprint_hash" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "input_counts" JSONB NOT NULL,
    "applied_counts" JSONB NOT NULL,
    "replayed_counts" JSONB NOT NULL,
    "rejected_counts" JSONB NOT NULL,
    "gap_count" INTEGER NOT NULL,
    "check_count" INTEGER NOT NULL,
    "receipt_key_hash" TEXT,
    "receipt_digest" TEXT,
    "reconciliation_hash" TEXT,
    "actor_id" TEXT NOT NULL,
    "trace_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "full_chain_landing_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "full_chain_shipment_plan" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "landing_run_id" UUID NOT NULL,
    "plan_number" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "full_chain_shipment_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "full_chain_booking_commitment" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "landing_run_id" UUID NOT NULL,
    "shipment_plan_id" UUID NOT NULL,
    "booking_number" TEXT NOT NULL,
    "display_group_refs" JSONB NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "full_chain_booking_commitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "full_chain_booking_document" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "landing_run_id" UUID NOT NULL,
    "booking_commitment_id" UUID NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "parent_document_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "full_chain_booking_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "full_chain_cargo_ready_release" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "landing_run_id" UUID NOT NULL,
    "cargo_ready_number" TEXT NOT NULL,
    "display_group_ref" TEXT NOT NULL,
    "quantity" DECIMAL(24,6) NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "full_chain_cargo_ready_release_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "full_chain_shipment_plan_cargo_ready" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "landing_run_id" UUID NOT NULL,
    "shipment_plan_id" UUID NOT NULL,
    "cargo_ready_release_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "full_chain_shipment_plan_cargo_ready_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "full_chain_stuffing_line" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "landing_run_id" UUID NOT NULL,
    "cargo_ready_release_id" UUID NOT NULL,
    "house_bill_document_id" UUID NOT NULL,
    "container_number" TEXT NOT NULL,
    "cargo_ready_number" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "house_bill_number" TEXT NOT NULL,
    "quantity" DECIMAL(24,6) NOT NULL,
    "gross_weight" DECIMAL(24,6) NOT NULL,
    "volume" DECIMAL(24,6) NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "full_chain_stuffing_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "full_chain_export_customs_case" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "landing_run_id" UUID NOT NULL,
    "house_bill_document_id" UUID NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "house_bill_number" TEXT NOT NULL,
    "declaration_number" TEXT NOT NULL,
    "amount" DECIMAL(24,6) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "full_chain_export_customs_case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "full_chain_dispatch_fact" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "landing_run_id" UUID NOT NULL,
    "master_bill_document_id" UUID NOT NULL,
    "container_number" TEXT NOT NULL,
    "vessel_name" TEXT NOT NULL,
    "voyage_number" TEXT NOT NULL,
    "master_bill_number" TEXT NOT NULL,
    "gate_in_date" TEXT NOT NULL,
    "departed_at" TEXT NOT NULL,
    "departed_precision" TEXT NOT NULL,
    "mother_vessel_departed_at" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "full_chain_dispatch_fact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "full_chain_dispatch_house_bill" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "landing_run_id" UUID NOT NULL,
    "dispatch_fact_id" UUID NOT NULL,
    "house_bill_document_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "full_chain_dispatch_house_bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "full_chain_landing_record_receipt" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "landing_run_id" UUID NOT NULL,
    "record_type" TEXT NOT NULL,
    "business_key_hash" TEXT NOT NULL,
    "record_hash" TEXT NOT NULL,
    "source_ref_hash" TEXT NOT NULL,
    "target_fact_id" UUID NOT NULL,
    "state" TEXT NOT NULL,
    "issue_codes" TEXT[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "full_chain_landing_record_receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "full_chain_landing_gap" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "landing_run_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "record_ref_hash" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "full_chain_landing_gap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "full_chain_landing_run_state_idx" ON "full_chain_landing_run"("tenant_id", "state", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "full_chain_landing_run_id_tenant_key" ON "full_chain_landing_run"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "full_chain_landing_run_scope_key" ON "full_chain_landing_run"("id", "tenant_id", "package_hash");

-- CreateIndex
CREATE UNIQUE INDEX "full_chain_landing_run_tenant_package_key" ON "full_chain_landing_run"("tenant_id", "package_hash");

-- CreateIndex
CREATE UNIQUE INDEX "full_chain_landing_run_tenant_idempotency_key" ON "full_chain_landing_run"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "full_chain_shipment_plan_run_idx" ON "full_chain_shipment_plan"("landing_run_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "full_chain_shipment_plan_scope_key" ON "full_chain_shipment_plan"("id", "tenant_id", "landing_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "full_chain_shipment_plan_business_key" ON "full_chain_shipment_plan"("tenant_id", "plan_number");

-- CreateIndex
CREATE INDEX "full_chain_booking_commitment_run_idx" ON "full_chain_booking_commitment"("landing_run_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "full_chain_booking_commitment_scope_key" ON "full_chain_booking_commitment"("id", "tenant_id", "landing_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "full_chain_booking_commitment_business_key" ON "full_chain_booking_commitment"("tenant_id", "booking_number");

-- CreateIndex
CREATE INDEX "full_chain_booking_document_run_type_idx" ON "full_chain_booking_document"("landing_run_id", "tenant_id", "document_type");

-- CreateIndex
CREATE UNIQUE INDEX "full_chain_booking_document_scope_key" ON "full_chain_booking_document"("id", "tenant_id", "landing_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "full_chain_booking_document_parent_scope_key" ON "full_chain_booking_document"("id", "tenant_id", "landing_run_id", "booking_commitment_id");

-- CreateIndex
CREATE UNIQUE INDEX "full_chain_booking_document_business_key" ON "full_chain_booking_document"("tenant_id", "booking_commitment_id", "document_type", "document_number");

-- CreateIndex
CREATE INDEX "full_chain_cargo_ready_release_run_idx" ON "full_chain_cargo_ready_release"("landing_run_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "full_chain_cargo_ready_release_scope_key" ON "full_chain_cargo_ready_release"("id", "tenant_id", "landing_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "full_chain_cargo_ready_release_business_key" ON "full_chain_cargo_ready_release"("tenant_id", "cargo_ready_number");

-- CreateIndex
CREATE INDEX "full_chain_plan_cargo_ready_run_idx" ON "full_chain_shipment_plan_cargo_ready"("landing_run_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "full_chain_plan_cargo_ready_scope_key" ON "full_chain_shipment_plan_cargo_ready"("id", "tenant_id", "landing_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "full_chain_plan_cargo_ready_business_key" ON "full_chain_shipment_plan_cargo_ready"("tenant_id", "shipment_plan_id", "cargo_ready_release_id");

-- CreateIndex
CREATE INDEX "full_chain_stuffing_line_run_idx" ON "full_chain_stuffing_line"("landing_run_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "full_chain_stuffing_line_scope_key" ON "full_chain_stuffing_line"("id", "tenant_id", "landing_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "full_chain_stuffing_line_business_key" ON "full_chain_stuffing_line"("tenant_id", "container_number", "cargo_ready_number", "sku", "house_bill_number");

-- CreateIndex
CREATE INDEX "full_chain_export_customs_case_run_idx" ON "full_chain_export_customs_case"("landing_run_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "full_chain_export_customs_case_scope_key" ON "full_chain_export_customs_case"("id", "tenant_id", "landing_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "full_chain_export_customs_case_business_key" ON "full_chain_export_customs_case"("tenant_id", "invoice_number");

-- CreateIndex
CREATE INDEX "full_chain_dispatch_fact_run_idx" ON "full_chain_dispatch_fact"("landing_run_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "full_chain_dispatch_fact_scope_key" ON "full_chain_dispatch_fact"("id", "tenant_id", "landing_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "full_chain_dispatch_fact_business_key" ON "full_chain_dispatch_fact"("tenant_id", "container_number");

-- CreateIndex
CREATE INDEX "full_chain_dispatch_house_bill_run_idx" ON "full_chain_dispatch_house_bill"("landing_run_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "full_chain_dispatch_house_bill_scope_key" ON "full_chain_dispatch_house_bill"("id", "tenant_id", "landing_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "full_chain_dispatch_house_bill_business_key" ON "full_chain_dispatch_house_bill"("tenant_id", "dispatch_fact_id", "house_bill_document_id");

-- CreateIndex
CREATE INDEX "full_chain_landing_record_receipt_run_idx" ON "full_chain_landing_record_receipt"("landing_run_id", "tenant_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "full_chain_landing_record_receipt_scope_key" ON "full_chain_landing_record_receipt"("id", "tenant_id", "landing_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "full_chain_landing_record_receipt_business_key" ON "full_chain_landing_record_receipt"("tenant_id", "landing_run_id", "record_type", "business_key_hash");

-- CreateIndex
CREATE INDEX "full_chain_landing_gap_run_idx" ON "full_chain_landing_gap"("landing_run_id", "tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "full_chain_landing_gap_scope_key" ON "full_chain_landing_gap"("id", "tenant_id", "landing_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "full_chain_landing_gap_business_key" ON "full_chain_landing_gap"("tenant_id", "landing_run_id", "code", "record_ref_hash");

-- AddForeignKey
ALTER TABLE "full_chain_shipment_plan" ADD CONSTRAINT "full_chain_shipment_plan_landing_run_id_tenant_id_fkey" FOREIGN KEY ("landing_run_id", "tenant_id") REFERENCES "full_chain_landing_run"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "full_chain_booking_commitment" ADD CONSTRAINT "full_chain_booking_commitment_landing_run_id_tenant_id_fkey" FOREIGN KEY ("landing_run_id", "tenant_id") REFERENCES "full_chain_landing_run"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "full_chain_booking_commitment" ADD CONSTRAINT "full_chain_booking_commitment_shipment_plan_id_tenant_id_l_fkey" FOREIGN KEY ("shipment_plan_id", "tenant_id", "landing_run_id") REFERENCES "full_chain_shipment_plan"("id", "tenant_id", "landing_run_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "full_chain_booking_document" ADD CONSTRAINT "full_chain_booking_document_landing_run_id_tenant_id_fkey" FOREIGN KEY ("landing_run_id", "tenant_id") REFERENCES "full_chain_landing_run"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "full_chain_booking_document" ADD CONSTRAINT "full_chain_booking_document_booking_commitment_id_tenant_i_fkey" FOREIGN KEY ("booking_commitment_id", "tenant_id", "landing_run_id") REFERENCES "full_chain_booking_commitment"("id", "tenant_id", "landing_run_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "full_chain_booking_document" ADD CONSTRAINT "full_chain_booking_document_parent_document_id_tenant_id_l_fkey" FOREIGN KEY ("parent_document_id", "tenant_id", "landing_run_id", "booking_commitment_id") REFERENCES "full_chain_booking_document"("id", "tenant_id", "landing_run_id", "booking_commitment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "full_chain_cargo_ready_release" ADD CONSTRAINT "full_chain_cargo_ready_release_landing_run_id_tenant_id_fkey" FOREIGN KEY ("landing_run_id", "tenant_id") REFERENCES "full_chain_landing_run"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "full_chain_shipment_plan_cargo_ready" ADD CONSTRAINT "full_chain_shipment_plan_cargo_ready_landing_run_id_tenant_fkey" FOREIGN KEY ("landing_run_id", "tenant_id") REFERENCES "full_chain_landing_run"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "full_chain_shipment_plan_cargo_ready" ADD CONSTRAINT "full_chain_shipment_plan_cargo_ready_shipment_plan_id_tena_fkey" FOREIGN KEY ("shipment_plan_id", "tenant_id", "landing_run_id") REFERENCES "full_chain_shipment_plan"("id", "tenant_id", "landing_run_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "full_chain_shipment_plan_cargo_ready" ADD CONSTRAINT "full_chain_shipment_plan_cargo_ready_cargo_ready_release_i_fkey" FOREIGN KEY ("cargo_ready_release_id", "tenant_id", "landing_run_id") REFERENCES "full_chain_cargo_ready_release"("id", "tenant_id", "landing_run_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "full_chain_stuffing_line" ADD CONSTRAINT "full_chain_stuffing_line_landing_run_id_tenant_id_fkey" FOREIGN KEY ("landing_run_id", "tenant_id") REFERENCES "full_chain_landing_run"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "full_chain_stuffing_line" ADD CONSTRAINT "full_chain_stuffing_line_cargo_ready_release_id_tenant_id__fkey" FOREIGN KEY ("cargo_ready_release_id", "tenant_id", "landing_run_id") REFERENCES "full_chain_cargo_ready_release"("id", "tenant_id", "landing_run_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "full_chain_stuffing_line" ADD CONSTRAINT "full_chain_stuffing_line_house_bill_document_id_tenant_id__fkey" FOREIGN KEY ("house_bill_document_id", "tenant_id", "landing_run_id") REFERENCES "full_chain_booking_document"("id", "tenant_id", "landing_run_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "full_chain_export_customs_case" ADD CONSTRAINT "full_chain_export_customs_case_landing_run_id_tenant_id_fkey" FOREIGN KEY ("landing_run_id", "tenant_id") REFERENCES "full_chain_landing_run"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "full_chain_export_customs_case" ADD CONSTRAINT "full_chain_export_customs_case_house_bill_document_id_tena_fkey" FOREIGN KEY ("house_bill_document_id", "tenant_id", "landing_run_id") REFERENCES "full_chain_booking_document"("id", "tenant_id", "landing_run_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "full_chain_dispatch_fact" ADD CONSTRAINT "full_chain_dispatch_fact_landing_run_id_tenant_id_fkey" FOREIGN KEY ("landing_run_id", "tenant_id") REFERENCES "full_chain_landing_run"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "full_chain_dispatch_fact" ADD CONSTRAINT "full_chain_dispatch_fact_master_bill_document_id_tenant_id_fkey" FOREIGN KEY ("master_bill_document_id", "tenant_id", "landing_run_id") REFERENCES "full_chain_booking_document"("id", "tenant_id", "landing_run_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "full_chain_dispatch_house_bill" ADD CONSTRAINT "full_chain_dispatch_house_bill_landing_run_id_tenant_id_fkey" FOREIGN KEY ("landing_run_id", "tenant_id") REFERENCES "full_chain_landing_run"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "full_chain_dispatch_house_bill" ADD CONSTRAINT "full_chain_dispatch_house_bill_dispatch_fact_id_tenant_id__fkey" FOREIGN KEY ("dispatch_fact_id", "tenant_id", "landing_run_id") REFERENCES "full_chain_dispatch_fact"("id", "tenant_id", "landing_run_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "full_chain_dispatch_house_bill" ADD CONSTRAINT "full_chain_dispatch_house_bill_house_bill_document_id_tena_fkey" FOREIGN KEY ("house_bill_document_id", "tenant_id", "landing_run_id") REFERENCES "full_chain_booking_document"("id", "tenant_id", "landing_run_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "full_chain_landing_record_receipt" ADD CONSTRAINT "full_chain_landing_record_receipt_landing_run_id_tenant_id_fkey" FOREIGN KEY ("landing_run_id", "tenant_id") REFERENCES "full_chain_landing_run"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "full_chain_landing_gap" ADD CONSTRAINT "full_chain_landing_gap_landing_run_id_tenant_id_fkey" FOREIGN KEY ("landing_run_id", "tenant_id") REFERENCES "full_chain_landing_run"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "full_chain_landing_run"
  ADD CONSTRAINT "full_chain_landing_run_state_check" CHECK (
    "state" IN ('applying', 'staged', 'receipt_pending', 'reconciling', 'published', 'failed')
  ),
  ADD CONSTRAINT "full_chain_landing_run_hash_shape_check" CHECK (
    length("package_hash") = 64 AND
    length("semantic_hash") = 64 AND
    length("source_fingerprint_hash") = 64 AND
    ("receipt_key_hash" IS NULL OR length("receipt_key_hash") = 64) AND
    ("receipt_digest" IS NULL OR length("receipt_digest") = 64) AND
    ("reconciliation_hash" IS NULL OR length("reconciliation_hash") = 64)
  );

ALTER TABLE "full_chain_booking_document"
  ADD CONSTRAINT "full_chain_booking_document_type_check" CHECK (
    "document_type" IN ('mbl', 'hbl')
  ),
  ADD CONSTRAINT "full_chain_booking_document_parent_shape_check" CHECK (
    ("document_type" = 'mbl' AND "parent_document_id" IS NULL) OR
    ("document_type" = 'hbl' AND "parent_document_id" IS NOT NULL)
  );

ALTER TABLE "full_chain_dispatch_fact"
  ADD CONSTRAINT "full_chain_dispatch_fact_precision_check" CHECK (
    "departed_precision" IN ('date', 'datetime')
  );

ALTER TABLE "full_chain_landing_record_receipt"
  ADD CONSTRAINT "full_chain_landing_record_receipt_state_check" CHECK (
    "state" IN ('applied', 'replayed', 'rejected')
  );

ALTER TABLE "full_chain_landing_gap"
  ADD CONSTRAINT "full_chain_landing_gap_status_check" CHECK (
    "status" IN ('open', 'blocking', 'informational')
  );

ALTER TABLE "full_chain_shipment_plan"
  ADD CONSTRAINT "full_chain_shipment_plan_payload_hash_check" CHECK (length("payload_hash") = 64);
ALTER TABLE "full_chain_booking_commitment"
  ADD CONSTRAINT "full_chain_booking_commitment_payload_hash_check" CHECK (length("payload_hash") = 64);
ALTER TABLE "full_chain_cargo_ready_release"
  ADD CONSTRAINT "full_chain_cargo_ready_release_payload_hash_check" CHECK (length("payload_hash") = 64);
ALTER TABLE "full_chain_stuffing_line"
  ADD CONSTRAINT "full_chain_stuffing_line_payload_hash_check" CHECK (length("payload_hash") = 64);
ALTER TABLE "full_chain_export_customs_case"
  ADD CONSTRAINT "full_chain_export_customs_case_payload_hash_check" CHECK (length("payload_hash") = 64);
ALTER TABLE "full_chain_dispatch_fact"
  ADD CONSTRAINT "full_chain_dispatch_fact_payload_hash_check" CHECK (length("payload_hash") = 64);

CREATE FUNCTION "validate_full_chain_booking_document_parent"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_row "full_chain_booking_document"%ROWTYPE;
BEGIN
  IF NEW."document_type" = 'mbl' THEN
    RETURN NEW;
  END IF;
  SELECT * INTO parent_row
  FROM "full_chain_booking_document"
  WHERE "id" = NEW."parent_document_id";
  IF NOT FOUND OR
     parent_row."document_type" <> 'mbl' OR
     parent_row."tenant_id" <> NEW."tenant_id" OR
     parent_row."landing_run_id" <> NEW."landing_run_id" OR
     parent_row."booking_commitment_id" <> NEW."booking_commitment_id" THEN
    RAISE EXCEPTION 'FULL_CHAIN_HBL_PARENT_INVALID' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "full_chain_booking_document_parent_type_trigger"
AFTER INSERT OR UPDATE OF "document_type", "parent_document_id", "tenant_id", "landing_run_id", "booking_commitment_id"
ON "full_chain_booking_document"
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW
EXECUTE FUNCTION "validate_full_chain_booking_document_parent"();

CREATE FUNCTION "validate_full_chain_house_bill_reference"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  document_row "full_chain_booking_document"%ROWTYPE;
BEGIN
  SELECT * INTO document_row
  FROM "full_chain_booking_document"
  WHERE "id" = NEW."house_bill_document_id";
  IF NOT FOUND OR
     document_row."document_type" <> 'hbl' OR
     (
       TG_TABLE_NAME <> 'full_chain_dispatch_house_bill' AND
       document_row."document_number" <> (to_jsonb(NEW)->>'house_bill_number')
     ) OR
     document_row."tenant_id" <> NEW."tenant_id" OR
     document_row."landing_run_id" <> NEW."landing_run_id" THEN
    RAISE EXCEPTION 'FULL_CHAIN_HOUSE_BILL_REFERENCE_INVALID' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "full_chain_stuffing_line_hbl_type_trigger"
AFTER INSERT OR UPDATE OF "house_bill_document_id", "tenant_id", "landing_run_id"
ON "full_chain_stuffing_line"
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW
EXECUTE FUNCTION "validate_full_chain_house_bill_reference"();

CREATE CONSTRAINT TRIGGER "full_chain_export_customs_case_hbl_type_trigger"
AFTER INSERT OR UPDATE OF "house_bill_document_id", "tenant_id", "landing_run_id"
ON "full_chain_export_customs_case"
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW
EXECUTE FUNCTION "validate_full_chain_house_bill_reference"();

CREATE CONSTRAINT TRIGGER "full_chain_dispatch_house_bill_hbl_type_trigger"
AFTER INSERT OR UPDATE OF "house_bill_document_id", "tenant_id", "landing_run_id"
ON "full_chain_dispatch_house_bill"
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW
EXECUTE FUNCTION "validate_full_chain_house_bill_reference"();

CREATE FUNCTION "validate_full_chain_master_bill_reference"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  document_row "full_chain_booking_document"%ROWTYPE;
BEGIN
  SELECT * INTO document_row
  FROM "full_chain_booking_document"
  WHERE "id" = NEW."master_bill_document_id";
  IF NOT FOUND OR
     document_row."document_type" <> 'mbl' OR
     document_row."document_number" <> NEW."master_bill_number" OR
     document_row."tenant_id" <> NEW."tenant_id" OR
     document_row."landing_run_id" <> NEW."landing_run_id" THEN
    RAISE EXCEPTION 'FULL_CHAIN_MASTER_BILL_REFERENCE_INVALID' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "full_chain_dispatch_fact_mbl_type_trigger"
AFTER INSERT OR UPDATE OF "master_bill_document_id", "master_bill_number", "tenant_id", "landing_run_id"
ON "full_chain_dispatch_fact"
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW
EXECUTE FUNCTION "validate_full_chain_master_bill_reference"();

CREATE FUNCTION "validate_full_chain_receipt_target"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  table_name TEXT;
  matched BOOLEAN;
BEGIN
  table_name := CASE NEW."record_type"
    WHEN 'shipment_plan' THEN 'full_chain_shipment_plan'
    WHEN 'booking_commitment' THEN 'full_chain_booking_commitment'
    WHEN 'cargo_ready_release' THEN 'full_chain_cargo_ready_release'
    WHEN 'stuffing_snapshot_line' THEN 'full_chain_stuffing_line'
    WHEN 'export_customs_case' THEN 'full_chain_export_customs_case'
    WHEN 'dispatch_fact' THEN 'full_chain_dispatch_fact'
    ELSE NULL
  END;
  IF table_name IS NULL THEN
    RAISE EXCEPTION 'FULL_CHAIN_RECEIPT_TARGET_INVALID' USING ERRCODE = '23514';
  END IF;
  EXECUTE format(
    'SELECT EXISTS (SELECT 1 FROM %I WHERE id = $1 AND tenant_id = $2 AND landing_run_id = $3)',
    table_name
  ) INTO matched USING NEW."target_fact_id", NEW."tenant_id", NEW."landing_run_id";
  IF NOT matched THEN
    RAISE EXCEPTION 'FULL_CHAIN_RECEIPT_TARGET_INVALID' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "full_chain_landing_receipt_target_trigger"
AFTER INSERT OR UPDATE OF "record_type", "target_fact_id", "tenant_id", "landing_run_id"
ON "full_chain_landing_record_receipt"
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW
EXECUTE FUNCTION "validate_full_chain_receipt_target"();

COMMIT;

-- Verification after deploy:
-- SELECT state, count(*) FROM full_chain_landing_run GROUP BY state;
-- SELECT document_type, count(*) FROM full_chain_booking_document GROUP BY document_type;
-- Recovery before any writes: drop the twelve full_chain_* tables and validation function in child-first order.
-- After writes exist: preserve rehearsal rows and roll forward with a corrective migration.