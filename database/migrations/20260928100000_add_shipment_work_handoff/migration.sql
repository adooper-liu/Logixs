BEGIN;

-- 事项交接：出运运营把一件票级事项交给某个专业岗位队列，该岗位的人领取、了结。
--
-- **`state` 不是 Shipment 的生命周期状态** —— 基线要求交接带表达真实业务接力而不新增
-- 领域状态；这一枚只说明"这件事有没有人接、了没了的"。
--
-- **只到岗位不到人**：交出去的人只需判断交给哪个岗位，不必知道今天谁在班。
-- 队列按岗位码参数化，一套实现服务所有岗位。
CREATE TABLE "shipment_work_handoff" (
  "id"                  UUID NOT NULL,
  "tenant_id"           TEXT NOT NULL,
  "shipment_id"         UUID NOT NULL,
  -- 票级事项为空；柜级事项才带。复合外键在任一列为 NULL 时不做校验（MATCH SIMPLE）。
  -- **TEXT 不是 UUID**：`container_record.id` 建表时就没有 `@db.Uuid`，是 TEXT。
  "container_record_id" TEXT,
  "recipient_queue_code" TEXT NOT NULL,
  "title"               TEXT NOT NULL,
  "detail"              TEXT,
  "state"               TEXT NOT NULL,
  "version"             INTEGER NOT NULL,
  "raised_by"           TEXT NOT NULL,
  "raised_at"           TIMESTAMPTZ NOT NULL,
  "claimed_by_actor_id" TEXT,
  "claimed_at"          TIMESTAMPTZ,
  "closed_by_actor_id"  TEXT,
  "closed_at"           TIMESTAMPTZ,
  "conclusion"          TEXT,
  "acted_by"            TEXT NOT NULL,
  "idempotency_key"     TEXT NOT NULL,
  "payload_hash"        TEXT NOT NULL,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "shipment_work_handoff_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shipment_work_handoff_recipient_check" CHECK (
    "recipient_queue_code" IN ('customs', 'pickup', 'delivery', 'unloading')
  ),
  CONSTRAINT "shipment_work_handoff_state_check" CHECK (
    "state" IN ('raised', 'claimed', 'closed')
  ),
  CONSTRAINT "shipment_work_handoff_version_check" CHECK ("version" >= 1),
  CONSTRAINT "shipment_work_handoff_text_check" CHECK (
    length(btrim("title")) BETWEEN 1 AND 200 AND
    ("detail" IS NULL OR length(btrim("detail")) BETWEEN 1 AND 4000) AND
    length(btrim("raised_by")) BETWEEN 1 AND 200 AND
    length(btrim("acted_by")) BETWEEN 1 AND 200 AND
    length(btrim("idempotency_key")) BETWEEN 1 AND 200
  ),
  -- 状态与领/了结字段必须自洽：声称领了就得有领取人，声称了结了就得有结论。
  -- 不这样的话，界面上会出现"已了结但没有说法"这种说不通的记录。
  CONSTRAINT "shipment_work_handoff_shape_check" CHECK (
    (
      "state" = 'raised' AND
      "claimed_by_actor_id" IS NULL AND "closed_by_actor_id" IS NULL AND
      "conclusion" IS NULL
    ) OR (
      "state" = 'claimed' AND
      "claimed_by_actor_id" IS NOT NULL AND "closed_by_actor_id" IS NULL AND
      "conclusion" IS NULL
    ) OR (
      "state" = 'closed' AND
      "claimed_by_actor_id" IS NOT NULL AND "closed_by_actor_id" IS NOT NULL AND
      "conclusion" IS NOT NULL AND
      length(btrim("conclusion")) BETWEEN 1 AND 1000
    )
  ),
  CONSTRAINT "shipment_work_handoff_payload_hash_check" CHECK ("payload_hash" ~ '^[a-f0-9]{64}$')
);

