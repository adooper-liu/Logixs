BEGIN;

-- NPI 领取回执：把交到产品侧的立项接到某个产品负责人名下。
--
-- 追加写、不可变。领取**不等于**立项成立，也不产生任何产品结论 —— 立项阶段的
-- 结论在 `product_initiative_handoff` 快照里只读，本表只记录"谁接了"。
--
-- v1 每个 handoff 只会有一次领取（前一片明写不会有第二个交接版本），但版本列与
-- `(handoff_id, claim_version)` 唯一索引不是多余的：两个人同时点领取时，它让
-- 后到的那笔在数据库层失败，而不是靠应用层先读后写去赌。
CREATE TABLE "product_initiative_claim" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "handoff_id" UUID NOT NULL,
  "claim_version" INTEGER NOT NULL,
  "product_owner_actor_id" TEXT NOT NULL,
  "acted_at" TIMESTAMPTZ NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "product_initiative_claim_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_initiative_claim_version_check" CHECK ("claim_version" >= 1),
  CONSTRAINT "product_initiative_claim_text_check" CHECK (
    length(btrim("product_owner_actor_id")) BETWEEN 1 AND 200 AND
    length(btrim("idempotency_key")) BETWEEN 1 AND 200
  ),
  CONSTRAINT "product_initiative_claim_payload_hash_check" CHECK ("payload_hash" ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX "product_initiative_claim_id_tenant_key" ON "product_initiative_claim"("id", "tenant_id");
-- 同一幂等键只落一条回执：重复点领取不会写出第二笔。
CREATE UNIQUE INDEX "product_initiative_claim_idempotency_key" ON "product_initiative_claim"("tenant_id", "idempotency_key");
-- 并发领取的数据库层防线，见文件头。
CREATE UNIQUE INDEX "product_initiative_claim_version_key" ON "product_initiative_claim"("handoff_id", "claim_version");

-- 队列不另建索引：待办取自 `product_initiative_handoff` 的既有
-- `product_initiative_handoff_queue_idx`，领取状态经上面 (handoff_id, claim_version)
-- 的唯一索引做前缀查找即可，不预建当前用不上的索引。

ALTER TABLE "product_initiative_claim"
ADD CONSTRAINT "product_initiative_claim_handoff_fkey"
FOREIGN KEY ("handoff_id", "tenant_id")
REFERENCES "product_initiative_handoff"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;

-- Verification after deploy:
-- SELECT to_regclass('public.product_initiative_claim');
-- SELECT conname, convalidated FROM pg_constraint
-- WHERE conrelid = 'product_initiative_claim'::regclass ORDER BY conname;
-- SELECT indexname FROM pg_indexes WHERE tablename = 'product_initiative_claim' ORDER BY indexname;
-- Recovery before any business write: drop the table; the handoff snapshot is untouched.
-- After claims exist, preserve the rows and roll forward with a corrective migration.
