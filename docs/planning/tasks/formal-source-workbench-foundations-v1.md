---
status: done
branch: feat/formal-source-workbench-foundations-v1
verification: "PR #180 merged to main at 3a046e4d on 2026-10-16; final CI run 38863988836 changes/static/unit/build/e2e/dictionary/quality succeeded and security was skipped by classifier. This task completed the explicitly scoped source contract, tenant-isolated replenishment projection boundary, workbench truth fixes, and active stuffing snapshot read-only consumption. The production source adapter/recoverable job/evidence policy/capability/receipt/retry/checkpoint platform remains explicitly deferred to a separate task and was never part of this task's completion definition."
owner: main
writer: main
risk: high
dependsOn:
  - full-chain-rehearsal-domain-adapter-v1
writeScopes:
  - docs/planning/tasks/formal-source-workbench-foundations-v1.md
  - docs/planning/progress-board.html
  - docs/planning/tasks/full-chain-demo-switch-v1.md
  - .gitignore
  - package.json
  - doc/cross-border-supply-chain/14-roadmap-decisions.md
  - apps/api/src/tools/full-chain-demo/operational-errors.ts
  - apps/api/src/tools/full-chain-demo/postgres-purge.ts
  - apps/api/src/tools/full-chain-demo/postgres-purge.test.ts
  - apps/api/src/tools/full-chain-demo/postgres-purge.integration.test.ts
  - apps/api/src/tools/full-chain-demo/purge-execute.cli.ts
  - apps/api/src/tools/full-chain-demo/purge-execute.cli.test.ts
  - apps/api/src/tools/full-chain-demo/full-chain-demo-switch.cli.ts
  - apps/api/src/tools/full-chain-demo/cargo-ready-unit-repair.cli.ts
  - apps/api/src/tools/full-chain-demo/cargo-ready-unit-repair.cli.test.ts
  - apps/api/src/tools/full-chain-demo/cargo-ready-unit-repair.integration.test.ts
  - apps/api/src/modules/full-chain-sample-landing/application/full-chain-landing-policy.ts
  - apps/api/src/modules/full-chain-sample-landing/application/full-chain-landing-policy.test.ts
  - apps/api/src/modules/full-chain-sample-landing/full-chain-sample-landing.module.ts
  - apps/api/src/modules/full-chain-sample-landing/infrastructure/s3-landing-receipt.store.ts
  - apps/api/src/modules/full-chain-sample-landing/infrastructure/s3-landing-receipt.store.test.ts
  - apps/api/src/modules/full-chain-sample-landing/application/apply-full-chain-package.service.test.ts
  - apps/api/src/modules/full-chain-sample-landing/domain/full-chain-workbench-projector.port.ts
  - apps/api/src/modules/full-chain-sample-landing/infrastructure/full-chain-cargo-ready.projector.ts
  - apps/api/src/modules/full-chain-sample-landing/infrastructure/full-chain-cargo-ready.projector.test.ts
  - apps/api/src/infrastructure/integration/full-chain-cargo-ready-workbench.integration.test.ts
  - packages/full-chain-sample-contracts/index.cjs
  - packages/full-chain-sample-contracts/index.d.ts
  - packages/full-chain-sample-contracts/contracts.test.mjs
  - packages/full-chain-sample-contracts/schemas/stuffing-snapshot-line.schema.json
  - scripts/full-chain-sample/compile-records.mjs
  - scripts/full-chain-sample/compile-records.test.mjs
  - scripts/full-chain-sample/business-data-correction.test.mjs
  - scripts/full-chain-sample/test-support.mjs
  - scripts/full-chain-sample/policies/v0.5.json
  - apps/api/src/infrastructure/integration/full-chain-sample-landing.module.test.ts
  - apps/api/src/modules/full-chain-sample-landing/application/apply-full-chain-package.service.ts
  - apps/api/src/modules/full-chain-sample-landing/domain/landing-graph.ts
  - apps/api/src/modules/full-chain-sample-landing/infrastructure/prisma-full-chain-landing.repository.ts
  - apps/api/src/modules/full-chain-sample-landing/test-support/full-chain-package.fixture.ts
  - apps/api/src/modules/shipment-registry/domain/replace-replenishment-order-lines.ts
  - apps/api/src/modules/shipment-registry/application/replace-replenishment-order-lines.service.ts
  - apps/api/src/modules/shipment-registry/infrastructure/prisma-replace-replenishment-order-lines.repository.ts
  - apps/api/src/modules/shipment-registry/infrastructure/prisma-replace-replenishment-order-lines.repository.integration.test.ts
  - apps/api/src/modules/shipment-registry/index.ts
  - apps/api/src/modules/shipment-registry/shipment-registry.module.ts
  - apps/api/src/modules/shipment-registry/domain/container-page.ts
  - apps/api/src/modules/shipment-registry/domain/container-page.test.ts
  - apps/api/src/modules/shipment-registry/domain/container.repository.ts
  - apps/api/src/modules/shipment-registry/application/list-containers.service.ts
  - apps/api/src/modules/shipment-registry/application/list-containers.service.test.ts
  - apps/api/src/modules/shipment-registry/infrastructure/prisma-container.repository.ts
  - apps/api/src/modules/shipment-registry/domain/container-stuffing-snapshot.ts
  - apps/api/src/modules/shipment-registry/infrastructure/prisma-container-stuffing-snapshot.repository.ts
  - apps/api/src/modules/shipment-registry/infrastructure/prisma-container-stuffing-snapshot.repository.test.ts
  - apps/api/src/modules/shipment-registry/presentation/container-stuffing.dto.ts
  - apps/api/src/modules/shipment-registry/presentation/containers.controller.ts
  - apps/web/src/api/containers.ts
  - apps/web/src/api/containers.test.ts
  - apps/web/src/api/containerStuffing.ts
  - apps/web/src/data/cargoReadyWorkbench.ts
  - apps/web/src/data/cargoReadyWorkbench.test.ts
  - apps/web/src/components/cargo-ready/CargoReadySummary.vue
  - apps/web/src/components/cargo-ready/CargoReadySummary.test.ts
  - apps/web/src/components/cargo-ready/CargoReadyWorkQueue.vue
  - apps/web/src/views/CargoReadyWorkbench.vue
  - apps/web/src/views/CargoReadyWorkbench.test.ts
  - apps/web/src/data/stuffingWorkbench.ts
  - apps/web/src/data/stuffingWorkbench.test.ts
  - apps/web/src/composables/useStuffingWorkbench.ts
  - apps/web/src/composables/useStuffingWorkbench.test.ts
  - apps/web/src/components/stuffing/StuffingWorkQueue.vue
  - apps/web/src/components/stuffing/StuffingSnapshotPanel.vue
  - apps/web/src/components/stuffing/StuffingSnapshotPanel.test.ts
  - apps/web/src/views/StuffingWorkbench.vue
  - apps/web/src/views/StuffingWorkbench.test.ts
  - apps/web/e2e/stuffing-workbench.spec.ts
  - apps/web/e2e/recoverable-work-sessions.spec.ts
  - apps/web/e2e/recoverable-work-sessions.spec.ts-snapshots/**
  - database/schema.prisma
  - database/migrations/**
  - database/dictionary/**
  - scripts/full-chain-demo/ownership-catalog.json
exclusiveLocks:
  - database-schema
  - database-migrations
  - database-dictionary
  - generated:database-catalog
  - public-contract:full-chain-sample-package-v1
sharedIntegrationScopes: []
authorityRefs:
  - AGENTS.md
  - docs/product/UI_SYSTEM.md
  - docs/product/domain/REAL_REPLENISHMENT_SAMPLE_RELATIONSHIPS_20260921.md
  - docs/superpowers/specs/2026-10-13-full-chain-rehearsal-domain-adapter-design.md
uiStructure:
  - 既有备货和装箱工作台保持固定办理壳；本切片只补真实事实和历史只读消费，不建立来源旁路页面
  - 装箱历史事实进入既有队列，选中后只带 containerId，不制造任务
uiMustStayVisible:
  - 备货单的真实缺口、数量和单位
  - 历史装箱的柜号、封号、件重体、来源和只读边界
uiProgressiveDisclosure:
  - SKU 明细与来源摘要按需展开；内部 UUID、hash、landing receipt 不进入业务主界面
uiForbidden:
  - 不在前端推断权限、生命周期、VGM、完成或来源资格
  - 不把测试 fixture、Demo tenant、固定 package 或维护 CLI 写入生产行为
  - 不宣称正式来源持续接入平台已经完成
uiViewportEvidence:
  - 1440x900：三栏结构稳定，队列、事实和只读上下文同屏
  - 1024x768：队列与事实可读，无页面级横向溢出
  - 390x844：历史事实来源、只读边界和明细入口可达，无页面级横向溢出
---

# 任务：正式来源工作台基础能力 V1

## 目标

保留并集成由真实全链样本验真的生产通用基础能力：明确来源数量单位、确定性 landing 事实、租户隔离且可幂等重放的备货行写边界、真实缺口显示，以及既有装箱工作台对任意正式 active snapshot 的历史只读消费。

本任务不宣称完成“未来正式来源持续接入平台”。正式 source adapter、持久化可恢复投影作业、证据采信政策、capability、标准回执、retry/checkpoint 和运行时全链由后续独立生产任务设计与实现。

## 边界 / 不做

- 不保留固定 Demo tenant、package hash、柜号、备货单、supplement 或一次性 purge/switch/repair CLI。
- 不保留未注册到正式运行时、只由测试手工构造的 projector skeleton。
- 真实样本值只允许出现在 fixture/test 中，用于验证通用行为。
- 不修改或提交 `doc/cross-border-supply-chain/wisdom-baseline/市场与经营信号.md` 和其他任务 `.tmp`。
- 不处理 shipment planning、booking、export customs、dispatch 工作台消费者。

## 业务步骤五面映射

| 业务步骤与岗位结果                                   | 岗位任务                       | 数据事实                                             | 技术保障                                                    | 权限边界                                                           | 界面承接                                               | 当前状态                          |
| ---------------------------------------------------- | ------------------------------ | ---------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------ | --------------------------------- |
| 正式来源备货事实进入既有备货工作台                   | 识别订单级缺行与 SKU 身份缺口  | tenant、source batch/row、数量、显式单位、历史版本   | 批次 marker、hash、事务、CAS、supersession、replay          | 正式写入口仍由后续 adapter/capability 承接；repository 强制 tenant | 既有备货队列/详情显示真实缺口，不把空单显示为 0 或齐备 | 基础能力完成；正式入口待后续任务  |
| 任意正式 active stuffing snapshot 可在既有工作台追溯 | 查看柜货事实而不制造可执行任务 | active allocation + 匹配版本 snapshot、来源系统/通道 | tenant scoped 查询、scope-bound cursor、stale snapshot 排除 | 复用 container.read；UI 不推断写权限                               | 既有装箱工作台历史队列与只读详情                       | 基础消费完成；producer 待后续任务 |

## 验收

- [x] 新来源编译缺数量单位时失败关闭；legacy package 可读取但不发明单位
- [x] 备货投影支持 tenant 隔离、精确 replay、漂移拒绝、整批回滚、历史 supersession 和空批次
- [x] 空备货单显示订单级缺口，不显示 0 或已齐备
- [x] active stuffing snapshot 查询绑定 tenant、scope、allocation id/version，并排除 stale snapshot
- [x] 历史装箱 UI 只读，不显示保存、领取、完成或实际时间提交动作
- [x] 真实样本仅作为 fixture 验证 15 行、504、piece/set 和响应式页面
- [ ] 正式来源持续接入平台：明确延期到独立任务，不计入本任务完成

## 验证证据

- package contracts：19/19
- 通用备货投影 PostgreSQL integration：10/10
- repo:check、workbench purposes、contract schema、contract drift：通过
- API/Web/Worker typecheck、lint、build：通过
- Web 全量单测：163 files / 772 tests 通过
- API 全量单测：311/312 files、1613/1614 tests 在并行全仓运行中通过；唯一失败是既有 purge-dry-run 子进程 5 秒超时，隔离重跑 7/7 通过
- fresh staged-diff 复审的两个 Important finding 已修复：已有当前事实时强制 expected-current batch CAS；装箱柜/历史/任务列表完整读取全部 cursor pages
- review fix 本地验证：API typecheck 通过；Web typecheck 与 10 个定向测试通过；新增 CAS PostgreSQL 回归测试因本地 PostgreSQL 未运行，交由 PR CI 执行
- staged 文本逐路径 Prettier、API/Web package format check：通过；根 format:check 被与任务无关的 `apps/ai-service/.pytest_cache` Windows EPERM 阻塞
- 本地 Docker/PostgreSQL 未运行，`data-dictionary:check`、完整 integration/E2E 未本地完成；PR CI 是合并前最终门禁
- 一次性历史装箱数据已精确回退：历史柜 0；保留 3 张订单；26DSC01812 保留 15 行/504、12 piece + 3 set；SKU 绑定 0

## 后续生产任务入口

下一任务必须单独设计：正式来源 adapter + 可恢复投影作业 + evidence policy + capability + receipt/retry/checkpoint。该任务不得在本 brief 中继续追加实现。

## PR / CI / merge 收口（2026-10-16）

- PR #180 已合并到 `main`，merge commit `3a046e4d`。
- 最终 CI run `38863988836` 中 `changes`、`static`、`unit`、`build`、`e2e`、`dictionary`、`quality` 成功；`security` 由路径分类器跳过。
- 本 brief 的 6 项范围内验收均已完成。第 7 项明确是延期到独立任务且不计入本任务完成，因此保持未勾选并不阻止本任务 `done`，也不代表正式来源持续接入平台已经完成。
