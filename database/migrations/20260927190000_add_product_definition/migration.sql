BEGIN;

-- 产品定义：把一件已领的立项推进到可发布，交给主数据侧建档。
--
-- 与立项同构：一票一行、`version` 递增的当前态；**发布**时另写不可变的交接快照。
-- 不存 `pending_field_codes`：缺口按当前阶段**现算**（阶段一前进，缺口组成就变），
-- 存成库里的状态会阶段动了、缺口还停在原地。
--
-- 阶段用行业通用名 EVT/DVT/PVT/MP —— 代工厂说的就是这四个词。
CREATE TABLE "product_definition" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  -- 指向 NPI 领取所依据的那份立项交接快照：没领的立项不该有产品定义。
  "initiative_handoff_id" UUID NOT NULL,
  "product_owner_actor_id" TEXT NOT NULL,
  "npi_stage" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "release_state" TEXT NOT NULL,
  "specification" TEXT NOT NULL,
  "compliance_assumptions" TEXT[] NOT NULL,
  "stage_outcomes" JSONB NOT NULL,
  "acted_by" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "product_definition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_definition_stage_check" CHECK (
    "npi_stage" IN ('evt', 'dvt', 'pvt', 'mp')
  ),
  CONSTRAINT "product_definition_release_state_check" CHECK (
    "release_state" IN ('in_progress', 'released', 'deferred', 'terminated')
  ),
  CONSTRAINT "product_definition_version_check" CHECK ("version" >= 1),
  CONSTRAINT "product_definition_text_check" CHECK (
    length(btrim("specification")) BETWEEN 1 AND 4000 AND
    length(btrim("product_owner_actor_id")) BETWEEN 1 AND 200 AND
    length(btrim("acted_by")) BETWEEN 1 AND 200 AND
    length(btrim("idempotency_key")) BETWEEN 1 AND 200
  ),
  -- 元素内部形状由领域层校验：CHECK 不允许子查询，无法在数据库里逐元素断言。
  -- 这里只保证它是数组、条数有上限。
  CONSTRAINT "product_definition_assumptions_check" CHECK (
    cardinality("compliance_assumptions") <= 50 AND
    (cardinality("compliance_assumptions") = 0 OR array_ndims("compliance_assumptions") = 1)
  ),
  CONSTRAINT "product_definition_stage_outcomes_check" CHECK (
    jsonb_typeof("stage_outcomes") = 'array' AND
    jsonb_array_length("stage_outcomes") <= 3
  ),
  CONSTRAINT "product_definition_payload_hash_check" CHECK ("payload_hash" ~ '^[a-f0-9]{64}$')
);

-- 发布时冻结的不可变交接快照。同一产品定义再次发布追加版本，旧版不覆盖。
CREATE TABLE "product_definition_release" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "definition_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "npi_stage" TEXT NOT NULL,
  "specification" TEXT NOT NULL,
  "compliance_assumptions" TEXT[] NOT NULL,
  "stage_outcomes" JSONB NOT NULL,
  "released_by" TEXT NOT NULL,
  "released_at" TIMESTAMPTZ NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "product_definition_release_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_definition_release_stage_check" CHECK (
    "npi_stage" IN ('evt', 'dvt', 'pvt', 'mp')
  ),
  CONSTRAINT "product_definition_release_version_check" CHECK ("version" >= 1),
  CONSTRAINT "product_definition_release_text_check" CHECK (
    length(btrim("specification")) BETWEEN 1 AND 4000 AND
    length(btrim("released_by")) BETWEEN 1 AND 200 AND
    length(btrim("idempotency_key")) BETWEEN 1 AND 200
  ),
  CONSTRAINT "product_definition_release_payload_hash_check" CHECK ("payload_hash" ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX "product_definition_id_tenant_key" ON "product_definition"("id", "tenant_id");
-- 一票一行：同一份立项交接只有一份产品定义，推进是同一行版本递增。
CREATE UNIQUE INDEX "product_definition_initiative_key" ON "product_definition"("tenant_id", "initiative_handoff_id");
CREATE UNIQUE INDEX "product_definition_idempotency_key" ON "product_definition"("tenant_id", "idempotency_key");
CREATE INDEX "product_definition_queue_idx" ON "product_definition"("tenant_id", "release_state", "updated_at" DESC, "id" DESC);

CREATE UNIQUE INDEX "product_definition_release_id_tenant_key" ON "product_definition_release"("id", "tenant_id");
CREATE UNIQUE INDEX "product_definition_release_idempotency_key" ON "product_definition_release"("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX "product_definition_release_version_key" ON "product_definition_release"("definition_id", "version");

ALTER TABLE "product_definition"
ADD CONSTRAINT "product_definition_initiative_handoff_fkey"
FOREIGN KEY ("initiative_handoff_id", "tenant_id")
REFERENCES "product_initiative_handoff"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_definition_release"
ADD CONSTRAINT "product_definition_release_definition_fkey"
FOREIGN KEY ("definition_id", "tenant_id")
REFERENCES "product_definition"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;

-- Verification after deploy:
-- SELECT to_regclass('public.product_definition'), to_regclass('public.product_definition_release');
-- SELECT conname, convalidated FROM pg_constraint
-- WHERE conrelid IN ('product_definition'::regclass, 'product_definition_release'::regclass)
-- ORDER BY conname;
-- Recovery before any business write: drop the two tables in reverse dependency order.
-- After business writes exist, preserve the rows and roll forward with a corrective migration.
