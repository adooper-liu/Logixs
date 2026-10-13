---
status: design
branch: feat/full-chain-rehearsal-domain-adapter
verification: "not-run（设计阶段；尚未实施或执行 rehearsal）"
owner: main
writer: main
risk: high
dependsOn:
  - full-chain-sample-v05-compiler-v1
  - full-chain-demo-backup-purge-dry-run-v1
writeScopes:
  - docs/planning/tasks/full-chain-rehearsal-domain-adapter-v1.md
  - docs/superpowers/specs/2026-10-13-full-chain-rehearsal-domain-adapter-design.md
  - docs/superpowers/plans/2026-10-13-full-chain-rehearsal-domain-adapter.md
  - docs/planning/progress-board.html
  - packages/full-chain-sample-contracts/**
  - scripts/full-chain-sample/canonical-json.mjs
  - scripts/full-chain-sample/contracts.mjs
  - scripts/full-chain-sample/contracts.test.mjs
  - scripts/full-chain-sample/schemas/**
  - apps/api/package.json
  - apps/api/src/app.module.ts
  - apps/api/src/modules/full-chain-sample-landing/**
  - apps/api/src/infrastructure/integration/full-chain-rehearsal-domain-adapter.integration.test.ts
  - database/schema.prisma
  - database/migrations/**
  - database/dictionary/**
  - scripts/full-chain-demo/ownership-catalog.json
  - scripts/full-chain-demo/ownership-catalog.test.mjs
  - scripts/generate-data-dictionary.mjs
  - scripts/generate-data-dictionary.test.mjs
  - package.json
  - pnpm-lock.yaml
exclusiveLocks:
  - database-schema
  - database-migrations
  - database-dictionary
  - generated:database-catalog
  - demo-ownership-catalog
  - public-contract:full-chain-sample-package-v1
  - public-contract:full-chain-rehearsal-receipt-v1
  - rehearsal-adapter:full-chain-v0-5
  - demo-rehearsal:full-chain-v0-5
  - root-tooling
  - progress-board
sharedIntegrationScopes:
  - docs/planning/progress-board.html
  - apps/api/package.json
  - database/schema.prisma
  - database/migrations/**
  - database/dictionary/**
  - scripts/full-chain-demo/ownership-catalog.json
  - package.json
  - pnpm-lock.yaml
authorityRefs:
  - AGENTS.md
  - ENGINEERING_RULES.md
  - docs/superpowers/specs/2026-10-06-full-chain-sample-rebuild-design.md
  - docs/planning/tasks/full-chain-sample-v05-compiler-v1.md
  - docs/planning/tasks/full-chain-demo-backup-purge-dry-run-v1.md
  - docs/product/domain/REAL_REPLENISHMENT_SAMPLE_RELATIONSHIPS_20260921.md
  - doc/cross-border-supply-chain/wisdom-baseline/README.md
  - doc/cross-border-supply-chain/wisdom-baseline/全局.md
  - doc/cross-border-supply-chain/wisdom-baseline/出运计划.md
  - doc/cross-border-supply-chain/wisdom-baseline/备货.md
  - doc/cross-border-supply-chain/wisdom-baseline/订舱.md
  - doc/cross-border-supply-chain/wisdom-baseline/装箱.md
  - doc/cross-border-supply-chain/wisdom-baseline/出口报关.md
  - doc/cross-border-supply-chain/wisdom-baseline/出运.md
---

# 任务：全链样本隔离租户领域 Adapter V1

> 本 brief 是父设计 Brief 3 的唯一活动交付载体。业务和安全边界引用父设计、负责人确认的样本关系权威和本任务书面设计；实现步骤只引用后续唯一实施计划。不建立第二套需求、adapter 平台或 handoff 文档。

## 目标

在独立 rehearsal tenant 与独立 MinIO prefix 内，消费 `publishable=true` 且版本/hash 一致的六类 canonical package，通过 Application/Domain 边界按依赖顺序幂等落账，保持六类业务身份、typed HBL/MBL、外键、FC-D07 聚合身份、lineage 和 unsupported gaps，并证明 replay、并发、回滚、Outbox/object 对账及跨租户零变化。

本片只形成可供 Brief 4/页面验收消费的全链事实与脱敏回执，不推断业务生命周期完成，也不完成生产工作台闭环。

## 边界 / 不做

- 不重新询问或重新证明负责人已确认的业务数据真实性。
- 不修改 FC-D07 / FC-D08、compiler fail-closed checks 或 stuffing business key。
- 不读取 Excel，不建立 Excel → database 路径。
- 不建设万能 importer、万能 adapter 平台或通用 JSON ledger。
- 不把来源状态推断成备货已采信、装箱/VGM 完成、出口放行、loaded 或 departed。
- 不把现有目的国/进口 `CustomsClearanceCase` 冒充出口报关案件。
- 不调用 `db:seed:legacy-demo`，不写旧 demo、其他 tenant 或全局参考数据。
- 不运行 purge、真实 demo backup/restore、Temporal mutation 或 Brief 4 页面切换。
- 不修改 `apps/web/**`，不宣称任一工作台达到 WB-B01～WB-B10 或业务闭环。
- 不读取、清理、暂存或提交 `.tmp/`、`apps/api/.tmp/`。

## 唯一业务步骤

> 将一份严格有效的六类 package 在独立 rehearsal tenant 中原子落成一条可查询、可重放、可对账且不制造生命周期结论的全链事实。

## 已定数据与安全政策

| 决策   | 结论                                                                                        | 权威                            |
| ------ | ------------------------------------------------------------------------------------------- | ------------------------------- |
| B3-D01 | workbook 的真实业务数据身份已由负责人确认；本片不再认证真实性                               | `AGENTS.md` §1 第 12 条、FC-D08 |
| B3-D02 | 六类业务键固定；DB UUID 不替代业务身份                                                      | Brief 1 FC1R8、样本关系权威     |
| B3-D03 | booking/stuffing/customs 使用同一精确 typed HBL，dispatch 精确引用 MBL/HBL                  | FC-D07、样本关系权威            |
| B3-D04 | 主备货单号只作展示组；合同/序号/source row 只作 lineage                                     | 样本关系权威 §1～2              |
| B3-D05 | 采用领域原生 typed facts + 集中 Application 编排；拒绝强塞现有 aggregate 与通用 JSON ledger | 本任务书面设计 §4               |
| B3-D06 | 新事实保持 neutral，不发布备货接受、装箱完成、出口放行或离港生命周期结论                    | 本任务书面设计 §2.4、§7         |
| B3-D07 | 写入口复用 `import.execute`，Application 层追加 rehearsal tenant/prefix 硬限制              | 本任务书面设计 §10              |
| B3-D08 | 单个 Serializable apply transaction + transaction 外 receipt + gated publish                | 本任务书面设计 §8               |
| B3-D09 | landing Outbox exactly once；本片新增业务任务数为 0                                         | 本任务书面设计 §8.4             |
| B3-D10 | 代码完成与实际 rehearsal execution 分轨；外部 package/path 只阻塞实际执行                   | 工程规则 §9、本任务书面设计 §14 |

## 当前物理事实与真实缺口

| Record type              | 当前承载                                                                           | Brief 3 处理                                      |
| ------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------- |
| `shipment_plan`          | 无 runtime aggregate；Shipment 表示已实际出运                                      | 新增 plan typed fact                              |
| `booking_commitment`     | booking-origin 为空                                                                | 新增 booking + typed documents                    |
| `cargo_ready_release`    | ReplenishmentOrder 仅部分相似，既有写用例要求 package 不具备的 line/unit/container | 新增 neutral release fact，不伪造完成             |
| `stuffing_snapshot_line` | 现有 stuffing 为柜级快照，allocation 不含 HBL identity                             | 新增四段业务键 line fact，不生成 seal/VGM/完成    |
| `export_customs_case`    | 现有 customs 是进口清关                                                            | 新增 export-specific fact，不生成放行             |
| `dispatch_fact`          | 现有 dispatch 依赖 stuffing/VGM/evidence 且只有单 HBL 文本                         | 新增 neutral dispatch fact + typed document joins |

## 执行切片与跨会话例外

本任务默认由当前 Claude Code 主代理同一会话连续实现，不下发实现 TASK/HANDOFF。所有切片共用当前分支与一个最终 PR；实现步骤以唯一实施计划为准。

| 切片                      | 交付                                                                                 | 最近验证                                                         | 停止条件                                      |
| ------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | --------------------------------------------- |
| `B3a-contract-boundary`   | 公共 package contracts、兼容矩阵、strict reader、compiler parity facade              | contract focused + Brief 1 regression                            | package bytes/hash 或 compiler 行为漂移       |
| `B3b-schema-foundation`   | landing run、六类 typed facts、joins、lineage/gaps、Outbox migration/data dictionary | Prisma generate/migrate、migration integration、dictionary drift | 需要通用 JSON ledger、临时表或生命周期默认值  |
| `B3c-graph-preflight`     | 六类 strict mapping、typed graph、orphan/ambiguous/display-only/FC-D07 校验          | Domain/Application unit RED→GREEN                                | 任何关系必须靠 substring/猜测/default 才成立  |
| `B3d-transactional-apply` | Serializable orchestrator、stable idempotency、concurrent replay、rollback           | real PostgreSQL integration                                      | 半成品可见或 replay 产生 duplicate            |
| `B3e-receipt-publish`     | MinIO receipt port、safe prefix、staged recovery、reconcile、gated Outbox            | MinIO + PostgreSQL integration                                   | 对象失败后无法安全恢复或 Outbox 提前发布      |
| `B3f-api-closeout`        | protected apply/status/chain API + non-mock closeout                                 | controller/API + real integration closeout                       | Controller 绕过 Application policy 或日志泄露 |
| `B3g-final-gates`         | task brief 证据、完整门禁、fresh Claude 整体只读复审、PR/CI                          | high-risk gate                                                   | blocking finding、真实门禁失败或范围越界      |

## 智慧开启基线

> 本任务不是重做六台工作台，而是为后续验收提供隔离全链事实。基线内容只承接与本业务步骤有关的对象边界；未写回权威的工作台策略、责任模式、阈值、启用方式和 UI 仍保持候选，不进入 adapter 状态或权限。

| 基线文件与结论                                                 | 处置          | 依据                                                      | 落点                                        |
| -------------------------------------------------------------- | ------------- | --------------------------------------------------------- | ------------------------------------------- |
| `全局.md`：跨台交接和唯一责任仍有硬缺口                        | `沿用` 为边界 | package landing 不制造接收/责任事实                       | no lifecycle/handoff completion             |
| `出运计划.md`：计划是版本化上游决定，当前 runtime carrier 缺失 | `补强`        | Schema/代码盘点确认无 ShipmentPlan；Shipment 是已实际出运 | neutral shipment plan fact                  |
| `备货.md`：备货行/批次事实与整单最终确认分轨                   | `沿用`        | canonical cargo-ready 不足以证明内部采信/完成             | neutral cargo-ready release fact            |
| `订舱.md`：有效订舱是独立业务对象；询价/接单不等于兑现         | `沿用`        | booking-origin 为空；本片只保存 canonical commitment      | neutral booking commitment                  |
| `装箱.md`：A1 当前仅历史事实/补证，不得冒充原生装箱闭环        | `沿用`        | canonical stuffing 缺 seal/VGM/evidence                   | stuffing line，不生成 completion            |
| `出口报关.md`：出口与进口清关分开；放行不等于装船/离港         | `沿用`        | 当前 customs aggregate 是进口清关                         | export customs fact，不生成 release         |
| `出运.md`：loaded 不是实际离港；实际离港事实需可信来源         | `沿用`        | package 日期精度不足，不可推断 lifecycle                  | dispatch fact 保留 precision，不发 departed |

## 负责人决策记录

| 决策 ID      | 已知事实与未知                             | 选项与权衡                                                                            | 推荐与理由                                                     | 负责人结论 | 权威落点 / 状态                                                                              |
| ------------ | ------------------------------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------- |
| B3-DESIGN-01 | 现有六类承载不完整；强塞会丢关系或制造状态 | A typed facts + centralized orchestrator；B 强塞现有 aggregate；C generic JSON ledger | A：保留身份/FK，支持事务与后续消费者，新增 Schema 有明确消费者 | 采用 A     | `docs/superpowers/specs/2026-10-13-full-chain-rehearsal-domain-adapter-design.md` / approved |

无新的业务政策、状态语义、责任交接、退出能力、权限政策或指标口径待负责人决定。可逆工程细节由主代理在实施计划中负责。

## 业务步骤五面映射

| 业务步骤与岗位结果                | 岗位任务来源/状态                                                            | 相关数据事实子集                                            | 技术保障                                                                                         | 权限边界                                                                             | 界面承接                                    | 验收证据/状态                              |
| --------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------- | ------------------------------------------ |
| 有效 package → rehearsal 全链事实 | 后续 demo/工作台验收人员可按 plan number 定位同链对象；本片不交付岗位办理 UI | 六类 key、typed HBL/MBL、FK、FC-D07 identity、lineage、gaps | strict validator、typed graph、Serializable apply、idempotency、receipt、reconcile、gated Outbox | `import.execute` + authenticated rehearsal tenant/prefix；old demo/other/global 禁写 | Brief 4 消费 status/chain API；本片不切页面 | 当前 `design`；代码/实际执行证据待切片补齐 |

### 相关数据事实子集（三轨）

| 轨道                 | 字段/事实                                          | 消费者              | 当前证据                   | 适用理由                    | 收益                 | 成本                  | 不采用风险                          | 可逆性                  | 承载                             | 决策 / 状态     |
| -------------------- | -------------------------------------------------- | ------------------- | -------------------------- | --------------------------- | -------------------- | --------------------- | ----------------------------------- | ----------------------- | -------------------------------- | --------------- |
| `current_physical`   | canonical package/version/hash/publishable         | package preflight   | Brief 1 compiler/contracts | 绑定精确输入                | fail-closed          | 公共 contract 收口    | scripts 私有实现无法供 API 安全消费 | facade 可回退           | 公共 contract                    | design-approved |
| `current_physical`   | Brief 2 ownership/inventory/path/object primitives | isolation/reconcile | Brief 2 done               | 防越界、复用安全基础        | 减少重复基础设施     | 需经 Port 包装        | 重写易引入删除/泄露风险             | 可替换实现              | Application/Infrastructure ports | design-approved |
| `approved_gap`       | 六类 typed runtime facts 与 landing run            | Brief 4/API         | 父设计 Brief 3、当前盘点   | 现有 aggregate 不同构       | 保留身份/关系        | additive migration    | 强塞产生错误事实                    | rehearsal tenant 可清理 | typed tables + constraints       | approved        |
| `approved_gap`       | package-level transaction/idempotency/publish gate | adapter execution   | 父设计 §4.1 / §7           | 防半成品与重复 side effects | 安全 replay/recovery | 两阶段 DB/object 编排 | 单仓储幂等不足                      | staged run 可恢复       | run state + outbox               | approved        |
| `industry_candidate` | none                                               | none                | 本片不引入行业规则         | 不适用                      | —                    | —                     | —                                   | —                       | `undecided`                      | not-applicable  |

## 验收

- [ ] package validator 拒绝 `publishable=false`、未知版本组合、hash/count/tamper、缺失/额外/重复 type 文件
- [ ] compiler facade parity 证明 Brief 1 package bytes/hash、FC-D07 和 fail-closed checks 未改变
- [ ] 六类业务主键非空且 tenant 内唯一；DB UUID 不替代 business key
- [ ] shipment-plan / booking / cargo-ready / stuffing / customs / dispatch typed relations 精确，无 orphan/ambiguous/fuzzy match
- [ ] 主备货单号只作展示组；合同/合同行/序号/source row 不进入 stuffing identity
- [ ] cargo-ready/stuffing/customs/dispatch 不制造采信、VGM、出口放行、loaded 或 departed 状态
- [ ] 同 package replay 不新增 fact、join、receipt、event、task 或 object
- [ ] concurrent replay 只有一个 apply，其余稳定 replay
- [ ] 同业务键不同 payload 稳定 conflict，不静默覆盖
- [ ] 中途失败完整 rollback；DB staged 后 receipt 失败保持 unpublished，同 package 可恢复
- [ ] landing Outbox exactly once；业务任务新增数为 0
- [ ] MinIO prefix 隔离、same-digest replay、different-digest conflict、exact-key cleanup
- [ ] old demo、other tenant、九类 global references 和 Temporal inventory 零变化
- [ ] apply/status/chain API 通过认证、capability、tenant 和对象范围检查
- [ ] 日志/receipt/API 不泄露商业原值、完整 hash、绝对路径、凭据、内部 IDs 或对象 key 清单
- [ ] 真实 PostgreSQL/MinIO non-mock closeout 通过
- [ ] unsupported/open/informational gaps 在 status/chain response 中保持可见
- [ ] 最近测试、API lint/typecheck/build、contract/schema/migration/dictionary、scoped format、repo/board/diff checks 通过
- [ ] 最终 PR 候选高风险门禁通过；fresh Claude 整体只读复审 finding 全部处置
- [ ] 代码完成与实际 rehearsal execution 分轨记录；未执行时不冒充已演练

## Deployment / done gate

代码设计、实现、评审和 PR 不因仓外 package 路径、重复 hash 或实际环境零变化尚未执行而无故阻塞。

实际 rehearsal 运行必须另具：

- `publishable=true`、版本/hash 一致 package；
- 当次独立 rehearsal tenant/prefix；
- authenticated operator/service identity；
- before/after inventory；
- 写入数量、replay、跨域对账、其他租户/global 零变化、失败恢复与 non-mock API closeout。

这些证据只证明本次 adapter 行为，不重新证明数据真实性。Brief 3 合并不自动授权 Brief 4、旧 demo 删除、生产写入或页面切换。

## 方案

唯一书面设计：[`2026-10-13-full-chain-rehearsal-domain-adapter-design.md`](../../superpowers/specs/2026-10-13-full-chain-rehearsal-domain-adapter-design.md)。

设计采用：

1. 正式公共 package contract + compiler parity facade；
2. 六类领域原生 neutral typed facts；
3. Application graph preflight；
4. 单个 Serializable apply transaction；
5. MinIO receipt 与 gated publish；
6. landing-only Outbox、task count zero；
7. protected apply/status/chain API；
8. 真实 PostgreSQL/MinIO closeout；
9. fresh Claude 整体只读复审；
10. 一个最终 PR。

## 进度 log

| 日期       | 阶段   | 负责        | commit     | 说明                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | ------ | ----------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-13 | design | Claude Code | —          | 核对 main/worktrees/brief/六类领域承载、Brief 1/2 和智慧基线；负责人批准推荐设计，建立唯一 Brief 3 brief 与聚焦书面 spec                                                                                                                                                                                                                                                                            |
| 2026-10-13 | coding | Claude Code | `1ffd59f0` | B3a contract boundary：新增双运行时 public package、六类 strict landing schemas、兼容矩阵、外部目录 reader 与 rehearsal receipt schema；compiler 保持 envelope+allowlist producer 语义并改为 facade。RED 覆盖缺 package、reader、commit provenance、producer/landing 分轨与 receipt；focused public 17/17、compiler parity 15/15、API typecheck、根 `pnpm test`（Web 747/API 1529）和政策门禁通过。 |
| 2026-10-13 | coding | Claude Code | `56113022` | B3c graph preflight：六类纯 adapter 建立 exact typed MBL/HBL、plan→cargo-ready、stuffing/customs/dispatch 关系；display group 不成关系，日期/高精度 decimal 保持字符串，缺 lineage/derived contributor/orphan/fuzzy/ambiguous typed ref 失败关闭。RED→GREEN 14/14，API typecheck/lint、根 `pnpm test`（Web 747/API 1543）通过。                                                                     |
| 2026-10-13 | coding | Claude Code | `pending`  | B3b schema foundation：新增 run + 六类 neutral typed facts + typed joins + receipt/gap 共 12 个 tenant-owned 模型与 additive migration；所有 FK 含 tenant/run，HBL→MBL parent 与 stuffing/customs/dispatch HBL role 由 constraint trigger 收口。真实临时 PostgreSQL 4/4、ownership 7/7、dictionary 54/54 通过；共享 dev DB 仅报告新迁移 pending，未擅自部署。                                       |
