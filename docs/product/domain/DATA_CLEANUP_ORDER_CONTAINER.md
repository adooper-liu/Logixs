# 数据治理：备货单-货柜 关系清洗与校验（P2-06 首任务细则）

> 状态：**候选（细则）** · 2026-09-04 · 负责人：刘志高。
> 背景：负责人确认的 TO-BE 业务目标 = **一备货单→一货柜(1:1)、一提单(B/L)→多货柜**；现网快照对旧库物理基数存在冲突，且原证据仓库当前不可复现。「主备货单号」任取代表曾产生
> 「一单多柜 / 一柜多单」表象（[SHIPMENT_FLOW_OVERVIEW](./SHIPMENT_FLOW_OVERVIEW.md) §3、NODE_PDCA_VALIDATION F1/F7）。
> 本文件是 P2-06 **首项任务**的清洗与校验细则，遵循 `ENGINEERING_RULES` §4.3（阻止污染→证据→范围→根因→回归→重放→对账）。

## 1. 目标与范围

- 对现网旧数据（D:/Github/logix）与未来导入，保证"备货单-货柜"唯一对应、主备货单号不被当作业务关系使用。
- 范围：`biz_replenishment_orders`、`biz_containers` 及导入映射中的 备货单号/箱号/主备货单号/提单 关系。
- 不做：合并或拆分业务对象、新增货柜明细模型（如确认无合柜则不需要）。
- 实施阻断：取得原始 DDL、唯一约束和 a–d 探查结果前，不得建立 `UNIQUE(order_number)`、自动拆并关系或执行数据修复。

## 2. 校验约束（进入系统即强制）

1. **TO-BE 一备货单 ≤ 一货柜记录**：新导入同一 `orderNumber` 不得静默命中多条 ContainerRecord；旧数据先探查、分类和评审，不能用未验证假设直接加唯一约束。
2. **主备货单号不作键**：任何业务判断/去重/外键不得使用 `main_order_number`；其仅作票级展示代表。
3. **提单归组以提单号(B/L)聚合**：`B/L → (order, container)` 对集合；货柜→备货单 由 ContainerRecord 自身唯一决定，不由主备货单号推导。
4. 若导入行/旧数据出现 同备货单号多行 或 同箱跨多备货单 → **对账异常，进人工处置**，不静默采纳（A1–A9 修复延续）。

## 3. 现网检测探查（伪 SQL，换真库名执行）

```sql
-- a) 一个备货单对应多个货柜（违反 1:1）
SELECT order_number, COUNT(DISTINCT container_number) cnt
FROM biz_containers GROUP BY order_number HAVING COUNT(DISTINCT container_number) > 1;

-- b) 一个货柜被多个备货单引用（旧误解"一柜多单"）
SELECT container_number, COUNT(DISTINCT order_number) cnt
FROM biz_replenishment_orders GROUP BY container_number HAVING COUNT(DISTINCT order_number) > 1;

-- c) 主备货单号指向其它票的备货单（疑似任取代表误用）
SELECT b.order_number, b.main_order_number, c.container_number
FROM biz_replenishment_orders b
JOIN biz_containers c ON c.order_number = b.order_number
WHERE b.main_order_number IS NOT NULL AND b.main_order_number <> b.order_number;

-- d) 备货单号缺失/箱号缺失（迟绑定场景除外的时间点对账）
SELECT 'order no null' kind, COUNT(*) FROM biz_containers WHERE order_number IS NULL OR order_number='';
```

## 4. 清洗步骤（受审计，不留手工补丁）

1. **冻结并留存证据**：对命中行做快照（导出受影响 order/container/main_order）。
2. **范围确认**：与业务方确认每类命中是 真实一单多柜(罕见违规)、主备货单号误用、还是历史测试数据。
3. **根因修复**：若为误用 main_order 的显示/联表 → 改查询口径（勿改主备货单号数据去掩盖）。
4. **回归测试**：为每种违规补回归校验（导入校验 + 数据约束）。
5. **版本化脚本重放**：对需修正的数据走 `database/migrations/` + 审计脚本，逐条记录原因与前后值。
6. **对账验证**：清洗后重跑 a–d，计数归零或仅剩已确认的例外（记录在案）。

## 5. 交付物（P2-06 首任务验收）

- 校验/检测查询集（本文件 + 对应迁移脚本）。
- 导入层"备货单号唯一 + 主备货单号禁作键"校验项（进 IMPORT_DOMAIN_MODEL 预检）。
- 清洗审计记录（操作者/原因/前后值）与对账报告。
- 在评审清单 G2（字段级迁移映射）下并列为首个迁移前任务。

## 6. 关联与维护

- 关联 [IMPORT_DOMAIN_MODEL](./IMPORT_DOMAIN_MODEL.md)、[SHIPMENT_FLOW_OVERVIEW](./SHIPMENT_FLOW_OVERVIEW.md)、[GLOSSARY](../GLOSSARY.md) §5、AS-IS 反例 A7/A9。
- 涉及现网数据操作须符合 AGENTS §4/ENGINEERING §4.3；执行需负责人与数据负责确认。
