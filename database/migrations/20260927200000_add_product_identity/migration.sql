BEGIN;

-- 产品（SPU）身份：从已发布的产品设计建档，交给寻源侧。
--
-- **内部代理键与对外编号分列**：`id` 无业务含义、永不因业务变化而变；
-- `product_number` 给人看、可改。这是"稳定身份"的行业含义 —— 有含义的编号
-- 在改品类或改规则时会对不上历史，是最容易在半年后返工的做法。
CREATE TABLE "product" (
  "id"               UUID NOT NULL,
  "tenant_id"        TEXT NOT NULL,
  -- 来自哪一份已发布产品设计；一票一份产品。
  "source_handoff_id" UUID NOT NULL,
  "product_number"   TEXT NOT NULL,
  "version"          INTEGER NOT NULL,
  "specification"    TEXT NOT NULL,
  "acted_by"         TEXT NOT NULL,
  "idempotency_key"  TEXT NOT NULL,
  "payload_hash"     TEXT NOT NULL,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "product_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_version_check" CHECK ("version" >= 1),
  CONSTRAINT "product_text_check" CHECK (
    length(btrim("product_number")) BETWEEN 1 AND 100 AND
    length(btrim("specification")) BETWEEN 1 AND 4000 AND
    length(btrim("acted_by")) BETWEEN 1 AND 200 AND
    length(btrim("idempotency_key")) BETWEEN 1 AND 200
  ),
  CONSTRAINT "product_payload_hash_check" CHECK ("payload_hash" ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX "product_id_tenant_key" ON "product"("id", "tenant_id");
-- 一票一份产品：同一份发布设计只建一次，推进是同一行版本递增。
CREATE UNIQUE INDEX "product_source_handoff_key" ON "product"("tenant_id", "source_handoff_id");
CREATE UNIQUE INDEX "product_number_key" ON "product"("tenant_id", "product_number");
CREATE UNIQUE INDEX "product_idempotency_key" ON "product"("tenant_id", "idempotency_key");
CREATE INDEX "product_queue_idx" ON "product"("tenant_id", "updated_at" DESC, "id" DESC);

ALTER TABLE "product"
ADD CONSTRAINT "product_source_handoff_fkey"
FOREIGN KEY ("source_handoff_id", "tenant_id")
REFERENCES "product_definition_release"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- SKU 归属产品。**只加一列可空的外键** —— 存量 SKU（含下游 ShipmentCargoLine
-- 已在引用的那些）不受影响，`register-product-sku` 的原路径也保持可用。
ALTER TABLE "product_sku" ADD COLUMN "product_id" UUID;

ALTER TABLE "product_sku"
ADD CONSTRAINT "product_sku_product_fkey"
FOREIGN KEY ("product_id", "tenant_id")
REFERENCES "product"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- 不另建「同一产品下 SKU 编号唯一」的索引：既有的
-- `product_sku_tenant_number_key` 已经要求**全租户唯一**，比它更严。
-- 也就是说 SKU 编号是租户级唯一的，跨产品也不能重号 —— 建档时按这条给号。

-- 可售 SKU 发布的不可变交接快照。发布时冻结，旧版不覆盖。
CREATE TABLE "product_identity_release" (
  "id"                 UUID NOT NULL,
  "tenant_id"          TEXT NOT NULL,
  "product_id"         UUID NOT NULL,
  "version"            INTEGER NOT NULL,
  "product_number"     TEXT NOT NULL,
  "skus"               JSONB NOT NULL,
  "pending_field_codes" TEXT[] NOT NULL,
  "released_by"        TEXT NOT NULL,
  "released_at"        TIMESTAMPTZ NOT NULL,
  "idempotency_key"    TEXT NOT NULL,
  "payload_hash"       TEXT NOT NULL,
  "created_at"         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "product_identity_release_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_identity_release_version_check" CHECK ("version" >= 1),
  CONSTRAINT "product_identity_release_text_check" CHECK (
    length(btrim("product_number")) BETWEEN 1 AND 100 AND
    length(btrim("released_by")) BETWEEN 1 AND 200 AND
    length(btrim("idempotency_key")) BETWEEN 1 AND 200
  ),
  CONSTRAINT "product_identity_release_skus_check" CHECK (
    jsonb_typeof("skus") = 'array' AND jsonb_array_length("skus") >= 1
  ),
  CONSTRAINT "product_identity_release_pending_check" CHECK (
    "pending_field_codes" <@ ARRAY['bom', 'listing']::TEXT[]
  ),
  CONSTRAINT "product_identity_release_payload_hash_check" CHECK ("payload_hash" ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX "product_identity_release_id_tenant_key" ON "product_identity_release"("id", "tenant_id");
CREATE UNIQUE INDEX "product_identity_release_idempotency_key" ON "product_identity_release"("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX "product_identity_release_version_key" ON "product_identity_release"("product_id", "version");

ALTER TABLE "product_identity_release"
ADD CONSTRAINT "product_identity_release_product_fkey"
FOREIGN KEY ("product_id", "tenant_id")
REFERENCES "product"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;

-- Verification after deploy:
-- SELECT to_regclass('public.product'), to_regclass('public.product_identity_release');
-- SELECT column_name, is_nullable FROM information_schema.columns
-- WHERE table_name = 'product_sku' AND column_name = 'product_id';
-- SELECT conname, convalidated FROM pg_constraint
-- WHERE conrelid IN ('product'::regclass, 'product_identity_release'::regclass, 'product_sku'::regclass)
-- ORDER BY conname;
-- Recovery before any business write: drop the two tables; `product_sku.product_id`
-- can be dropped alone (it is nullable and nothing depends on it yet).
-- After business writes exist, preserve the rows and roll forward.
