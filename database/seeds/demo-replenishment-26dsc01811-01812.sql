-- Compatibility-only raw SQL seed for source snapshots and order lines.
-- Use `pnpm db:seed` for the complete demo including stable SKU identities and
-- authoritative cargo allocations. Idempotent within the dedicated demo tenant.
-- Source values are preserved in import_row.snapshot; this file does not advance lifecycle nodes.
BEGIN;

INSERT INTO import_batch (id, tenant_id, operator_id, idempotency_key, file_name, file_hash,
  source_file_status, parser_version, status,
  row_count, column_count, mapping_suggestions, confirmed_quantity_unit, created_at, updated_at)
VALUES ('demo-import-26dsc01812-bom', 'demo-real-sample-20260921', 'demo-seed',
  'real-sample-20260921-26dsc01812-bom', 'fcbeedd8ed65a9de854e05381bd9fa3dc4dcfb5dcaee133092d268a6b8981425',
  'not_retained', 'real-sample-v1', 'completed', 15,
  36, '[]'::jsonb, NULL, TIMESTAMPTZ '2026-09-21T00:00:00+08:00', TIMESTAMPTZ '2026-09-21T00:00:00+08:00')
ON CONFLICT (tenant_id, idempotency_key) DO UPDATE SET
  file_hash = EXCLUDED.file_hash, row_count = EXCLUDED.row_count,
  column_count = EXCLUDED.column_count, updated_at = EXCLUDED.updated_at;

