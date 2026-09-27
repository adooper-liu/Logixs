BEGIN;

-- 商品关键属性：按 GDSN 的分层规则分两层落。
--
-- **产品（SPU）层**放同款共享的（品类、品牌、型号、原产国、HS 编码、认证、
-- 温度、危险品分类、订货条件）；**SKU 层**放逐个不同的（颜色、尺寸重量、
-- 包装层级、条码、电池）。
--
-- 用 JSONB 而不是三十来个列：这些属性是**成组读写**的（一次录入一整组、
-- 界面一次显示一整组），形状由 `product-identity.schema.json` 权威定义，
-- 与 `review_points` / `stage_outcomes` 同一做法。将来某个属性真要按值查询时，
-- 再为它单开列与索引，不提前铺开。
ALTER TABLE "product" ADD COLUMN "attributes" JSONB NOT NULL;

-- SKU 层可空：`product_sku` 是既有表，存量行没有这组属性。
-- **空对象与 NULL 不是一回事** —— NULL 表示"还没录"，空对象表示"录了但没有"。
-- 存量 SKU 不属于任何产品（product_id 为空），不会走产品身份的读路径。
ALTER TABLE "product_sku" ADD COLUMN "attributes" JSONB;

ALTER TABLE "product_sku"
ADD CONSTRAINT "product_sku_attributes_check"
CHECK ("attributes" IS NULL OR jsonb_typeof("attributes") = 'object');

COMMIT;

-- Verification after deploy:
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns
-- WHERE table_name IN ('product', 'product_sku') AND column_name = 'attributes'
-- ORDER BY table_name;
-- Recovery before any business write: drop the two columns.
-- After business writes exist, preserve the values and roll forward.
