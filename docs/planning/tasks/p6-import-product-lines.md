---
status: done
branch:
verification: scripts/verify-import-product-lines.mts + pnpm validate (2026-09-16)
---

# 任务：导入备货单产品明细闭环

## 目标

把已确认的“同一备货单多产品行”规则落到运行时：人工审核后的有效映射驱动预检和执行，按备货单聚合表头并在单个事务中写入货柜、备货单及全部产品明细，每个来源行保留对账结果。

## 边界 / 不做

- 权威业务规则见 `../../product/domain/TARGET_FIELD_CATALOG.md` §0.5、`../../product/domain/IMPORT_DOMAIN_MODEL.md` 和 `../../product/domain/PRECHECK_RULES.md`。
- 本切片只实现 `orderNumber`、`containerNumber`、`productNumber`、`shippedQuantity`、`quantityUnit`、`contractNumber`；不补造港口、航次、清关、卸柜、重量或状态事件。
- 迁移采用 expand：保留历史货柜结构，新增备货单与版本化产品明细落点；旧数据清洗和 1:1 contract 约束另行实施。
- 不猜测数量单位，不从包装数反推产品数量，不用来源状态直接推进生命周期。

## 验收

- [x] 人工修正后的映射是预检和执行的唯一输入。
- [x] 同备货单多产品行合法；缺产品、非正数量、缺/非法单位、表头冲突和相同业务明细重复均有稳定 blocker。
- [x] 同一备货单的货柜、表头和全部产品明细事务同成同败，跨租户不会互相命中。
- [x] 每个来源行关联同一个货柜并保留独立对账结果。
- [x] 前端可修正字段映射并显式选择数量单位。
- [x] 追加迁移通过空库/现有库验证，受影响测试、契约检查和 `pnpm validate` 全绿。

## 方案

1. 在共享契约目录建立导入字段与数量单位目录，并生成 Python AI 映射规则。
2. 扩展 Prisma 模型和追加迁移，建立备货单、可审计的当前/历史产品明细及租户范围约束。
3. 让导入仓储读回审核记录和显式单位，按有效映射执行聚合预检。
4. 在 shipment-registry 增加备货单聚合事务写端口，导入用例按单写入并逐行对账。
5. 拆出 Vue 映射编辑器并补充前后端回归测试。

## Review notes

（review 阶段填写）

## 进度 log

| 日期       | 阶段   | 负责  | commit | 说明                             |
| ---------- | ------ | ----- | ------ | -------------------------------- |
| 2026-09-16 | coding | Codex | —      | 开始实现产品明细纵向运行时切片。 |
| 2026-09-16 | review | Codex | —      | 完成差异、迁移、契约与风险审查。 |
| 2026-09-16 | done   | Codex | —      | 全仓门禁与真实数据库验证通过。   |
