BEGIN;

-- 供应商身份。**稳定身份**：一处登记、多处引用；名称在租户内唯一。
--
-- 只有 `admitted` 能被定点（见下方定点交接的说明）—— 没准入就定点，
-- 等于把质量责任交给一个没审过的对象。
CREATE TABLE "supplier" (
  "id"              UUID NOT NULL,
  "tenant_id"       TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "country_code"    CHAR(2) NOT NULL,
  "contact_name"    TEXT,
  "contact_email"   TEXT,
  "admission_state" TEXT NOT NULL,
  "version"         INTEGER NOT NULL,
  "acted_by"        TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash"    TEXT NOT NULL,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "supplier_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_admission_check" CHECK (
    "admission_state" IN ('pending', 'admitted', 'suspended')
  ),
  CONSTRAINT "supplier_version_check" CHECK ("version" >= 1),
  CONSTRAINT "supplier_country_check" CHECK ("country_code" ~ '^[A-Z]{2}$'),
  CONSTRAINT "supplier_text_check" CHECK (
    length(btrim("name")) BETWEEN 1 AND 200 AND
    ("contact_name" IS NULL OR length(btrim("contact_name")) BETWEEN 1 AND 100) AND
    ("contact_email" IS NULL OR length(btrim("contact_email")) BETWEEN 1 AND 200) AND
    length(btrim("acted_by")) BETWEEN 1 AND 200 AND
    length(btrim("idempotency_key")) BETWEEN 1 AND 200
  ),
  CONSTRAINT "supplier_payload_hash_check" CHECK ("payload_hash" ~ '^[a-f0-9]{64}$')
);

-- 报价：一家供应商对一份可售 SKU 发布报的价与条件。
--
-- 十项里**六项不是「价格」而是「条件」**（贸易术语、MOQ、模具费、样品、交期、付款）——
-- 只比单价是外行比价，真实差异常在模具费谁承担、MOQ 多高、交期多长。
--
-- `key_materials` 是**关键物料清单**：由供应商在报价时带入，不是主数据侧预先编的。
-- 自己编的是「声称」，供应商报的才是「承诺」—— 后者出错有人负责。
CREATE TABLE "supplier_quotation" (
  "id"                     UUID NOT NULL,
  "tenant_id"              TEXT NOT NULL,
  "supplier_id"            UUID NOT NULL,
  "sku_release_id"         UUID NOT NULL,
  "sku_id"                 UUID NOT NULL,
  "version"                INTEGER NOT NULL,
  "price_tiers"            JSONB NOT NULL,
  "incoterms"              TEXT NOT NULL,
  "minimum_order_quantity" JSONB,
  "tooling_cost"           JSONB,
  "sample_cost"            JSONB,
  "sample_refundable"      BOOLEAN,
  "lead_time_days"         INTEGER,
  "packaging_spec"         TEXT,
  "payment_terms"          TEXT,
  "quality_terms"          TEXT,
  "valid_until"            TIMESTAMPTZ,
  "key_materials"          JSONB NOT NULL,
  "exclusions"             TEXT,
  "quoted_by"              TEXT NOT NULL,
  "quoted_at"              TIMESTAMPTZ NOT NULL,
  "acted_by"               TEXT NOT NULL,
  "idempotency_key"        TEXT NOT NULL,
  "payload_hash"           TEXT NOT NULL,
  "created_at"             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "supplier_quotation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_quotation_version_check" CHECK ("version" >= 1),
  CONSTRAINT "supplier_quotation_lead_time_check" CHECK (
    "lead_time_days" IS NULL OR "lead_time_days" >= 0
  ),
  CONSTRAINT "supplier_quotation_text_check" CHECK (
    length(btrim("incoterms")) BETWEEN 1 AND 100 AND
    ("packaging_spec" IS NULL OR length(btrim("packaging_spec")) BETWEEN 1 AND 1000) AND
    ("payment_terms" IS NULL OR length(btrim("payment_terms")) BETWEEN 1 AND 500) AND
    ("quality_terms" IS NULL OR length(btrim("quality_terms")) BETWEEN 1 AND 1000) AND
    ("exclusions" IS NULL OR length(btrim("exclusions")) BETWEEN 1 AND 2000) AND
    length(btrim("quoted_by")) BETWEEN 1 AND 200 AND
    length(btrim("acted_by")) BETWEEN 1 AND 200 AND
    length(btrim("idempotency_key")) BETWEEN 1 AND 200
  ),
  -- 元素内部形状由领域层校验：CHECK 不允许子查询，无法逐元素断言。
  CONSTRAINT "supplier_quotation_price_tiers_check" CHECK (
    jsonb_typeof("price_tiers") = 'array' AND
    jsonb_array_length("price_tiers") >= 1
  ),
  CONSTRAINT "supplier_quotation_key_materials_check" CHECK (
    jsonb_typeof("key_materials") = 'array'
  ),
  CONSTRAINT "supplier_quotation_payload_hash_check" CHECK ("payload_hash" ~ '^[a-f0-9]{64}$')
);

