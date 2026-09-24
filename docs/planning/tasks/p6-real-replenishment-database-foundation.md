---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/real-replenishment-database-foundation
verification:
  - "2026-09-22 pnpm db:verify:real-replenishment 通过：旧库升级、空库迁移、相关列类型/精度/可空性、金额币种 CHECK、租户复合外键、箱号查询索引、完整 seed 两次幂等、15 SKU/15 产品行/15 分配与 504 件真实汇总、一柜多单和明细拆柜合成关系。"
  - "2026-09-22 pnpm db:verify:shipment-cargo-allocation 通过：SKU 绑定、装载版本、同柜多单、明细拆柜、跨柜超分配拒绝及跨租户约束。"
  - "2026-09-22 pnpm validate 通过：仓库政策、契约校验/漂移、Prisma 生成、lint、格式、类型、全量测试（API 196 文件/932 项、Web 93 文件/273 项、Worker 5 项）、Playwright E2E（77 通过/7 条件跳过）与生产构建。"
  - "2026-09-22 评审修复后 pnpm db:verify:real-replenishment 通过：批次货柜绑定、旧 seed 身份原位升级、确定性 UUID/证据引用、指定 SQLSTATE/约束拒绝、空库与旧库升级、重复 seed 及 504 件对账。"
  - "2026-09-22 评审修复后 pnpm db:verify:shipment-cargo-allocation 通过；定向 API 测试 4 文件/51 项通过。"
  - "2026-09-22 评审修复后 pnpm validate 再次通过：仓库、契约、Prisma、lint、format、typecheck、API/Web/Worker 全量测试、Playwright 77 通过/7 条件跳过及全部生产构建。"
---

# 任务：真实备货样本数据库基础

## 目标

以 44 份真实文件形成的字段目录、关系结论和 demo fixture 为证据，补齐已经正式定稿的备货产品明细物理字段、租户内引用约束和可重复开发种子数据。样本必须能在真实 PostgreSQL 中落为 SKU、备货单产品行和箱货装载关系，并保持来源快照、粒度和已知差异，不把单样本观察晋升为未批准业务规则。

## 权威与影响范围

- `TARGET_FIELD_CATALOG.md` V1.1 是产品明细运行时字段的正式权威；`CONTEXT_MAP.md` 与 `DATA_MODEL_P2-06.md` 确定 `ProductSku -> ReplenishmentOrderLine -> ContainerCargoAllocation` 关系和模块所有权。
- `CROSS_MODULE_REFERENCE_CONTRACT_V1.md` 要求所有引用携带或校验 `tenantId`；数据库必须阻止货柜跨租户引用备货单。
- `REAL_REPLENISHMENT_SAMPLE_FIELD_CATALOG_20260921.md`、`REAL_REPLENISHMENT_SAMPLE_RELATIONSHIPS_20260921.md` 和 fixture 仅作为真实证据与验收数据，不是公共契约。
- 影响 `shipment-registry` 的 Prisma schema、追加迁移、本地 seed、数据库专项验证和相关文档；不改变公共 API、生命周期状态机或生产数据。
- 这是数据库高风险切片，完成前必须验证空库升级、旧版本升级、约束、幂等 seed、样本对账和根级 `pnpm validate`。

## 边界 / 不做

- 不提前落地仍为候选的 `ShipmentPlan`、`Booking`、B/L、报关票和报关明细生产表；订舱、总/分提单及报关原值继续保存在 fixture/来源快照，待对应领域契约批准后升格。
- 不把报关 FOB 单价误写为备货 FOB 或议付 FOB；金额语义不一致时保持目标字段为空。
- 不把样本内备货单到货柜的 1:1、分提单到报关票的 1:1 或名称相同关系建成通用唯一约束。
- 不从上游“已出运”文本、日期相等或装箱文件存在推导生命周期事件；seed 不推进节点、不生成实际时间事实。
- 不修改已共享迁移，不写生产数据，不删除或覆盖现有开发 seed。

## 验收

- [x] `replenishment_order_line` 承载 V1.1 已定的带电、冷媒、植检、商检及三组金额/币种可选快照；金额和币种必须成对，币种为 ISO 4217 形式，金额使用定点十进制。
- [x] `container_record` 只能引用同租户 `replenishment_order`；旧数据升级前显式验证，跨租户引用由数据库拒绝。
- [x] 一柜多备货单与一明细拆多柜只由版本化装载分配表达；同批次同箱号经批次解析绑定复用货柜且不覆盖旧兼容锚，跨批次同箱号要求明确解析稳定货柜实例，任何单值兼容字段均不得限制 N:M。
- [x] `pnpm db:seed` 幂等写入真实 demo tenant：2 张备货单、2 个货柜、15 个 SKU、15 条产品行、1 个装载版本和 15 条装载分配。
- [x] 真实样本保持 `26DSC01812 -> HMMU4956442` 的 504 件装载汇总；15 条产品行均绑定稳定 SKU，商检值按来源落账，未证明字段保持 `null`。
- [x] 原始 15 行快照和早期/后期重量体积差异继续保留在版本化 fixture/验证报告，不被 seed 静默改写。
- [x] 空库迁移、旧库升级、约束拒绝、重复 seed、Prisma 校验、专项数据库验证和 `pnpm validate` 全部通过。

