---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/shipment-cargo-allocation
verification:
  - "2026-09-20 定向测试 9 文件/33 项、API lint/typecheck 与 Prisma schema validate 通过。"
  - "2026-09-20 pnpm db:verify:shipment-cargo-allocation 通过：旧库升级不猜测 SKU；空库完整迁移验证 SKU 绑定、一柜多备货单、产品行拆柜、版本更正、超分配拒绝和跨租户约束。"
  - "2026-09-20 pnpm validate 通过：仓库政策、契约校验/漂移、Prisma 生成、lint、格式、类型、全量测试（API 145 文件/683 项、Web 59 文件/189 项、Worker 5 项）、Playwright E2E（50 通过/7 条件跳过）与生产构建全部完成。"
---

# 任务：备货单行 SKU 引用与货柜装载事实

> 路线条目：[`DOMAIN_VERTICAL_DELIVERY_PLAN`](../DOMAIN_VERTICAL_DELIVERY_PLAN.md) `1.2`。

## 目标

让备货单产品行稳定引用 `master-data` 的 Product/SKU 身份，并在 `shipment-registry` 版本化保存“哪条产品行、多少数量实际装入哪个货柜”，为结构化合规档案和装箱/出运门禁提供可靠装载事实。

## 边界 / 不做

- Product/SKU 身份仍归 `master-data`；Shipment Registry 只保存逻辑 UUID 引用与本次交易快照，不建立跨模块数据库外键。
- 现有历史产品行不猜测回填 SKU；必须通过 Master Data 公开查询 Port 校验同租户、同商品号后绑定。
- 当前导入不在事务外自动创建 SKU。后续导入编排固定为“解析/审核 SKU -> 绑定产品行 -> 原子写装载快照”，未解析行保持显式未绑定。
- 不实现 SKU 属性、证书、合规决定、HTTP/UI、包装层级或箱唛托盘明细。
- 不移除现有 `ContainerRecord.replenishmentOrderId` 兼容锚；多备货单装一柜以装载分配为权威关系。

## 验收

- [x] 产品行保存 `tenantId + productSkuId? + version`；旧数据按所属备货单回填租户，不猜测 SKU。
- [x] SKU 绑定通过 `GET_PRODUCT_SKU` 公共 Port 校验租户和商品号；同值重放幂等，异值或版本冲突明确失败。
- [x] 装载集合按货柜版本化，旧版本保留；同租户幂等键同载荷重放，异载荷冲突。
- [x] 装载明细支持一柜多备货单、一产品行拆入多柜，并拒绝未绑定 SKU、单位不一致、非正数量和跨柜超分配。
- [x] Repository 使用行锁和一个事务完成版本检查、总量检查、旧集合失效及新集合写入。
- [x] 数据库约束覆盖租户内父子引用、正数量、活动集合唯一、版本和幂等唯一性；跨模块 Product/SKU 不建外键。
- [x] 迁移验证覆盖旧库升级、空库完整迁移、历史行租户回填、活动集合唯一和跨租户约束。
- [x] 高风险门禁通过：专项测试、迁移验证与 `pnpm validate`。

## 方案

1. 扩展 `ReplenishmentOrderLine`，增加直接租户、可空 Product/SKU 逻辑引用和乐观版本。
2. Master Data 增加只读 `GET_PRODUCT_SKU` Port；Shipment Registry 通过该 Port 执行一次性 SKU 绑定。
3. 新增 `ContainerCargoAllocationSet` 和 `ContainerCargoAllocation`，每柜仅一个活动集合；更正追加新版本并关联旧集合。
4. Application 统一校验 UUID、十进制定点数量、单位、证据、来源、版本和幂等载荷。
5. Prisma Repository 锁定货柜与产品行，汇总其他活动集合用量，拒绝超分配后原子替换当前集合。

## Review notes

- Product/SKU 仅通过 Master Data 公开查询 Port 校验，Shipment Registry 不跨模块查询表或建立数据库外键。
- 装载集合采用同柜版本链、单一 active、租户级幂等和产品行锁；更正不会覆盖历史，跨柜累计数量在同一事务内核验。
- 旧 `ContainerRecord.orderNumber/replenishmentOrderId` 保留为导入兼容锚；箱货关系已统一由装载分配表达，并同步修正现行领域文档。
- 本刀不暴露 HTTP/UI，也不让现有导入在事务外创建 SKU；路线 `1.3` 继续建立结构化合规档案。

## 进度 log

| 日期       | 阶段   | 负责  | commit | 说明                                           |
| ---------- | ------ | ----- | ------ | ---------------------------------------------- |
| 2026-09-20 | coding | Codex | —      | 开始 SKU 引用与版本化实际装载事实第一刀。      |
| 2026-09-20 | done   | Codex | —      | SKU 绑定、装载分配、迁移验证和高风险门禁完成。 |
