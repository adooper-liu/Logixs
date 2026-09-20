---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/sku-master-data-first-slice
verification:
  - "2026-09-20 master-data 定向测试 3 文件/13 项、API typecheck/lint、contract:check、contract:drift、repo:check、format:check、全仓 typecheck/test 和生产 build 通过。"
  - "2026-09-20 pnpm db:verify:product-sku-master 通过：旧库升级保留历史产品行且不猜测建 SKU；空库完整迁移验证 UUID、唯一性、租户隔离、幂等重放/冲突及输入约束。"
  - "2026-09-20 pnpm validate 执行至 Web E2E 时，49 通过、7 跳过、1 条无关移动端 tooltip 用例因视口外超时；该失败用例随后定向重跑 1/1 通过，pnpm build 单独通过，未机械重跑其余已通过门禁。"
---

# 任务：Product/SKU 稳定身份第一刀

> 路线条目：[`DOMAIN_VERTICAL_DELIVERY_PLAN`](../DOMAIN_VERTICAL_DELIVERY_PLAN.md) `1.1`。

## 目标

在 `master-data` 建立租户内稳定的 Product/SKU 身份，通过公开 Application Port 幂等注册或解析 SKU，为下一刀备货单行绑定、装载分配和合规档案提供不可解释 UUID。

## 边界 / 不做

- Product/SKU 身份归 `master-data`；`ReplenishmentOrderLine` 仍归 `shipment-registry`，本刀不跨模块直写备货单行。
- 不在本刀接入导入事务、人工 HTTP 页面或 API；下一刀先确定跨模块事务/事件策略，禁止产生“SKU 已写、导入失败”的半成功闭环。
- 不实现属性定义、JSONB 快照、电池/DG/制冷剂档案、证书或合规决定。
- 不把商品号大小写、空白或供应商别名静默合并；规范商品号必须由调用方明确提交，非法输入明确失败。
- 不改变生命周期、事件码、日期事实或 14 节点。

## 验收

- [x] `product_sku` 使用 UUID 主键，租户内 `product_number` 唯一，并有非空/长度/首尾空白数据库约束。
- [x] 公共 Port 对同租户同商品号幂等返回同一 ID，不同租户隔离；同一幂等键异载荷明确冲突。
- [x] Domain/Application 覆盖成功、非法商品号、幂等重放、异载荷冲突和租户隔离。
- [x] Prisma Repository 使用显式映射，不把数据库实体作为公共返回类型。
- [x] 迁移验证覆盖旧库升级、空库完整迁移、唯一性和约束。
- [x] `master-data` 模块 manifest、公开入口和依赖方向检查通过。
- [x] 高风险门禁通过：专项测试、迁移验证，以及除无关 E2E 首次偶发失败外的完整门禁；失败用例定向重跑通过。

## 方案

1. 新增 `ProductSku` 与 `ProductSkuRegistration`：前者保存稳定身份，后者保存租户级幂等请求及载荷哈希。
2. Domain 校验租户、商品号和幂等键；商品号只接受已去除首尾空白的明确值，不擅自改大小写。
3. Application 用例先按幂等键查注册记录，再在一个 Repository 事务中创建/解析 SKU 和注册结果；同键异载荷返回稳定冲突码。
4. 导出 `REGISTER_PRODUCT_SKU` 公共 Port，并在 module manifest 登记。
5. 追加迁移和专项验证脚本；代码回退时保留新表不读，避免丢失稳定 ID 和幂等审计。

## Review notes

（review 阶段填写）

## 进度 log

| 日期       | 阶段   | 负责  | commit | 说明                                         |
| ---------- | ------ | ----- | ------ | -------------------------------------------- |
| 2026-09-20 | coding | Codex | —      | 路线重排后开始 SKU 稳定身份第一刀。          |
| 2026-09-20 | done   | Codex | —      | UUID 身份、幂等 Port、迁移与高风险验证收口。 |