## 业务与数据协同设计

| 业务岗位要完成什么                       | 操作时需要看到什么                                        | 系统允许做什么                                                          | 数据如何可靠保存与反馈                                              |
| ---------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 后续备货/合规开发核对真实 SKU 与装载范围 | SKU、出运数量与单位、受控合规属性、来源行、目标货柜和版本 | 读取 demo tenant；后续经正式导入/装载 Port 写入，不以 seed 代替业务命令 | 产品行保留来源批次/行，SKU 使用稳定身份，装载集合版本化且租户隔离   |
| 数据与契约开发确认字段能否升格           | 正式字段、候选字段、来源原值及冲突                        | 只把正式 V1.1 字段写入强类型列；其余读取快照                            | 金额/币种成对约束，未知值为 `null`，原始 JSON 不覆盖权威事实        |
| 测试人员复现两柜真实关系                 | 2 单、2 柜、15 SKU、504 件汇总和已知重量体积差异          | 重复执行 seed、查询关系、触发非法租户/金额约束                          | 固定 demo tenant、确定性 UUID、事务 upsert 和专项验证提供可重复反馈 |

本切片不交付 UI。直接消费者是后续备货导入、SKU 合规、装箱/装载和数据查询切片；界面仍只消费公开 Port/DTO，不直接读取新列。

## 方案

1. 为 `ReplenishmentOrderLine` 追加正式 V1.1 可选属性与金额快照列；数据库 CHECK 强制金额/币种成对和 ISO 4217 形状，不对尚未获权威规则确认的金额正负擅加约束。
2. 将 `ContainerRecord.replenishmentOrder` 改为 `(replenishment_order_id, tenant_id)` 复合外键；迁移先检查历史跨租户脏引用再替换旧外键，并为 `(tenant_id, container_number)` 冲突查询建立非唯一索引。追加 `container_import_binding`，以 `(tenant_id, source_batch_id, container_number)` 唯一绑定同批次解析结果；箱号本身仍不唯一。
3. 新增结构化 TypeScript seed 模块读取现有 JSON fixture，使用确定性 UUID 和 Prisma upsert 创建 SKU、产品行绑定及装载分配；保留现有三柜基础 seed。
4. 新增专项验证脚本，覆盖旧库升级、空库链、列/约束/FK、真实 seed 幂等和样本数量对账；登记稳定 npm 命令。
5. 更新样本文档的“当前承载”与 demo 使用说明，明确候选对象和未落字段。

## Review notes（review 阶段填写，只读不改代码）

- [P1] 箱号跨运输实例可复用，旧写入器却只按 `(tenantId, containerNumber)` 解析，存在历史串柜和并发重复建柜风险。
- [P1] 真实 seed 的货柜/产品行 ID 与 `evidenceRefs` 不符合正式装载 Port 的 UUID 契约，无法用于后续真实命令开发。
- [P1] 一柜多单后，第二单携带的冲突时间事实会静默替换当前事实，未进入对账。
- [P2] 专项数据库验证把任意异常视为目标约束拒绝，存在假阳性。

## 进度 log（谁改谁 append，一行一条）

| 日期       | 阶段   | 负责  | commit | 说明                                                                                               |
| ---------- | ------ | ----- | ------ | -------------------------------------------------------------------------------------------------- |
| 2026-09-22 | design | Codex | —      | 完成权威、样本、Prisma、迁移和现有 seed 对照；冻结为正式产品行字段、租户 FK 与真实装载 seed 第一刀 |
| 2026-09-22 | coding | Codex | —      | 开始追加迁移、结构化 seed 和数据库专项验证                                                         |
| 2026-09-22 | coding | Codex | —      | 按业务澄清锁定一柜多备货单；增加旧导入复用同箱号且不覆盖兼容锚的回归验收                           |
| 2026-09-22 | done   | Codex | —      | 迁移、真实 seed、N:M 导入修正、专项数据库验证及完整质量门禁通过                                    |
| 2026-09-22 | fix    | Codex | —      | 根据数据库评审修复货柜解析并发、真实 seed UUID/证据契约、共享柜时间事实冲突及约束验证假阳性        |
| 2026-09-22 | done   | Codex | —      | 评审修复完成；专项数据库验证、定向 API 回归与完整质量门禁再次通过                                  |