-- 动作留痕（领取 / 了结），追加不可变：谁在什么时候接的、怎么了的，事后要能复盘。
-- 幂等键放在动作上而不是交接上 —— 三个动作各有各的重试，记在一个字段里会互相覆盖。
CREATE TABLE "shipment_work_handoff_action" (
  "id"              UUID NOT NULL,
  "tenant_id"       TEXT NOT NULL,
  "handoff_id"      UUID NOT NULL,
  "action"          TEXT NOT NULL,
  "actor_id"        TEXT NOT NULL,
  "acted_at"        TIMESTAMPTZ NOT NULL,
  "conclusion"      TEXT,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash"    TEXT NOT NULL,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "shipment_work_handoff_action_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shipment_work_handoff_action_check" CHECK (
    "action" IN ('claim', 'close')
  ),
  CONSTRAINT "shipment_work_handoff_action_text_check" CHECK (
    length(btrim("actor_id")) BETWEEN 1 AND 200 AND
    length(btrim("idempotency_key")) BETWEEN 1 AND 200 AND
    ("conclusion" IS NULL OR length(btrim("conclusion")) BETWEEN 1 AND 1000)
  ),
  -- 领取必无结论、了结必有结论 —— 与交接表上的形状约束同一口径。
  CONSTRAINT "shipment_work_handoff_action_shape_check" CHECK (
    ("action" = 'claim' AND "conclusion" IS NULL) OR
    ("action" = 'close' AND "conclusion" IS NOT NULL)
  ),
  CONSTRAINT "shipment_work_handoff_action_payload_hash_check" CHECK ("payload_hash" ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX "shipment_work_handoff_id_tenant_key" ON "shipment_work_handoff"("id", "tenant_id");
CREATE UNIQUE INDEX "shipment_work_handoff_idempotency_key" ON "shipment_work_handoff"("tenant_id", "idempotency_key");
-- 队列按「岗位 + 状态 + 时间」取页；这是四个岗位共用的那条索引。
CREATE INDEX "shipment_work_handoff_queue_idx"
ON "shipment_work_handoff"("tenant_id", "recipient_queue_code", "state", "raised_at" DESC, "id" DESC);
-- 「这一票交给谁了、了没了」—— 出运运营那一侧要按票回看。
CREATE INDEX "shipment_work_handoff_shipment_idx"
ON "shipment_work_handoff"("tenant_id", "shipment_id", "state", "raised_at" DESC, "id" DESC);

CREATE UNIQUE INDEX "shipment_work_handoff_action_id_tenant_key" ON "shipment_work_handoff_action"("id", "tenant_id");
CREATE UNIQUE INDEX "shipment_work_handoff_action_idempotency_key" ON "shipment_work_handoff_action"("tenant_id", "idempotency_key");
-- 一个交接只能被领一次、了结一次。
CREATE UNIQUE INDEX "shipment_work_handoff_action_once_key" ON "shipment_work_handoff_action"("handoff_id", "action");

ALTER TABLE "shipment_work_handoff"
ADD CONSTRAINT "shipment_work_handoff_shipment_fkey"
FOREIGN KEY ("shipment_id", "tenant_id")
REFERENCES "shipment"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shipment_work_handoff"
ADD CONSTRAINT "shipment_work_handoff_container_fkey"
FOREIGN KEY ("container_record_id", "tenant_id")
REFERENCES "container_record"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shipment_work_handoff_action"
ADD CONSTRAINT "shipment_work_handoff_action_handoff_fkey"
FOREIGN KEY ("handoff_id", "tenant_id")
REFERENCES "shipment_work_handoff"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;

-- Verification after deploy:
-- SELECT to_regclass('public.shipment_work_handoff'), to_regclass('public.shipment_work_handoff_action');
-- SELECT conname, convalidated FROM pg_constraint
-- WHERE conrelid IN ('shipment_work_handoff'::regclass, 'shipment_work_handoff_action'::regclass)
-- ORDER BY conname;
-- Recovery before any business write: drop the action table first, then the handoff table.
-- After business writes exist, preserve the rows and roll forward with a corrective migration.
