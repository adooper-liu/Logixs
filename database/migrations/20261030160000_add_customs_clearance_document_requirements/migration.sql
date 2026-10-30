-- 各国清关资料需求。来源是 2026-10-30 负责人提供的国别表。
-- applicability: required = 表内 Y；marked = 表内 ¥，不按必交；noted = 备注，不按必交。
-- 空单元格不插入。农业产品声明保留在资料类型中，当前没有任何国别标为必交。
BEGIN;

CREATE TABLE "customs_clearance_document_type" (
  "code" TEXT NOT NULL,
  "name_zh" TEXT NOT NULL,
  "name_en" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customs_clearance_document_type_pkey" PRIMARY KEY ("code"),
  CONSTRAINT "customs_clearance_document_type_text_check"
    CHECK ("code" = btrim("code") AND "code" <> '' AND "name_zh" <> '' AND "name_en" <> ''),
  CONSTRAINT "customs_clearance_document_type_sort_check"
    CHECK ("sort_order" > 0)
);

CREATE TABLE "customs_clearance_document_requirement" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "country_code" TEXT NOT NULL,
  "document_code" TEXT NOT NULL,
  "applicability" TEXT NOT NULL,
  "note" TEXT,
  "source_sheet" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customs_clearance_document_requirement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customs_clearance_document_requirement_type_fkey"
    FOREIGN KEY ("document_code") REFERENCES "customs_clearance_document_type"("code")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "customs_clearance_document_requirement_country_check"
    CHECK ("country_code" = btrim("country_code") AND "country_code" <> ''),
  CONSTRAINT "customs_clearance_document_requirement_applicability_check"
    CHECK ("applicability" IN ('required', 'marked', 'noted')),
  CONSTRAINT "customs_clearance_document_requirement_note_check"
    CHECK ("note" IS NULL OR "note" <> ''),
  CONSTRAINT "customs_clearance_document_requirement_source_check"
    CHECK ("source_sheet" <> '')
);
CREATE UNIQUE INDEX "customs_document_requirement_country_document_key"
  ON "customs_clearance_document_requirement"("country_code", "document_code");
CREATE INDEX "customs_document_requirement_document_idx"
  ON "customs_clearance_document_requirement"("document_code");

CREATE TABLE "customs_ens_filing_rule" (
  "country_code" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "import_file_rule" TEXT,
  "export_file_rule" TEXT,
  "source_sheet" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customs_ens_filing_rule_pkey" PRIMARY KEY ("country_code"),
  CONSTRAINT "customs_ens_filing_rule_direction_check"
    CHECK ("direction" IN ('import', 'export', 'both')),
  CONSTRAINT "customs_ens_filing_rule_file_check"
    CHECK (
      ("direction" = 'import' AND "import_file_rule" IS NOT NULL AND "export_file_rule" IS NULL)
      OR ("direction" = 'export' AND "export_file_rule" IS NOT NULL AND "import_file_rule" IS NULL)
      OR ("direction" = 'both' AND "import_file_rule" IS NOT NULL AND "export_file_rule" IS NOT NULL)
    ),
  CONSTRAINT "customs_ens_filing_rule_source_check"
    CHECK ("source_sheet" <> '')
);

INSERT INTO "customs_clearance_document_type" ("code", "name_zh", "name_en", "sort_order") VALUES
  ('bl', '提单', 'B/L', 10),
  ('pl', '装箱单', 'PL', 20),
  ('inv', '发票', 'IN', 30),
  ('ens', 'ENS', 'ENS', 40),
  ('product_info', '产品资料', 'Product Info.', 50),
  ('pharmaceutical_control', '药品监管声明', 'Pharmaceutical Control', 60),
  ('end_use_certification', '农业产品声明', 'End Use Certification', 70),
  ('cpc_astm', '婴童玩具证书', 'CPC & ASTM', 80),
  ('textile', '纺织品工厂备案', 'Textile', 90),
  ('lacey_act', 'Lacey Act', 'Lacey Act', 100),
  ('phytosanitary', '植检证书附件', 'Phytosanitary Certificate', 110),
  ('power_of_attorney', '授权委托书', 'Power of Attorney', 120),
  ('an_emanifest', '到港通知', 'AN/E-manifest', 130),
  ('energy_related_products', '能效产品文件', 'Energy-related Products', 140),
  ('nameplate', '产品铭牌', 'Nameplate', 150),
  ('gcc', 'GCC', 'GCC', 160);

