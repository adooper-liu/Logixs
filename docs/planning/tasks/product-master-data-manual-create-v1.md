---
status: blocked
branch: feat/product-master-data-manual-create-v1
verification: pending。阻塞：等待 workbench-entry-exit-principles-v1 合入；主数据优先停用/归档而非删除（HW-D18）。
---

# 任务：商品与物料主数据手工建档

> 原则依据：`HW-D17`。NPI/产品定义发布交接仍是主路径之一，但存量与纠错须能本岗直接建档。

## 目标

主数据岗可在无上游 NPI 交接时**手工新建 SKU/物料身份**（存量导入单条、纠错建档、非 NPI 渠道），与交接建档共用同一权威模型与校验。

## 边界 / 不做

- 不得伪造「产品定义已发布交接」。
- 本片聚焦建档入口；停用/归档若缺口大可同片最小做或另立（优先归档，慎删）。
- 不重做属性治理与合规规则权威。

## 验收（草案，解锁后细化）

- [ ] 无上游交接时可建档并进入本岗后续补属性/合规动线
- [ ] 与 NPI 交接建档同一身份与校验；来源可追溯
- [ ] 已有引用后删除不可用或明确拒绝；停用/归档路径可说明
- [ ] 相关质量门禁按风险等级通过

## 相关

- 原则：`HW-D17`、`HW-D18`（主数据优先归档）
- 权威：[PRODUCT_ATTRIBUTE_GOVERNANCE](../../product/domain/PRODUCT_ATTRIBUTE_GOVERNANCE.md)
