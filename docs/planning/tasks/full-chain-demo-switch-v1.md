---
status: coding
branch: feat/full-chain-demo-switch-v1
verification: "2026-10-15：负责人确认本地 demo-real-sample-20260921 先补投影，随后对 fresh review 发现的单位错误选择版本化纠正。final package cf89f2b6fc81…842b 同 run ad20509d… replayed；初始 3 张/24 行均保留历史。additive migration 增加 tenant-scoped source key、订单级 projection marker 与 nullable landing quantity_unit；当前态纠正为 26DSC01812=15 行/504（12 piece+3 set），26DSA01883=0 行（9 条单位未知旧行转历史），26DSC01811=0 行；两个修复 marker 完整。原 ListReplenishmentOrdersService 返回 sku_identity_missing / complete_order_lines，不猜 productSkuId、不冒充备货完成。1440x900、1024x768、390x844 真实页面均显示三张单、正确混合单位、订单级 1 项待补与恢复入口，页面级横向溢出 0。其余五类仍为 landing-only，未虚报工作台接通。"
owner: main
writer: main
risk: high
dependsOn:
  - full-chain-sample-v05-compiler-v1
  - full-chain-demo-backup-purge-dry-run-v1
  - full-chain-rehearsal-domain-adapter-v1
writeScopes:
  - doc/cross-border-supply-chain/14-roadmap-decisions.md
  - docs/planning/tasks/full-chain-demo-switch-v1.md
  - .gitignore
  - apps/api/src/tools/full-chain-demo/postgres-purge.ts
  - apps/api/src/tools/full-chain-demo/postgres-purge.test.ts
  - apps/api/src/tools/full-chain-demo/postgres-purge.integration.test.ts
  - apps/api/src/tools/full-chain-demo/purge-execute.cli.ts
  - apps/api/src/tools/full-chain-demo/purge-execute.cli.test.ts
  - apps/api/src/tools/full-chain-demo/operational-errors.ts
  - apps/api/src/modules/full-chain-sample-landing/application/full-chain-landing-policy.ts
  - apps/api/src/modules/full-chain-sample-landing/application/full-chain-landing-policy.test.ts
  - apps/api/src/modules/full-chain-sample-landing/application/apply-full-chain-package.service.ts
  - apps/api/src/modules/full-chain-sample-landing/application/apply-full-chain-package.service.test.ts
  - apps/api/src/modules/full-chain-sample-landing/full-chain-sample-landing.module.ts
  - apps/api/src/modules/full-chain-sample-landing/infrastructure/s3-landing-receipt.store.ts
  - apps/api/src/modules/full-chain-sample-landing/infrastructure/s3-landing-receipt.store.test.ts
  - apps/api/src/modules/full-chain-sample-landing/infrastructure/prisma-full-chain-landing.repository.ts
  - apps/api/src/tools/full-chain-demo/full-chain-demo-switch.cli.ts
  - apps/api/src/tools/full-chain-demo/cargo-ready-unit-repair.cli.ts
  - apps/api/src/tools/full-chain-demo/cargo-ready-unit-repair.cli.test.ts
  - apps/api/src/tools/full-chain-demo/cargo-ready-unit-repair.integration.test.ts
  - packages/full-chain-sample-contracts/index.cjs
  - packages/full-chain-sample-contracts/index.d.ts
  - packages/full-chain-sample-contracts/schemas/stuffing-snapshot-line.schema.json
  - packages/full-chain-sample-contracts/contracts.test.mjs
  - scripts/full-chain-sample/compile-records.mjs
  - scripts/full-chain-sample/compile-records.test.mjs
  - scripts/full-chain-sample/business-data-correction.test.mjs
  - scripts/full-chain-sample/test-support.mjs
  - scripts/full-chain-sample/policies/v0.5.json
  - apps/api/src/modules/shipment-registry/domain/replace-replenishment-order-lines.ts
  - apps/api/src/modules/shipment-registry/application/replace-replenishment-order-lines.service.ts
  - apps/api/src/modules/shipment-registry/infrastructure/prisma-replace-replenishment-order-lines.repository.ts
  - apps/api/src/modules/shipment-registry/infrastructure/prisma-replace-replenishment-order-lines.repository.integration.test.ts
  - apps/api/src/infrastructure/integration/full-chain-cargo-ready-workbench.integration.test.ts
  - apps/api/src/modules/shipment-registry/index.ts
  - apps/api/src/modules/shipment-registry/shipment-registry.module.ts
  - apps/api/src/modules/full-chain-sample-landing/domain/full-chain-workbench-projector.port.ts
  - apps/api/src/modules/full-chain-sample-landing/domain/landing-graph.ts
  - apps/api/src/modules/full-chain-sample-landing/domain/landing-graph.test.ts
  - apps/api/src/modules/full-chain-sample-landing/test-support/full-chain-package.fixture.ts
  - apps/api/src/modules/full-chain-sample-landing/infrastructure/full-chain-cargo-ready.projector.ts
  - apps/api/src/modules/full-chain-sample-landing/infrastructure/full-chain-cargo-ready.projector.test.ts
  - apps/api/src/infrastructure/integration/full-chain-sample-landing.module.test.ts
  - apps/web/src/components/cargo-ready/CargoReadySummary.vue
  - apps/web/src/components/cargo-ready/CargoReadySummary.test.ts
  - apps/web/src/views/CargoReadyWorkbench.vue
  - apps/web/src/views/CargoReadyWorkbench.test.ts
  - apps/web/src/data/cargoReadyWorkbench.ts
  - apps/web/src/data/cargoReadyWorkbench.test.ts
  - apps/web/src/components/cargo-ready/CargoReadyWorkQueue.vue
  - database/schema.prisma
  - database/migrations/**
  - database/dictionary/**
  - scripts/full-chain-demo/ownership-catalog.json
  - database/seeds/fixtures/replenishment-26dsc01811-01812.json
  - package.json
exclusiveLocks:
  - business-policy:full-chain-demo-switch-v1
  - demo-maintenance:full-chain-v0-5
  - database-schema
  - database-migrations
  - database-dictionary
  - generated:database-catalog
  - public-contract:full-chain-sample-package-v1
  - root-tooling
sharedIntegrationScopes: []
uiStructure:
  - 复用现有备货工作台固定壳：PageHeader → 岗位/交接上下文 → 决策条 → 备货单队列 + 当前备货详情 + 操作上下文；不新增全链样本独立页面或导航
  - 全链样本只通过既有 ReplenishmentOrder 查询投影进入备货队列；当前切片不改变工作台区域顺序、栏位职责或响应式结构
uiMustStayVisible:
  - 全链样本中的备货单号、SKU 编号、数量与单位，以及服务端返回的当前缺口和下一动作
  - SKU 未绑定时明确显示“确认新 SKU / 尚未匹配 SKU 物料”，不得把 landing 发布、装箱关系或样本真实性冒充备货已完成
uiProgressiveDisclosure:
  - 队列先显示为什么需要处理；当前备货详情再显示全部 SKU 行、数量与缺口
  - run、package hash、landing receipt 和内部 UUID 不进入备货主界面；只保留在运维回执和审计证据
uiForbidden:
  - 不新增 `/workspaces/full-chain` 旁路页面，不让 UI 直接读取 full_chain_* 表或 landing chain API 代替既有工作台消费
  - 不从 SKU 文本猜 productSkuId，不伪造供应商采信、备货完成、装箱/VGM、出口放行、loaded 或 departed
  - 不宣称出运计划、订舱、装箱、出口报关、出运五类已接工作台；没有现有可信消费者时明确保持 landing-only
uiViewportEvidence:
  - 1440x900：现有备货三栏壳显示新样本备货单，选中后 SKU 数量和“确认新 SKU”缺口可见，无横向溢出
  - 1024x768：现有窄桌面布局保持队列与详情可读，样本行与缺口不被遮挡
  - 390x844：按现有移动分屏从队列进入详情，能看到备货单号、SKU、数量、缺口与恢复入口，无页面级横向溢出

# authority follows
authorityRefs:
  - AGENTS.md
  - docs/product/UI_SYSTEM.md
  - docs/product/domain/REAL_REPLENISHMENT_SAMPLE_RELATIONSHIPS_20260921.md
  - docs/superpowers/specs/2026-10-06-full-chain-sample-rebuild-design.md
  - docs/planning/tasks/full-chain-demo-backup-purge-dry-run-v1.md
  - docs/planning/tasks/full-chain-rehearsal-domain-adapter-v1.md
---

# 任务：全链样本 Demo 原地切换 V1

## 目标

只清理本地租户 `demo-real-sample-20260921` 的旧 PostgreSQL 业务数据，再由全链样本领域 Adapter 重建演示数据。负责人已明确要求不备份并立即删除；该决定不授权删除 Schema、迁移、全局参考数据、其他租户、Temporal 数据或无归属 MinIO 对象。

## 当前执行切片：既有备货工作台消费

- Demo switch 在 landing publish / published replay 后，把 `cargo_ready_release` 与其 `stuffing_snapshot_line` 中的 SKU 数量，经正式 `ReplaceReplenishmentOrderLinesService` 投影成既有 `ReplenishmentOrder` / 当前行。
- 投影只在已授权的 demo-switch 维护工具组合根启用；普通 rehearsal HTTP 模块仍保持 landing-only，不污染业务工作台。
- 同 run 必须逐行精确 replay；部分行、内容漂移或目标 `Decimal(18,3)` 越界时失败关闭，不能把不完整投影当成成功。
- 既有 `GET /api/replenishment-orders` 与 `/workspaces/cargo-ready` 必须自然读到样本备货单、SKU、数量和服务端缺口；SKU identity 不猜测，保持 `sku_identity_missing`。
- 出运计划、订舱、装箱、出口报关与出运五类仍只保存 landing 事实；当前缺少不造假的既有工作台写入契约，不在本片冒充接通。

## 明确不做

- 不使用 `migrate reset`、`db push --force-reset`、裸 SQL 文件或 legacy demo seed。
- 不删除 MinIO 孤儿对象，不修改 Temporal。
- 不重新证明全链样本真实性。
- 本切片删除完成不等于全链样本重建或页面验收完成。

## 负责人决定

2026-10-14：只清目标租户；保留原租户标识；不备份；立即删除；建立完整旧库清理脚本。数据不可恢复风险由负责人本次明确接受。

## 复审处置

```yaml
protocol: logix-disposition/v1
slice: full-chain-demo-switch-v1
decisions:
  - finding: FCDS-REV-001
    status: accepted
    reason: 旧路线图禁令与本次负责人明确授权冲突；已写回本地 Demo 精确租户、不备份风险接受、非生产授权边界。
    writeback: doc/cross-border-supply-chain/14-roadmap-decisions.md
  - finding: FCDS-REV-002
    status: accepted
    reason: demo_switch 不得通过普通 HTTP 模块环境变量开启；正式模块已恢复 rehearsal-only，专用 CLI 独立组合切换 policy。
    writeback: apps/api/src/modules/full-chain-sample-landing/full-chain-sample-landing.module.ts
  - finding: FCDS-REV-003
    status: accepted
    reason: typed dangling=0 不能证明四条必需边齐全；已补第一柜 A/B 出运关系并实际核对 A/B/C/D 4/4。
    writeback: 本 brief 执行证据
  - finding: FCDS-REV-004
    status: accepted
    reason: 已补 package/run/publish/replay/manifest/HBL/Receipt 绑定证据和验收清单。
    writeback: 本 brief
  - finding: FCDS-REV-101
    status: accepted
    reason: ReplenishmentOrderLine 来源键改为 tenant-scoped；真实 PostgreSQL 证明同 batch/row 可跨租户共存。
    writeback: database/migrations/20261015120000_harden_replenishment_projection_batches/migration.sql
  - finding: FCDS-REV-102
    status: accepted
    reason: 新增订单级 projection batch marker；空批次、历史批次与 pre-marker 精确 replay 均可验证且旧 replay 不回滚新行。
    writeback: apps/api/src/modules/shipment-registry/infrastructure/prisma-replace-replenishment-order-lines.repository.ts
  - finding: FCDS-REV-103
    status: accepted
    reason: 禁止默认 piece；新 compiler 必须显式产生 piece/set，旧包缺单位可读取但 projector 在首写前失败关闭；已按负责人决定版本化纠正现有 Demo。
    writeback: packages/full-chain-sample-contracts/schemas/stuffing-snapshot-line.schema.json
  - finding: FCDS-REV-104
    status: accepted
    reason: 实际 task paths 与 schema/contract locks 已回写；未归属市场基线保持排除，不暂存、不回退。
    writeback: 本 brief frontmatter
  - finding: FCDS-REV-105
    status: accepted
    reason: 空备货单队列与顶部统一显示 1 项订单级缺口，不再显示 0。
    writeback: apps/web/src/data/cargoReadyWorkbench.ts
  - finding: FCDS-REV-106
    status: accepted
    reason: 独立页面专用 planNumbers/list API 与测试残留已移除，API typecheck 与 route audit 通过。
    writeback: apps/api/src/modules/full-chain-sample-landing
  - finding: FCDS-REV-201
    status: accepted
    reason: markerless 空批次遇到当前行默认拒绝；只有显式 expected current batch 在同事务复核通过才允许主动撤回。
    writeback: apps/api/src/modules/shipment-registry/infrastructure/prisma-replace-replenishment-order-lines.repository.ts
  - finding: FCDS-REV-202
    status: accepted
    reason: projection hash 对 decimal 字符串做无损语义规范化；12.00/12.000 与数据库 12 可精确回填 pre-marker。
    writeback: apps/api/src/modules/shipment-registry/infrastructure/prisma-replace-replenishment-order-lines.repository.ts
  - finding: FCDS-REV-203
    status: accepted
    reason: 单位修复只接受精确坏 run 全字段集合或精确 repair batch 已完成态；同 SKU 的新批次/数量/单位漂移在首写前拒绝。
    writeback: apps/api/src/tools/full-chain-demo/cargo-ready-unit-repair.cli.ts
  - finding: FCDS-REV-204
    status: accepted
    reason: 两张备货单通过 executeBatch 在一个数据库事务中切换；任一版本冲突整批回滚。
    writeback: apps/api/src/modules/shipment-registry/application/replace-replenishment-order-lines.service.ts
  - finding: FCDS-REV-205
    status: accepted
    reason: 空单详情头、固定上下文和队列统一显示 1 项待补，不再出现 0 个需处理。
    writeback: apps/web/src/components/cargo-ready/CargoReadySummary.vue
  - finding: FCDS-SEC-001
    status: accepted
    reason: 显式 DELETE RETURNING 无法观察跨租户 cascade；已在首个 DELETE 前遍历 tenant-bearing FK 并拒绝父子 tenant 不一致，真实临时 PostgreSQL RED→GREEN。
    writeback: apps/api/src/tools/full-chain-demo/postgres-purge.ts
next: review
```

## 执行证据

| 证据         | 结果                                                                                                                                                                             |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 旧 Demo 清理 | manifest `4c574e7fe2b6…`，精确删除 140 行；删除后 PostgreSQL candidate `0`                                                                                                       |
| 中间版本替换 | run `6f7b3f6d-0b83-41ae-a280-8e93c68f2902` 的 98 行先列明范围并获当次授权后删除                                                                                                  |
| 最终 package | hash `cf89f2b6fc81c0154371b6c63eff1fc407551eb5b654eff3ce579b272429842b`；37 records / 11 gaps / 75 checks；`publishable=true`                                                    |
| 最终 run     | `ad20509d-955f-4b97-9ecb-a34b52f24ed0`，首次 `published`，同 package 再次执行 `replayed`                                                                                         |
| 六类事实     | shipment plan 2、booking 2、cargo-ready 3、stuffing 24、export customs 3、dispatch 3                                                                                             |
| 关系与回执   | booking documents 7、dispatch-HBL links 5、record receipts 37、Outbox 1、Landing Receipt 存在                                                                                    |
| HBL 完整性   | 权威四条 container-HBL 边 4/4；重复或缺失 0；stuffing/customs/dispatch dangling 均 0                                                                                             |
| 旧数据       | `ReplenishmentOrder=0`、`MarketSignal=0`、`ImportBatch=0`                                                                                                                        |
| 既有备货消费 | final package 同 run `ad20509d-955f-4b97-9ecb-a34b52f24ed0` replay；单位纠正后 3 张单保留，当前 15 行 / 504 件为 12 `piece` + 3 `set`；美国补充柜 9 条单位未知行转历史并显示待补 |
| 页面验收     | `/workspaces/cargo-ready` 在 1440x900、1024x768、390x844 均显示三张单、正确混合单位、订单级 1 项待补与恢复入口；三个视口页面级横向溢出均为 0；仅见与本任务无关的 favicon 404     |
| 未接工作台   | shipment planning / booking / stuffing / export customs / dispatch 保持 landing-only；不以 landing API 或独立页面冒充既有工作台消费                                              |
| 外域         | Temporal 未修改；旧无归属 `MINIO_ORPHAN_OBJECT` 未猜测、未删除                                                                                                                   |

## 验收

- [x] fail-before-client 参数与租户边界测试通过
- [x] PostgreSQL child-first、hash/count、事务回滚测试通过
- [x] tenant-bearing FK 跨租户关系在首个 DELETE 前失败关闭
- [x] 真实临时 PostgreSQL 证明目标租户归零、其他租户与全局参考不变
- [x] 当次目标数据库执行回执记录实际删除数量
- [x] 删除后 manifest 的 PostgreSQL candidateCount 为 0
- [x] 正式 Adapter 完成 publish 与同 package replay
- [x] 四条必需 HBL 边、typed dangling、六类事实、回执、Outbox 与 MinIO Receipt 完成核对
- [x] canonical 备货事实经正式 shipment-registry 写边界投影，并由既有 `ListReplenishmentOrdersService` 真实读取
- [x] 同 run 精确 replay、部分/漂移/重复行拒绝、新批次 supersede、pre-marker 回填、旧空 replay 不回滚、失败回滚与空备货单真实 PostgreSQL 验证通过
- [x] 同 source batch/row 可跨租户共存，来源唯一键不再产生跨租户耦合
- [x] 新 compiler 缺 quantity unit 失败关闭；旧无单位 package 可读取但不得投影；现有错误行已版本化纠正且历史保留
- [x] 目标 Demo 租户完成同 package replay 与版本化单位纠正；3 张单保留，当前 15 行 / 504 件为 12 `piece` + 3 `set`，未知单位旧行保留历史
- [x] `/workspaces/cargo-ready` 1440x900、1024x768、390x844 真实页面验收完成；缺口、恢复入口可见且无页面级横向溢出
- [ ] 其余五类没有可信既有工作台消费者，保持 landing-only；不得计入既有工作台接通