INSERT INTO "customs_clearance_document_requirement"
  ("country_code", "document_code", "applicability", "note", "source_sheet") VALUES
  ('US', 'bl', 'required', NULL, '2026-10-30-country-sheet'),
  ('US', 'pl', 'required', NULL, '2026-10-30-country-sheet'),
  ('US', 'inv', 'required', NULL, '2026-10-30-country-sheet'),
  ('US', 'ens', 'required', NULL, '2026-10-30-country-sheet'),
  ('US', 'pharmaceutical_control', 'required', NULL, '2026-10-30-country-sheet'),
  ('US', 'cpc_astm', 'required', NULL, '2026-10-30-country-sheet'),
  ('US', 'textile', 'required', NULL, '2026-10-30-country-sheet'),
  ('US', 'lacey_act', 'required', NULL, '2026-10-30-country-sheet'),
  ('US', 'gcc', 'required', NULL, '2026-10-30-country-sheet'),
  ('CA', 'bl', 'required', NULL, '2026-10-30-country-sheet'),
  ('CA', 'pl', 'required', NULL, '2026-10-30-country-sheet'),
  ('CA', 'inv', 'required', NULL, '2026-10-30-country-sheet'),
  ('CA', 'ens', 'required', NULL, '2026-10-30-country-sheet'),
  ('CA', 'an_emanifest', 'required', NULL, '2026-10-30-country-sheet'),
  ('CA', 'product_info', 'marked', NULL, '2026-10-30-country-sheet'),
  ('UK', 'bl', 'required', NULL, '2026-10-30-country-sheet'),
  ('UK', 'pl', 'required', NULL, '2026-10-30-country-sheet'),
  ('UK', 'inv', 'required', NULL, '2026-10-30-country-sheet'),
  ('UK', 'ens', 'required', NULL, '2026-10-30-country-sheet'),
  ('UK', 'phytosanitary', 'required', NULL, '2026-10-30-country-sheet'),
  ('UK', 'energy_related_products', 'required', NULL, '2026-10-30-country-sheet'),
  ('UK', 'nameplate', 'required', NULL, '2026-10-30-country-sheet'),
  ('DE', 'bl', 'required', NULL, '2026-10-30-country-sheet'),
  ('DE', 'pl', 'required', NULL, '2026-10-30-country-sheet'),
  ('DE', 'inv', 'required', NULL, '2026-10-30-country-sheet'),
  ('DE', 'ens', 'required', NULL, '2026-10-30-country-sheet'),
  ('DE', 'product_info', 'required', NULL, '2026-10-30-country-sheet'),
  ('DE', 'phytosanitary', 'required', NULL, '2026-10-30-country-sheet'),
  ('DE', 'power_of_attorney', 'required', NULL, '2026-10-30-country-sheet'),
  ('FR', 'bl', 'required', NULL, '2026-10-30-country-sheet'),
  ('FR', 'pl', 'required', NULL, '2026-10-30-country-sheet'),
  ('FR', 'inv', 'required', NULL, '2026-10-30-country-sheet'),
  ('FR', 'ens', 'required', NULL, '2026-10-30-country-sheet'),
  ('FR', 'product_info', 'required', NULL, '2026-10-30-country-sheet'),
  ('FR', 'phytosanitary', 'required', NULL, '2026-10-30-country-sheet'),
  ('IT', 'bl', 'required', NULL, '2026-10-30-country-sheet'),
  ('IT', 'pl', 'required', NULL, '2026-10-30-country-sheet'),
  ('IT', 'inv', 'required', NULL, '2026-10-30-country-sheet'),
  ('IT', 'ens', 'required', NULL, '2026-10-30-country-sheet'),
  ('IT', 'product_info', 'required', NULL, '2026-10-30-country-sheet'),
  ('IT', 'phytosanitary', 'required', NULL, '2026-10-30-country-sheet'),
  ('RO', 'bl', 'required', NULL, '2026-10-30-country-sheet'),
  ('RO', 'pl', 'required', NULL, '2026-10-30-country-sheet'),
  ('RO', 'inv', 'required', NULL, '2026-10-30-country-sheet'),
  ('RO', 'ens', 'required', NULL, '2026-10-30-country-sheet'),
  ('RO', 'product_info', 'required', NULL, '2026-10-30-country-sheet'),
  ('RO', 'phytosanitary', 'required', NULL, '2026-10-30-country-sheet'),
  ('ES', 'bl', 'required', NULL, '2026-10-30-country-sheet'),
  ('ES', 'pl', 'required', NULL, '2026-10-30-country-sheet'),
  ('ES', 'inv', 'required', NULL, '2026-10-30-country-sheet'),
  ('ES', 'product_info', 'required', NULL, '2026-10-30-country-sheet'),
  ('ES', 'pharmaceutical_control', 'required', NULL, '2026-10-30-country-sheet'),
  ('ES', 'ens', 'marked', NULL, '2026-10-30-country-sheet'),
  ('IE', 'bl', 'required', NULL, '2026-10-30-country-sheet'),
  ('IE', 'pl', 'required', NULL, '2026-10-30-country-sheet'),
  ('IE', 'inv', 'required', NULL, '2026-10-30-country-sheet'),
  ('IE', 'ens', 'required', NULL, '2026-10-30-country-sheet'),
  ('IE', 'phytosanitary', 'noted', '进口关务加标记', '2026-10-30-country-sheet');

INSERT INTO "customs_ens_filing_rule"
  ("country_code", "direction", "import_file_rule", "export_file_rule", "source_sheet") VALUES
  ('UK', 'import', '提单下的所有货品单号+国别路径+Overseas+ENS.xls', NULL, '2026-10-30-country-sheet'),
  ('IE', 'import', '提单下的所有货品单号+国别路径+Overseas+ENS.xls', NULL, '2026-10-30-country-sheet'),
  ('DE', 'both', '提单下的所有货品单号+国别路径+Overseas+ENS.xls', '提单下的所有货品单号+ENS.xls', '2026-10-30-country-sheet'),
  ('FR', 'both', '提单下的所有货品单号+国别路径+Overseas+ENS.xls', '提单下的所有货品单号+ENS.xls', '2026-10-30-country-sheet'),
  ('IT', 'both', '提单下的所有货品单号+国别路径+Overseas+ENS.xls', '提单下的所有货品单号+ENS.xls', '2026-10-30-country-sheet'),
  ('ES', 'export', NULL, '提单下的所有货品单号+ENS.xls', '2026-10-30-country-sheet'),
  ('US', 'import', '提单下的所有货品单号+国别路径+Overseas+ENS.xls', NULL, '2026-10-30-country-sheet');

COMMIT;