-- 定点交接快照：交给需求与补货侧。不可变；再次定点追加版本。
--
-- **样品结论与产能约束必填** —— 网络声明这条交接要带这两样；没验过样就定点是拿量产赌，
-- 交下去的量供不上是补货那边最需要先知道的事。供应商名称与国别**随快照冻结**：
-- 供应商主数据后来改名，不影响当时定的是什么。
CREATE TABLE "supplier_nomination_release" (
  "id"                     UUID NOT NULL,
  "tenant_id"              TEXT NOT NULL,
  "sku_release_id"         UUID NOT NULL,
  "sku_id"                 UUID NOT NULL,
  "supplier_id"            UUID NOT NULL,
  "supplier_name"          TEXT NOT NULL,
  "supplier_country_code"  CHAR(2) NOT NULL,
  "quotation_id"           UUID NOT NULL,
  "quotation_version"      INTEGER NOT NULL,
  "incoterms"              TEXT NOT NULL,
  "price_tiers"            JSONB NOT NULL,
  "lead_time_days"         INTEGER,
  "minimum_order_quantity" JSONB,
  "sample_conclusion"      TEXT NOT NULL,
  "capacity_constraint"    TEXT NOT NULL,
  "version"                INTEGER NOT NULL,
  "nominated_by"           TEXT NOT NULL,
  "nominated_at"           TIMESTAMPTZ NOT NULL,
  "idempotency_key"        TEXT NOT NULL,
  "payload_hash"           TEXT NOT NULL,
  "created_at"             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "supplier_nomination_release_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_nomination_release_version_check" CHECK ("version" >= 1),
  CONSTRAINT "supplier_nomination_release_text_check" CHECK (
    length(btrim("supplier_name")) BETWEEN 1 AND 200 AND
    length(btrim("incoterms")) BETWEEN 1 AND 100 AND
    length(btrim("sample_conclusion")) BETWEEN 1 AND 1000 AND
    length(btrim("capacity_constraint")) BETWEEN 1 AND 1000 AND
    length(btrim("nominated_by")) BETWEEN 1 AND 200 AND
    length(btrim("idempotency_key")) BETWEEN 1 AND 200
  ),
  CONSTRAINT "supplier_nomination_release_price_tiers_check" CHECK (
    jsonb_typeof("price_tiers") = 'array' AND
    jsonb_array_length("price_tiers") >= 1
  ),
  CONSTRAINT "supplier_nomination_release_payload_hash_check" CHECK ("payload_hash" ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX "supplier_id_tenant_key" ON "supplier"("id", "tenant_id");
-- 供应商名称租户内唯一：重名会让"定点给谁"说不清。
CREATE UNIQUE INDEX "supplier_name_key" ON "supplier"("tenant_id", "name");
CREATE UNIQUE INDEX "supplier_idempotency_key" ON "supplier"("tenant_id", "idempotency_key");
CREATE INDEX "supplier_list_idx" ON "supplier"("tenant_id", "admission_state", "name");

CREATE UNIQUE INDEX "supplier_quotation_id_tenant_key" ON "supplier_quotation"("id", "tenant_id");
-- 一家供应商对一份发布只留一条当前版，推进是同一行版本递增；
-- 被选中的那一版由定点快照冻结，历史不会丢。
CREATE UNIQUE INDEX "supplier_quotation_current_key"
ON "supplier_quotation"("tenant_id", "supplier_id", "sku_release_id");
CREATE UNIQUE INDEX "supplier_quotation_idempotency_key" ON "supplier_quotation"("tenant_id", "idempotency_key");
CREATE INDEX "supplier_quotation_release_idx" ON "supplier_quotation"("tenant_id", "sku_release_id", "updated_at" DESC, "id" DESC);

CREATE UNIQUE INDEX "supplier_nomination_release_id_tenant_key" ON "supplier_nomination_release"("id", "tenant_id");
CREATE UNIQUE INDEX "supplier_nomination_release_idempotency_key" ON "supplier_nomination_release"("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX "supplier_nomination_release_version_key" ON "supplier_nomination_release"("sku_release_id", "version");

ALTER TABLE "supplier_quotation"
ADD CONSTRAINT "supplier_quotation_supplier_fkey"
FOREIGN KEY ("supplier_id", "tenant_id")
REFERENCES "supplier"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supplier_quotation"
ADD CONSTRAINT "supplier_quotation_sku_release_fkey"
FOREIGN KEY ("sku_release_id", "tenant_id")
REFERENCES "product_identity_release"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supplier_quotation"
ADD CONSTRAINT "supplier_quotation_sku_fkey"
FOREIGN KEY ("sku_id", "tenant_id")
REFERENCES "product_sku"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supplier_nomination_release"
ADD CONSTRAINT "supplier_nomination_release_supplier_fkey"
FOREIGN KEY ("supplier_id", "tenant_id")
REFERENCES "supplier"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supplier_nomination_release"
ADD CONSTRAINT "supplier_nomination_release_quotation_fkey"
FOREIGN KEY ("quotation_id", "tenant_id")
REFERENCES "supplier_quotation"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supplier_nomination_release"
ADD CONSTRAINT "supplier_nomination_release_sku_release_fkey"
FOREIGN KEY ("sku_release_id", "tenant_id")
REFERENCES "product_identity_release"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;

-- Verification after deploy:
-- SELECT to_regclass('public.supplier'), to_regclass('public.supplier_quotation'),
--        to_regclass('public.supplier_nomination_release');
-- SELECT conname, convalidated FROM pg_constraint
-- WHERE conrelid IN ('supplier'::regclass, 'supplier_quotation'::regclass,
--                    'supplier_nomination_release'::regclass)
-- ORDER BY conname;
-- Recovery before any business write: drop nomination → quotation → supplier, in that order.
-- After business writes exist, preserve the rows and roll forward with a corrective migration.