INSERT INTO replenishment_order (id, tenant_id, order_number, created_at, updated_at)
VALUES ('demo-order-26dsc01811', 'demo-real-sample-20260921', '26DSC01811',
  TIMESTAMP '2026-09-21 00:00:00', TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (tenant_id, order_number) DO UPDATE SET updated_at = EXCLUDED.updated_at;

INSERT INTO replenishment_order (id, tenant_id, order_number, created_at, updated_at)
VALUES ('demo-order-26dsc01812', 'demo-real-sample-20260921', '26DSC01812',
  TIMESTAMP '2026-09-21 00:00:00', TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (tenant_id, order_number) DO UPDATE SET updated_at = EXCLUDED.updated_at;

INSERT INTO container_record (id, tenant_id, order_number, replenishment_order_id,
  main_order_number, container_number, current_status, created_at, updated_at)
VALUES ('733df9ba-95f4-5f7e-8921-4f0783738e72', 'demo-real-sample-20260921', '26DSC01811',
  'demo-order-26dsc01811', '26DSC01811', 'HMMU4207629',
  'shipped', TIMESTAMP '2026-09-21 00:00:00', TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (id) DO UPDATE SET
  replenishment_order_id = EXCLUDED.replenishment_order_id,
  main_order_number = EXCLUDED.main_order_number, container_number = EXCLUDED.container_number,
  current_status = EXCLUDED.current_status, updated_at = EXCLUDED.updated_at;

INSERT INTO container_record (id, tenant_id, order_number, replenishment_order_id,
  main_order_number, container_number, current_status, created_at, updated_at)
VALUES ('01de7e3f-e3d2-57a6-a323-67109091ad08', 'demo-real-sample-20260921', '26DSC01812',
  'demo-order-26dsc01812', '26DSC01811', 'HMMU4956442',
  'shipped', TIMESTAMP '2026-09-21 00:00:00', TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (id) DO UPDATE SET
  replenishment_order_id = EXCLUDED.replenishment_order_id,
  main_order_number = EXCLUDED.main_order_number, container_number = EXCLUDED.container_number,
  current_status = EXCLUDED.current_status, updated_at = EXCLUDED.updated_at;

INSERT INTO import_row (id, batch_id, row_no, snapshot, created_at)
VALUES ('demo-row-26dsc01812-01', 'demo-import-26dsc01812-bom', 1, '{"货号":"331-015","品名":"儿童组合秋千滑梯","中文规格":"功能：3合1（滑梯，秋千，篮筐）；尺寸：W152*D149*H107cm；材质：HDPE，PP（链接件）；颜色：主体蓝绿色+黄色+灰色","BOM名称":"儿童组合秋千滑梯","海关编码":9506999000,"报关品名":"儿童组合秋千滑梯","报关品名(打印)":"儿童组合秋千滑梯","报关英文品名":"KIDS SWING SLIDE COMBINATION","商品品牌":"QABA","出运数量":118,"出运单位":"件","报关数量":118,"报关单位":"件","箱数":118,"毛重(KG)":1404.2,"净重(KG)":1227.2,"体积":19.63,"FOB单价(报关)":206.21,"报关币别":"人民币","FOB单价$":30.43,"商检":false,"报关发票号":"26DSC01812001","字母":"C","报关公司":"宁波遨森网络科技有限公司","供应商":"浙江玩美玩具有限公司","业务实体":"宁波遨森网络科技有限公司","报关业务实体":"宁波遨森网络科技有限公司","合同号":"26R3638","采购币种":"人民币","合同行号":17,"货源地":"浙江省_温州市_永嘉县","备货明细id":2.56617230900196e+18,"转卖交易汇率":1,"报关币别转美元汇":6.7743000013,"bomid":1.47051754158242e+18}'::jsonb,
  TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (batch_id, row_no) DO UPDATE SET snapshot = EXCLUDED.snapshot;

INSERT INTO replenishment_order_line (id, tenant_id, replenishment_order_id, product_number,
  shipped_quantity, quantity_unit, contract_number, source_batch_id, source_row_id,
  is_current, created_at, updated_at)
VALUES ('de59c776-3ed8-53e4-bb02-42c8027e400c', 'demo-real-sample-20260921', 'demo-order-26dsc01812',
  '331-015', 118, 'piece',
  '26R3638', 'demo-import-26dsc01812-bom', 'demo-row-26dsc01812-01', true,
  TIMESTAMP '2026-09-21 00:00:00', TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (source_batch_id, source_row_id) DO UPDATE SET
  product_number = EXCLUDED.product_number, shipped_quantity = EXCLUDED.shipped_quantity,
  quantity_unit = EXCLUDED.quantity_unit, contract_number = EXCLUDED.contract_number,
  is_current = true, updated_at = EXCLUDED.updated_at;

INSERT INTO import_row (id, batch_id, row_no, snapshot, created_at)
VALUES ('demo-row-26dsc01812-02', 'demo-import-26dsc01812-bom', 2, '{"货号":"331-011","品名":"儿童游玩隧道","中文规格":"产品尺寸：L150*W97*H120cm；材质：HDPE、PP；颜色：紫色主体；","BOM名称":"塑料儿童隧道","海关编码":9503008900,"报关品名":"塑料儿童隧道","报关品名(打印)":"塑料儿童隧道","报关英文品名":"PLASTIC TOYS","商品品牌":"QABA","出运数量":20,"出运单位":"件","报关数量":20,"报关单位":"套","箱数":20,"毛重(KG)":417,"净重(KG)":376,"体积":5.8,"FOB单价(报关)":319.87,"报关币别":"人民币","FOB单价$":47.21,"商检":false,"报关发票号":"26DSC01812001","字母":"C","报关公司":"宁波遨森网络科技有限公司","供应商":"利幼实业有限公司","业务实体":"宁波遨森网络科技有限公司","报关业务实体":"宁波遨森网络科技有限公司","合同号":"26R4005","采购币种":"人民币","合同行号":1,"货源地":"浙江省_温州市_永嘉县","备货明细id":2.56617230900196e+18,"转卖交易汇率":1,"报关币别转美元汇":6.7743000013,"bomid":1.4705173512533e+18}'::jsonb,
  TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (batch_id, row_no) DO UPDATE SET snapshot = EXCLUDED.snapshot;

INSERT INTO replenishment_order_line (id, tenant_id, replenishment_order_id, product_number,
  shipped_quantity, quantity_unit, contract_number, source_batch_id, source_row_id,
  is_current, created_at, updated_at)
VALUES ('ea9735b1-691d-56e4-aa48-167e18cb56e8', 'demo-real-sample-20260921', 'demo-order-26dsc01812',
  '331-011', 20, 'piece',
  '26R4005', 'demo-import-26dsc01812-bom', 'demo-row-26dsc01812-02', true,
  TIMESTAMP '2026-09-21 00:00:00', TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (source_batch_id, source_row_id) DO UPDATE SET
  product_number = EXCLUDED.product_number, shipped_quantity = EXCLUDED.shipped_quantity,
  quantity_unit = EXCLUDED.quantity_unit, contract_number = EXCLUDED.contract_number,
  is_current = true, updated_at = EXCLUDED.updated_at;

INSERT INTO import_row (id, batch_id, row_no, snapshot, created_at)
VALUES ('demo-row-26dsc01812-03', 'demo-import-26dsc01812-bom', 3, '{"货号":"311-053V00PK","品名":"儿童收纳盒","中文规格":"尺寸：L75*W37*H56.5cm；材质：PP；颜色：渐变粉色","BOM名称":"收纳盒","海关编码":4202920000,"报关品名":"收纳盒","报关品名(打印)":"收纳盒","报关英文品名":"ORGANIZER","商品品牌":"QABA","出运数量":30,"出运单位":"件","报关数量":30,"报关单位":"个","箱数":30,"毛重(KG)":289.5,"净重(KG)":249,"体积":3.15,"FOB单价(报关)":158.78,"报关币别":"人民币","FOB单价$":23.44,"商检":false,"报关发票号":"26DSC01812001","字母":"C","报关公司":"宁波遨森网络科技有限公司","供应商":"利幼实业有限公司","业务实体":"宁波遨森网络科技有限公司","报关业务实体":"宁波遨森网络科技有限公司","合同号":"26R3666","采购币种":"人民币","合同行号":134,"货源地":"浙江省_温州市_永嘉县","备货明细id":2.56617230900196e+18,"转卖交易汇率":1,"报关币别转美元汇":6.7743000013,"bomid":1.47051978473815e+18}'::jsonb,
  TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (batch_id, row_no) DO UPDATE SET snapshot = EXCLUDED.snapshot;

INSERT INTO replenishment_order_line (id, tenant_id, replenishment_order_id, product_number,
  shipped_quantity, quantity_unit, contract_number, source_batch_id, source_row_id,
  is_current, created_at, updated_at)
VALUES ('a51af5b1-29e5-5312-ac43-2728ae6599e5', 'demo-real-sample-20260921', 'demo-order-26dsc01812',
  '311-053V00PK', 30, 'piece',
  '26R3666', 'demo-import-26dsc01812-bom', 'demo-row-26dsc01812-03', true,
  TIMESTAMP '2026-09-21 00:00:00', TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (source_batch_id, source_row_id) DO UPDATE SET
  product_number = EXCLUDED.product_number, shipped_quantity = EXCLUDED.shipped_quantity,
  quantity_unit = EXCLUDED.quantity_unit, contract_number = EXCLUDED.contract_number,
  is_current = true, updated_at = EXCLUDED.updated_at;

INSERT INTO import_row (id, batch_id, row_no, snapshot, created_at)
VALUES ('demo-row-26dsc01812-04', 'demo-import-26dsc01812-bom', 4, '{"货号":"331-054V00YL","品名":"儿童滑梯","中文规格":"1、功能：6合1，滑梯，钻洞，收纳筐，望远镜，投篮，过道; 2、尺寸：L178*W177*H99cm; 3、材质：HDPE，PP; 4、颜色：主体白色，黄色过道侧板+滑梯尾板，绿色滑梯侧板+阶梯侧板; ","BOM名称":"儿童滑梯","海关编码":9506999000,"报关品名":"儿童滑梯","报关品名(打印)":"儿童滑梯","报关英文品名":"FOLDING SLIDE","商品品牌":"QABA","出运数量":25,"出运单位":"件","报关数量":25,"报关单位":"个","箱数":25,"毛重(KG)":500,"净重(KG)":435,"体积":6.37,"FOB单价(报关)":325.5,"报关币别":"人民币","FOB单价$":48.05,"商检":false,"报关发票号":"26DSC01812001","字母":"C","报关公司":"宁波遨森网络科技有限公司","供应商":"利幼实业有限公司","业务实体":"宁波遨森网络科技有限公司","报关业务实体":"宁波遨森网络科技有限公司","合同号":"26R3633","采购币种":"人民币","合同行号":252,"货源地":"浙江省_温州市_永嘉县","备货明细id":2.56617230900196e+18,"转卖交易汇率":1,"报关币别转美元汇":6.7743000013,"bomid":1.8690205290296e+18}'::jsonb,
  TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (batch_id, row_no) DO UPDATE SET snapshot = EXCLUDED.snapshot;

INSERT INTO replenishment_order_line (id, tenant_id, replenishment_order_id, product_number,
  shipped_quantity, quantity_unit, contract_number, source_batch_id, source_row_id,
  is_current, created_at, updated_at)
VALUES ('bc877e71-3dc8-5654-8ff4-96059b2fdb7c', 'demo-real-sample-20260921', 'demo-order-26dsc01812',
  '331-054V00YL', 25, 'piece',
  '26R3633', 'demo-import-26dsc01812-bom', 'demo-row-26dsc01812-04', true,
  TIMESTAMP '2026-09-21 00:00:00', TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (source_batch_id, source_row_id) DO UPDATE SET
  product_number = EXCLUDED.product_number, shipped_quantity = EXCLUDED.shipped_quantity,
  quantity_unit = EXCLUDED.quantity_unit, contract_number = EXCLUDED.contract_number,
  is_current = true, updated_at = EXCLUDED.updated_at;

INSERT INTO import_row (id, batch_id, row_no, snapshot, created_at)
VALUES ('demo-row-26dsc01812-05', 'demo-import-26dsc01812-bom', 5, '{"货号":"311-023V01CW","品名":"儿童收纳盒","中文规格":"1、特点：抽屉式；2、尺寸：L37*W37*H76cm；3、材质：PP；4、颜色：米白色；","BOM名称":"儿童收纳盒","海关编码":9403700000,"报关品名":"儿童收纳盒","报关品名(打印)":"儿童收纳盒","报关英文品名":"KIDS STORAGE BOXES","商品品牌":"QABA","出运数量":30,"出运单位":"件","报关数量":30,"报关单位":"件","箱数":30,"毛重(KG)":190.5,"净重(KG)":174,"体积":1.98,"FOB单价(报关)":113.03,"报关币别":"人民币","FOB单价$":16.68,"商检":false,"报关发票号":"26DSC01812001","字母":"C","报关公司":"宁波遨森网络科技有限公司","供应商":"利幼实业有限公司","业务实体":"宁波遨森网络科技有限公司","报关业务实体":"宁波遨森网络科技有限公司","合同号":"26R3666","采购币种":"人民币","合同行号":116,"货源地":"浙江省_温州市_永嘉县","备货明细id":2.56617230900196e+18,"转卖交易汇率":1,"报关币别转美元汇":6.7743000013,"bomid":1.91394851660526e+18}'::jsonb,
  TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (batch_id, row_no) DO UPDATE SET snapshot = EXCLUDED.snapshot;

INSERT INTO replenishment_order_line (id, tenant_id, replenishment_order_id, product_number,
  shipped_quantity, quantity_unit, contract_number, source_batch_id, source_row_id,
  is_current, created_at, updated_at)
VALUES ('b4c1309b-bab8-5714-8662-ffb6330ee70d', 'demo-real-sample-20260921', 'demo-order-26dsc01812',
  '311-023V01CW', 30, 'piece',
  '26R3666', 'demo-import-26dsc01812-bom', 'demo-row-26dsc01812-05', true,
  TIMESTAMP '2026-09-21 00:00:00', TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (source_batch_id, source_row_id) DO UPDATE SET
  product_number = EXCLUDED.product_number, shipped_quantity = EXCLUDED.shipped_quantity,
  quantity_unit = EXCLUDED.quantity_unit, contract_number = EXCLUDED.contract_number,
  is_current = true, updated_at = EXCLUDED.updated_at;

INSERT INTO import_row (id, batch_id, row_no, snapshot, created_at)
VALUES ('demo-row-26dsc01812-06', 'demo-import-26dsc01812-bom', 6, '{"货号":"331-085V00PK","品名":"儿童滑梯","中文规格":"1、功能：小滑梯; 2、尺寸：L106*W51.5*H52cm; 3、材质：PE，PP; 4、颜色：粉色侧板，粉色滑梯尾板，白色滑梯，白色阶梯; ","BOM名称":"儿童滑梯","海关编码":9506999000,"报关品名":"儿童滑梯","报关品名(打印)":"儿童滑梯","报关英文品名":"FOLDING SLIDE","商品品牌":"QABA","出运数量":35,"出运单位":"件","报关数量":35,"报关单位":"个","箱数":35,"毛重(KG)":143.5,"净重(KG)":119,"体积":1.63,"FOB单价(报关)":63.22,"报关币别":"人民币","FOB单价$":9.33,"商检":false,"报关发票号":"26DSC01812001","字母":"C","报关公司":"宁波遨森网络科技有限公司","供应商":"利幼实业有限公司","业务实体":"宁波遨森网络科技有限公司","报关业务实体":"宁波遨森网络科技有限公司","合同号":"26R3633","采购币种":"人民币","合同行号":245,"货源地":"浙江省_温州市_永嘉县","备货明细id":2.56617230900196e+18,"转卖交易汇率":1,"报关币别转美元汇":6.7743000013,"bomid":2.00814964398259e+18}'::jsonb,
  TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (batch_id, row_no) DO UPDATE SET snapshot = EXCLUDED.snapshot;

INSERT INTO replenishment_order_line (id, tenant_id, replenishment_order_id, product_number,
  shipped_quantity, quantity_unit, contract_number, source_batch_id, source_row_id,
  is_current, created_at, updated_at)
VALUES ('5f5b5f0d-346c-53ee-9076-a9eed6cf1672', 'demo-real-sample-20260921', 'demo-order-26dsc01812',
  '331-085V00PK', 35, 'piece',
  '26R3633', 'demo-import-26dsc01812-bom', 'demo-row-26dsc01812-06', true,
  TIMESTAMP '2026-09-21 00:00:00', TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (source_batch_id, source_row_id) DO UPDATE SET
  product_number = EXCLUDED.product_number, shipped_quantity = EXCLUDED.shipped_quantity,
  quantity_unit = EXCLUDED.quantity_unit, contract_number = EXCLUDED.contract_number,
  is_current = true, updated_at = EXCLUDED.updated_at;

INSERT INTO import_row (id, batch_id, row_no, snapshot, created_at)
VALUES ('demo-row-26dsc01812-07', 'demo-import-26dsc01812-bom', 7, '{"货号":"331-088V00YL","品名":"儿童滑梯","中文规格":"1、功能：滑梯、投篮、钻洞、游戏望远镜、画板; 2、尺寸：L176*W150*H94cm; 3、材质：HDPE，PP; 4、颜色：黄绿配色; ","BOM名称":"儿童滑梯","海关编码":9506999000,"报关品名":"儿童滑梯","报关品名(打印)":"儿童滑梯","报关英文品名":"FOLDING SLIDE","商品品牌":"QABA","出运数量":25,"出运单位":"件","报关数量":25,"报关单位":"个","箱数":25,"毛重(KG)":500,"净重(KG)":435,"体积":6.32,"FOB单价(报关)":312.09,"报关币别":"人民币","FOB单价$":46.07,"商检":false,"报关发票号":"26DSC01812002","字母":"D","报关公司":"遨森电子商务股份有限公司","供应商":"利幼实业有限公司","业务实体":"遨森电子商务股份有限公司","报关业务实体":"遨森电子商务股份有限公司","合同号":"26R3960","采购币种":"人民币","合同行号":3,"货源地":"浙江省_温州市_永嘉县","备货明细id":2.56617230900196e+18,"转卖交易汇率":1,"报关币别转美元汇":6.7743000013,"bomid":2.12702651494361e+18}'::jsonb,
  TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (batch_id, row_no) DO UPDATE SET snapshot = EXCLUDED.snapshot;

INSERT INTO replenishment_order_line (id, tenant_id, replenishment_order_id, product_number,
  shipped_quantity, quantity_unit, contract_number, source_batch_id, source_row_id,
  is_current, created_at, updated_at)
VALUES ('2ccf78b4-7dc1-5435-ab52-641ce48b9c22', 'demo-real-sample-20260921', 'demo-order-26dsc01812',
  '331-088V00YL', 25, 'piece',
  '26R3960', 'demo-import-26dsc01812-bom', 'demo-row-26dsc01812-07', true,
  TIMESTAMP '2026-09-21 00:00:00', TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (source_batch_id, source_row_id) DO UPDATE SET
  product_number = EXCLUDED.product_number, shipped_quantity = EXCLUDED.shipped_quantity,
  quantity_unit = EXCLUDED.quantity_unit, contract_number = EXCLUDED.contract_number,
  is_current = true, updated_at = EXCLUDED.updated_at;

INSERT INTO import_row (id, batch_id, row_no, snapshot, created_at)
VALUES ('demo-row-26dsc01812-08', 'demo-import-26dsc01812-bom', 8, '{"货号":"331-054V00OG","品名":"儿童滑梯","中文规格":"1、尺寸：总体尺寸(长)cm：178，总体尺寸(宽)cm：177，总体尺寸(高)cm：99，滑梯数量&尺寸：1个滑梯，内径长133cm，内宽32cm，离地高度52cm，滑梯平台尺寸cm：平台过道尺寸144x27cm，滑梯侧板高度cm：6，阶梯尺寸cm：三级阶梯，单阶尺寸W26*D10cm，间距高度12.5cm，带防滑纹路，篮筐尺寸cm：内径24cm，外径29.5cm，篮筐离地高度80cm，其余配件尺寸：钻洞41x40cm；篮球6寸PVC；打气筒17.5cm；2、承重：整体承重kg：30，单个小孩承重kg：30；3、适用人数：1；4、配件：6寸PVC篮球，打气筒17.5cm；","BOM名称":"儿童滑梯","海关编码":9506999000,"报关品名":"儿童滑梯","报关品名(打印)":"儿童滑梯","报关英文品名":"FOLDING SLIDE","商品品牌":"QABA","出运数量":20,"出运单位":"件","报关数量":20,"报关单位":"个","箱数":20,"毛重(KG)":400,"净重(KG)":348,"体积":5.09,"FOB单价(报关)":325.5,"报关币别":"人民币","FOB单价$":48.05,"商检":false,"报关发票号":"26DSC01812001","字母":"C","报关公司":"宁波遨森网络科技有限公司","供应商":"利幼实业有限公司","业务实体":"宁波遨森网络科技有限公司","报关业务实体":"宁波遨森网络科技有限公司","合同号":"26R3975","采购币种":"人民币","合同行号":2,"货源地":"浙江省_温州市_永嘉县","备货明细id":2.56617230900196e+18,"转卖交易汇率":1,"报关币别转美元汇":6.7743000013,"bomid":2.29581249893639e+18}'::jsonb,
  TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (batch_id, row_no) DO UPDATE SET snapshot = EXCLUDED.snapshot;

INSERT INTO replenishment_order_line (id, tenant_id, replenishment_order_id, product_number,
  shipped_quantity, quantity_unit, contract_number, source_batch_id, source_row_id,
  is_current, created_at, updated_at)
VALUES ('a7792350-c59e-5082-a650-6a2773e397a3', 'demo-real-sample-20260921', 'demo-order-26dsc01812',
  '331-054V00OG', 20, 'piece',
  '26R3975', 'demo-import-26dsc01812-bom', 'demo-row-26dsc01812-08', true,
  TIMESTAMP '2026-09-21 00:00:00', TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (source_batch_id, source_row_id) DO UPDATE SET
  product_number = EXCLUDED.product_number, shipped_quantity = EXCLUDED.shipped_quantity,
  quantity_unit = EXCLUDED.quantity_unit, contract_number = EXCLUDED.contract_number,
  is_current = true, updated_at = EXCLUDED.updated_at;

INSERT INTO import_row (id, batch_id, row_no, snapshot, created_at)
VALUES ('demo-row-26dsc01812-09', 'demo-import-26dsc01812-bom', 9, '{"货号":"331-113V00YL","品名":"儿童滑梯","中文规格":"1、功能：7合1功能，小房子、画板、滑梯、投篮、望远镜、钻洞; 2、尺寸：L189*W180*H111cm; 3、材质：HDPE，PP; 4、颜色：黄绿配色; ","BOM名称":"儿童滑梯","海关编码":9506999000,"报关品名":"儿童滑梯","报关品名(打印)":"儿童滑梯","报关英文品名":"FOLDING SLIDE","商品品牌":"QABA","出运数量":25,"出运单位":"件","报关数量":25,"报关单位":"个","箱数":25,"毛重(KG)":612.5,"净重(KG)":540,"体积":6.46,"FOB单价(报关)":418.52,"报关币别":"人民币","FOB单价$":61.78,"商检":false,"报关发票号":"26DSC01812001","字母":"C","报关公司":"宁波遨森网络科技有限公司","供应商":"利幼实业有限公司","业务实体":"宁波遨森网络科技有限公司","报关业务实体":"宁波遨森网络科技有限公司","合同号":"26R3891","采购币种":"人民币","合同行号":3,"货源地":"浙江省_温州市_永嘉县","备货明细id":2.56617230900196e+18,"转卖交易汇率":1,"报关币别转美元汇":6.7743000013,"bomid":2.20811406189714e+18}'::jsonb,
  TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (batch_id, row_no) DO UPDATE SET snapshot = EXCLUDED.snapshot;

INSERT INTO replenishment_order_line (id, tenant_id, replenishment_order_id, product_number,
  shipped_quantity, quantity_unit, contract_number, source_batch_id, source_row_id,
  is_current, created_at, updated_at)
VALUES ('4c130195-9c6d-571e-824e-487ccbf4cf0e', 'demo-real-sample-20260921', 'demo-order-26dsc01812',
  '331-113V00YL', 25, 'piece',
  '26R3891', 'demo-import-26dsc01812-bom', 'demo-row-26dsc01812-09', true,
  TIMESTAMP '2026-09-21 00:00:00', TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (source_batch_id, source_row_id) DO UPDATE SET
  product_number = EXCLUDED.product_number, shipped_quantity = EXCLUDED.shipped_quantity,
  quantity_unit = EXCLUDED.quantity_unit, contract_number = EXCLUDED.contract_number,
  is_current = true, updated_at = EXCLUDED.updated_at;

INSERT INTO import_row (id, batch_id, row_no, snapshot, created_at)
VALUES ('demo-row-26dsc01812-10', 'demo-import-26dsc01812-bom', 10, '{"货号":"311-013GY","品名":"儿童储物凳","中文规格":"尺寸：L60*W40*H48cm；材质：MDF；颜色：灰色，无印刷图案；","BOM名称":"收纳箱","海关编码":9403609990,"报关品名":"收纳箱","报关品名(打印)":"收纳箱","报关英文品名":"STORAGE ORGANIZER","商品品牌":"QABA","出运数量":11,"出运单位":"件","报关数量":11,"报关单位":"件","箱数":11,"毛重(KG)":125.4,"净重(KG)":114.4,"体积":0.4,"FOB单价(报关)":111.6,"报关币别":"人民币","FOB单价$":16.47,"商检":true,"报关发票号":"26DSC01812001","字母":"C","报关公司":"宁波遨森网络科技有限公司","供应商":"泰顺县振兴玩具有限公司","业务实体":"宁波遨森网络科技有限公司","报关业务实体":"宁波遨森网络科技有限公司","合同号":"26R3637","采购币种":"人民币","合同行号":214,"货源地":"浙江省_温州市_泰顺县","备货明细id":2.56617230900196e+18,"转卖交易汇率":1,"报关币别转美元汇":6.7743000013,"bomid":1.47051990125591e+18}'::jsonb,
  TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (batch_id, row_no) DO UPDATE SET snapshot = EXCLUDED.snapshot;

INSERT INTO replenishment_order_line (id, tenant_id, replenishment_order_id, product_number,
  shipped_quantity, quantity_unit, contract_number, source_batch_id, source_row_id,
  is_current, created_at, updated_at)
VALUES ('bf511794-eebd-5820-8280-4fbea3e1e4f2', 'demo-real-sample-20260921', 'demo-order-26dsc01812',
  '311-013GY', 11, 'piece',
  '26R3637', 'demo-import-26dsc01812-bom', 'demo-row-26dsc01812-10', true,
  TIMESTAMP '2026-09-21 00:00:00', TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (source_batch_id, source_row_id) DO UPDATE SET
  product_number = EXCLUDED.product_number, shipped_quantity = EXCLUDED.shipped_quantity,
  quantity_unit = EXCLUDED.quantity_unit, contract_number = EXCLUDED.contract_number,
  is_current = true, updated_at = EXCLUDED.updated_at;

INSERT INTO import_row (id, batch_id, row_no, snapshot, created_at)
VALUES ('demo-row-26dsc01812-11', 'demo-import-26dsc01812-bom', 11, '{"货号":"312-103V80WT","品名":"儿童书桌椅套装","中文规格":"1、2件套; 2、尺寸：1*桌子W80*D39*H59cm，1*椅子W29*D29*H52cm; 3、材质：MDF; 4、颜色：白色主体，黄木纹色桌面+椅面+椅背; ","BOM名称":"儿童桌椅套装","海关编码":9403609990,"报关品名":"儿童桌椅套装","报关品名(打印)":"儿童桌椅套装","报关英文品名":"TABLE CHAIR SET","商品品牌":"QABA","出运数量":20,"出运单位":"套","报关数量":20,"报关单位":"套","箱数":20,"毛重(KG)":358,"净重(KG)":324,"体积":1.27,"FOB单价(报关)":176.93,"报关币别":"人民币","FOB单价$":26.12,"商检":true,"报关发票号":"26DSC01812001","字母":"C","报关公司":"宁波遨森网络科技有限公司","供应商":"泰顺县振兴玩具有限公司","业务实体":"宁波遨森网络科技有限公司","报关业务实体":"宁波遨森网络科技有限公司","合同号":"26R3637","采购币种":"人民币","合同行号":205,"货源地":"浙江省_温州市_泰顺县","备货明细id":2.56617230900196e+18,"转卖交易汇率":1,"报关币别转美元汇":6.7743000013,"bomid":1.69551953895257e+18}'::jsonb,
  TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (batch_id, row_no) DO UPDATE SET snapshot = EXCLUDED.snapshot;

INSERT INTO replenishment_order_line (id, tenant_id, replenishment_order_id, product_number,
  shipped_quantity, quantity_unit, contract_number, source_batch_id, source_row_id,
  is_current, created_at, updated_at)
VALUES ('a33839d8-f434-5d17-81cb-29617525f1b1', 'demo-real-sample-20260921', 'demo-order-26dsc01812',
  '312-103V80WT', 20, 'set',
  '26R3637', 'demo-import-26dsc01812-bom', 'demo-row-26dsc01812-11', true,
  TIMESTAMP '2026-09-21 00:00:00', TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (source_batch_id, source_row_id) DO UPDATE SET
  product_number = EXCLUDED.product_number, shipped_quantity = EXCLUDED.shipped_quantity,
  quantity_unit = EXCLUDED.quantity_unit, contract_number = EXCLUDED.contract_number,
  is_current = true, updated_at = EXCLUDED.updated_at;

INSERT INTO import_row (id, batch_id, row_no, snapshot, created_at)
VALUES ('demo-row-26dsc01812-12', 'demo-import-26dsc01812-bom', 12, '{"货号":"350-172V80PK","品名":"儿童厨房玩具套装","中文规格":"1、功能：儿童厨房玩具套装; 2、产品尺寸：L83.8*W26.8*H81cm; 3、材质：MDF; 4、颜色：主体粉色，柜门白色; ","BOM名称":"儿童厨房玩具","海关编码":9503008900,"报关品名":"儿童厨房玩具","报关品名(打印)":"儿童厨房玩具","报关英文品名":"KITCHEN TOYS","商品品牌":"QABA","出运数量":25,"出运单位":"件","报关数量":25,"报关单位":"套","箱数":25,"毛重(KG)":370,"净重(KG)":335,"体积":1.38,"FOB单价(报关)":222.7,"报关币别":"人民币","FOB单价$":32.88,"商检":false,"报关发票号":"26DSC01812001","字母":"C","报关公司":"宁波遨森网络科技有限公司","供应商":"泰顺县振兴玩具有限公司","业务实体":"宁波遨森网络科技有限公司","报关业务实体":"宁波遨森网络科技有限公司","合同号":"26R3636","采购币种":"人民币","合同行号":130,"货源地":"浙江省_温州市_泰顺县","备货明细id":2.56617230900196e+18,"转卖交易汇率":1,"报关币别转美元汇":6.7743000013,"bomid":1.93255340869594e+18}'::jsonb,
  TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (batch_id, row_no) DO UPDATE SET snapshot = EXCLUDED.snapshot;

INSERT INTO replenishment_order_line (id, tenant_id, replenishment_order_id, product_number,
  shipped_quantity, quantity_unit, contract_number, source_batch_id, source_row_id,
  is_current, created_at, updated_at)
VALUES ('c65bb774-35eb-58c1-b495-5206dd08fd29', 'demo-real-sample-20260921', 'demo-order-26dsc01812',
  '350-172V80PK', 25, 'piece',
  '26R3636', 'demo-import-26dsc01812-bom', 'demo-row-26dsc01812-12', true,
  TIMESTAMP '2026-09-21 00:00:00', TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (source_batch_id, source_row_id) DO UPDATE SET
  product_number = EXCLUDED.product_number, shipped_quantity = EXCLUDED.shipped_quantity,
  quantity_unit = EXCLUDED.quantity_unit, contract_number = EXCLUDED.contract_number,
  is_current = true, updated_at = EXCLUDED.updated_at;

INSERT INTO import_row (id, batch_id, row_no, snapshot, created_at)
VALUES ('demo-row-26dsc01812-13', 'demo-import-26dsc01812-bom', 13, '{"货号":"311-094V80WT","品名":"儿童书架","中文规格":"1、尺寸：L63.7*W29.7*H89.5cm; 2、材质：MDF; 3、颜色：白色; ","BOM名称":"木书架","海关编码":9403609990,"报关品名":"木书架","报关品名(打印)":"书架","报关英文品名":"BOOK SHELF","商品品牌":"QABA","出运数量":20,"出运单位":"件","报关数量":20,"报关单位":"件","箱数":20,"毛重(KG)":286,"净重(KG)":266,"体积":0.83,"FOB单价(报关)":155.1,"报关币别":"人民币","FOB单价$":22.9,"商检":true,"报关发票号":"26DSC01812001","字母":"C","报关公司":"宁波遨森网络科技有限公司","供应商":"泰顺县振兴玩具有限公司","业务实体":"宁波遨森网络科技有限公司","报关业务实体":"宁波遨森网络科技有限公司","合同号":"26R3637","采购币种":"人民币","合同行号":209,"货源地":"浙江省_温州市_泰顺县","备货明细id":2.56617230900196e+18,"转卖交易汇率":1,"报关币别转美元汇":6.7743000013,"bomid":1.96735954042725e+18}'::jsonb,
  TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (batch_id, row_no) DO UPDATE SET snapshot = EXCLUDED.snapshot;

INSERT INTO replenishment_order_line (id, tenant_id, replenishment_order_id, product_number,
  shipped_quantity, quantity_unit, contract_number, source_batch_id, source_row_id,
  is_current, created_at, updated_at)
VALUES ('106aa4ef-36d9-53c6-a3f3-48e6c1aa75ed', 'demo-real-sample-20260921', 'demo-order-26dsc01812',
  '311-094V80WT', 20, 'piece',
  '26R3637', 'demo-import-26dsc01812-bom', 'demo-row-26dsc01812-13', true,
  TIMESTAMP '2026-09-21 00:00:00', TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (source_batch_id, source_row_id) DO UPDATE SET
  product_number = EXCLUDED.product_number, shipped_quantity = EXCLUDED.shipped_quantity,
  quantity_unit = EXCLUDED.quantity_unit, contract_number = EXCLUDED.contract_number,
  is_current = true, updated_at = EXCLUDED.updated_at;

INSERT INTO import_row (id, batch_id, row_no, snapshot, created_at)
VALUES ('demo-row-26dsc01812-14', 'demo-import-26dsc01812-bom', 14, '{"货号":"316-031V80PK","品名":"儿童梳妆台套装","中文规格":"1、一桌一椅两件套; 2、功能：儿童梳妆台套装; 3、尺寸：梳妆台L88.6*W38.8*H96.9cm；椅子W29*D32*H50.7cm; 4、材质：MDF; 5、颜色：粉色; ","BOM名称":"儿童梳妆台套装","海关编码":9403609990,"报关品名":"儿童梳妆台套装","报关品名(打印)":"儿童梳妆台套装","报关英文品名":"DRESSING TABLE SET","商品品牌":"QABA","出运数量":50,"出运单位":"套","报关数量":50,"报关单位":"套","箱数":50,"毛重(KG)":1063.2,"净重(KG)":970,"体积":3.47,"FOB单价(报关)":233.71,"报关币别":"人民币","FOB单价$":34.5,"商检":true,"报关发票号":"26DSC01812001","字母":"C","报关公司":"宁波遨森网络科技有限公司","供应商":"泰顺县振兴玩具有限公司","业务实体":"宁波遨森网络科技有限公司","报关业务实体":"宁波遨森网络科技有限公司","合同号":"26R3637","采购币种":"人民币","合同行号":199,"货源地":"浙江省_温州市_泰顺县","备货明细id":2.56617230900196e+18,"转卖交易汇率":1,"报关币别转美元汇":6.7743000013,"bomid":2.20939308322784e+18}'::jsonb,
  TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (batch_id, row_no) DO UPDATE SET snapshot = EXCLUDED.snapshot;

INSERT INTO replenishment_order_line (id, tenant_id, replenishment_order_id, product_number,
  shipped_quantity, quantity_unit, contract_number, source_batch_id, source_row_id,
  is_current, created_at, updated_at)
VALUES ('0fa35ebc-533b-56c8-8de0-91f0b1a0d749', 'demo-real-sample-20260921', 'demo-order-26dsc01812',
  '316-031V80PK', 50, 'set',
  '26R3637', 'demo-import-26dsc01812-bom', 'demo-row-26dsc01812-14', true,
  TIMESTAMP '2026-09-21 00:00:00', TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (source_batch_id, source_row_id) DO UPDATE SET
  product_number = EXCLUDED.product_number, shipped_quantity = EXCLUDED.shipped_quantity,
  quantity_unit = EXCLUDED.quantity_unit, contract_number = EXCLUDED.contract_number,
  is_current = true, updated_at = EXCLUDED.updated_at;

INSERT INTO import_row (id, batch_id, row_no, snapshot, created_at)
VALUES ('demo-row-26dsc01812-15', 'demo-import-26dsc01812-bom', 15, '{"货号":"316-031V80WT","品名":"儿童梳妆台套装","中文规格":"1、一桌一椅两件套; 2、功能：儿童梳妆台套装; 3、尺寸：梳妆台L88.6*W38.8*H96.9cm；椅子W29*D32*H50.7cm; 4、材质：MDF; 5、颜色：白色; ","BOM名称":"儿童梳妆台套装","海关编码":9403609990,"报关品名":"儿童梳妆台套装","报关品名(打印)":"儿童梳妆台套装","报关英文品名":"DRESSING TABLE SET","商品品牌":"QABA","出运数量":50,"出运单位":"套","报关数量":50,"报关单位":"套","箱数":50,"毛重(KG)":1063.2,"净重(KG)":970,"体积":3.47,"FOB单价(报关)":233.71,"报关币别":"人民币","FOB单价$":34.5,"商检":true,"报关发票号":"26DSC01812001","字母":"C","报关公司":"宁波遨森网络科技有限公司","供应商":"泰顺县振兴玩具有限公司","业务实体":"宁波遨森网络科技有限公司","报关业务实体":"宁波遨森网络科技有限公司","合同号":"26R3637","采购币种":"人民币","合同行号":202,"货源地":"浙江省_温州市_泰顺县","备货明细id":2.56617230900196e+18,"转卖交易汇率":1,"报关币别转美元汇":6.7743000013,"bomid":2.20939308322784e+18}'::jsonb,
  TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (batch_id, row_no) DO UPDATE SET snapshot = EXCLUDED.snapshot;

INSERT INTO replenishment_order_line (id, tenant_id, replenishment_order_id, product_number,
  shipped_quantity, quantity_unit, contract_number, source_batch_id, source_row_id,
  is_current, created_at, updated_at)
VALUES ('1bcc0d0b-cf5e-5fef-a960-4473660510c3', 'demo-real-sample-20260921', 'demo-order-26dsc01812',
  '316-031V80WT', 50, 'set',
  '26R3637', 'demo-import-26dsc01812-bom', 'demo-row-26dsc01812-15', true,
  TIMESTAMP '2026-09-21 00:00:00', TIMESTAMP '2026-09-21 00:00:00')
ON CONFLICT (source_batch_id, source_row_id) DO UPDATE SET
  product_number = EXCLUDED.product_number, shipped_quantity = EXCLUDED.shipped_quantity,
  quantity_unit = EXCLUDED.quantity_unit, contract_number = EXCLUDED.contract_number,
  is_current = true, updated_at = EXCLUDED.updated_at;

COMMIT;
