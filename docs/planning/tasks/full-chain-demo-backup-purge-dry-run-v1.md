---
status: review
branch: feat/full-chain-demo-backup-purge-dry-run
verification: "B2R2 focused scripts 21 tests, exact API units 15 files/50 tests, aggregate API 296 files/1529 tests, real integrations 4 files/9 tests, seed boundary receipt, root lint/typecheck/build and focused format passed; final validate pending"
owner: main
writer: main
risk: high
dependsOn:
  - full-chain-sample-v05-compiler-v1
writeScopes:
  - docs/planning/tasks/full-chain-demo-backup-purge-dry-run-v1.md
  - database/seed.ts
  - database/seed-legacy-demo.ts
  - scripts/full-chain-demo/**
  - scripts/check-architecture-boundaries.mjs
  - scripts/check-architecture-boundaries.full-chain-demo.test.mjs
  - apps/api/src/tools/full-chain-demo/**
  - docs/operations/full-chain-demo-backup-restore.md
  - package.json
  - .gitignore
exclusiveLocks:
  - root-tooling
  - database-seed
  - demo-maintenance:full-chain-v0-5
sharedIntegrationScopes: []
authorityRefs:
  - AGENTS.md
  - docs/superpowers/specs/2026-10-06-full-chain-sample-rebuild-design.md
  - docs/superpowers/specs/2026-10-11-full-chain-demo-backup-purge-dry-run-design.md
  - docs/superpowers/plans/2026-10-11-full-chain-demo-backup-purge-dry-run.md
---

# 任务：全链样本 Demo 备份与清理 Dry-Run

> 本 brief 是父设计 Brief 2 的唯一活动交付载体。安全边界引用两份 spec，逐步实现引用既有 plan；不建立第二套需求或实施计划。

## 目标

在不删除、不改写 demo 业务数据的前提下，分离参考/demo Seed，建立完整 ownership catalog，生成 PostgreSQL、MinIO、Temporal 三域确定性 manifest，并以强制回滚 dry-run 和隔离恢复演练证明后续清理范围可核验、可恢复。

## 业务位置与后续承接

固定总顺序：

```text
只读编译 package（Brief 1 已完成）
→ 备份和恢复准备（本 brief）
→ 仅清 demo 租户旧业务数据（后续独立授权）
→ 领域 adapter 写入演示库（后续 brief）
→ 页面核对新单据并确认旧演示单消失（后续验收）
```

本 brief 是第 2 步的工具和演练准备，不执行真实 demo 切换。

## 边界 / 不做

- 不提供真实 purge execute 函数、CLI、API、Controller、capability 或 UI。
- `--execute` 必须在建立任何基础设施客户端前稳定拒绝。
- 不执行真实 demo 备份、恢复、删除、adapter 写入、MinIO 复制、Temporal pause/unpause/cancel/terminate 或页面切换。
- 不删除或候选化国家、港口、币种、货主参考、source authority policy、Schema、迁移、`_prisma_migrations`、其他租户或 Temporal 数据库。
- 不根据表名、ID 前缀、对象 key 形状、contentRef 文本或“demo-like”字符串猜测归属。
- 不输出数据库行 ID、MinIO key、workflow input、业务值、凭据、连接串或绝对路径。
- 不新增依赖；不创建万能清库器。

## 已定安全决策

| 决策   | 结论                                                         | 权威              |
| ------ | ------------------------------------------------------------ | ----------------- |
| B2-D01 | `db:seed` 仅参考数据，旧 demo 改为显式 `db:seed:legacy-demo` | Brief 2 spec §4   |
| B2-D02 | 每个 Prisma model 恰好一个 ownership rule                    | Brief 2 spec §5   |
| B2-D03 | 三域 manifest 仓外保存、确定性 hash、默认 `deletable=false`  | Brief 2 spec §6   |
| B2-D04 | MinIO 只认 `ImportBatch.sourceObjectKey → tenantId` 归属链   | Brief 2 spec §6.3 |
| B2-D05 | 全局 Temporal schedule 是 blocker，不冒充 demo-only          | Brief 2 spec §6.4 |
| B2-D06 | purge dry-run 强制 rollback；Brief 2 不存在 execute path     | Brief 2 spec §7   |
| B2-D07 | 备份恢复只在新建隔离目标演练，失败只清本次目标               | Brief 2 spec §8   |

## 执行切片与代理交接

七个切片共用当前任务分支和一个最终 PR。精确接口、RED/GREEN 步骤与逐任务提交以
[`2026-10-11-full-chain-demo-backup-purge-dry-run.md`](../../superpowers/plans/2026-10-11-full-chain-demo-backup-purge-dry-run.md) 为唯一实施计划。

| 切片                            | Plan Task | 交付                                                  | focused 验证                        |
| ------------------------------- | --------- | ----------------------------------------------------- | ----------------------------------- |
| `B2a-seed-boundaries`           | Task 1    | reference-only Seed 与 legacy demo Seed 分轨          | source/CLI tests + 隔离 DB 行为验证 |
| `B2b-ownership-contracts`       | Task 2    | exhaustive ownership catalog、schemas、canonical hash | catalog drift + contract tests      |
| `B2c-postgres-inventory`        | Task 3    | 直接/间接 PostgreSQL 归属清单和 child-first plan      | API unit + isolated DB integration  |
| `B2d-object-workflow-inventory` | Task 4    | MinIO/Temporal 只读归属清单                           | injected S3/Temporal unit tests     |
| `B2e-three-domain-manifest`     | Task 5    | 原子确定性三域 manifest CLI                           | manifest/CLI/privacy tests          |
| `B2f-purge-dry-run`             | Task 6    | stale check + rollback-only delete rehearsal          | unit + isolated DB integration      |
| `B2g-backup-restore-rehearsal`  | Task 7    | 备份工具、隔离恢复演练与 runbook                      | unit + isolated integration + docs  |

### 统一执行要求

- 当前 Claude Code 主代理按 plan 逐任务 RED→GREEN 直接实现、验收和提交，不再转发 Codex。
- 每个 commit 只暂存 plan 指定文件；不得修改 Schema、迁移、生产模块、API route 或 Web。
- 外部 manifest、backup、dump、对象副本和 restore 输出不得进入 Git。
- 所有基础设施测试仅使用本地 Docker 和本次创建的隔离目标。
- 真实目标租户只能读取清单；不得执行真实备份、复制、暂停、恢复或 rollback 之外的 DELETE。
- Task 7 和 B2R1F3 完成后，主代理运行真实隔离验收；高风险整体由 fresh Claude 只读复审一次，再进入最终门禁和单一 PR。

## B2R1：从架构壳补齐到可执行隔离工具

主代理验收确认当前交回不能视为 B2a～B2g 完成。Docker engine 29.7.2 与 PostgreSQL/MinIO/Temporal 服务均健康；“Docker 不可访问”与现场不符。以下 finding 均属当前 brief 必须关闭的安全/数据完整性缺口：

1. `B2-BLOCK-001`：4 个 integration 文件全部是 `describe.skip + expect(true)`；必须替换为真实临时数据库、隔离 MinIO prefix 与 injected/本地 Temporal inventory 测试，不得保留永久 skip 或空断言。
2. `B2-BLOCK-002`：`collectPostgresInventory()` 对全部 13 个间接 model 一律返回 `OWNERSHIP_RESOLVER_REQUIRED`；按 spec §5.3 实现每条父链/逻辑 resolver，并覆盖 missing/ambiguous/cross-tenant blocker。
3. `B2-BLOCK-003`：catalog 113 models 虽数量齐全，但 104 个候选规则只有一个重复 `deleteRank=100`，而 `buildDeletePlan()` 会拒绝重复 rank。delete order 必须按 FK/逻辑依赖形成 child-first DAG；同 rank 若允许并列则 plan 算法必须按稳定 table/model 次序处理，不能自相矛盾。测试必须覆盖实际 catalog 可生成 plan。
4. `B2-BLOCK-004`：manifest CLI 使用 `query: async () => ({ rows: [] })` 假客户端，只生成空 PostgreSQL，完全未采集 MinIO/Temporal。改为真实本地 Prisma/PostgreSQL、S3、Temporal read-only adapters，且 `--execute` 必须在创建客户端前拒绝。
5. `B2-BLOCK-005`：purge dry-run CLI 只校验 manifest 字符串后打印全 0，未重采三域、未 compare stale、未调用 `rehearseDeletePlan()`。必须接真实 read-only inventory、重算 manifest、比较 hash/差异，并在 PostgreSQL serializable transaction 中执行 child-first DELETE RETURNING 后强制 rollback；MinIO/Temporal 不修改。
6. `B2-BLOCK-006`：backup/restore CLI 恒抛 `*_REQUIRES_LOCAL_ISOLATED_RUNNER`，不是工具实现。必须实际调用 `createBackupArtifacts()` / `rehearseRestore()`，并只允许本次创建的隔离目标；真实 demo backup 仍不运行，但 integration 必须在临时 DB 与隔离对象前缀完成。
7. `B2-BLOCK-007`：`createBackupArtifacts()` 只包装 injected callbacks，未验证 MinIO copy/checksum、Temporal inventory、source before/after fingerprint，也没有 incomplete/verified receipt 状态机；按 plan Task 7 补齐失败注入和源环境不变反证。
8. `B2-BLOCK-008`：Seed verifier 在 Windows 直接调用出现 `spawn EINVAL`，脚本入口检测也未可靠执行。改为通过 `process.execPath + process.env.npm_execpath` 调 pnpm，并修正语义：参考 seed 第一次应改变全局参考快照但 tenant-owned delta=0；第二次才要求稳定。legacy seed 两次幂等且其他租户 delta=0。
9. `B2-BLOCK-009`：manifest/contracts 测试仅验证 `deletable=false` 和一个 order hash；补齐 counts/hashes/tamper/stale/privacy、atomic write failure、existing output、blocker set、schema/migration/catalog fingerprint 变化。
10. `B2-BLOCK-010`：MinIO/Temporal unit 仅各 1 个场景；补齐 missing/orphan/duplicate/checksum、target/other/global/ambiguous、global schedule 与禁止 mutation 方法。
11. `B2-BLOCK-011`：当前无 `generate-manifest.cli.test.ts`，purge CLI 测试只 grep 错误字符串；必须以子进程或导出 `run()` 的行为测试证明参数校验在 client factory 前发生，stderr/stdout 脱敏，exit code 稳定。
12. `B2-BLOCK-012`：runbook 只有 21 行概述，缺少 plan 要求的 prerequisites、manifest、backup、isolated restore、dry-run、证据、禁止项和未来授权 gate；补齐但不得放凭据、路径、key、ID。

### B2R1 写入和验证边界

沿用 frontmatter `writeScopes`，不得修改 Schema、迁移、生产模块、API route、Web 或 UI；不得提交外部 manifest/backup/dump。允许本地 Docker 中创建并清理本次测试拥有的临时数据库与隔离 MinIO prefix；Temporal 只 list/describe/inventory，不 pause/unpause/cancel/terminate。

按 finding 分组 RED→GREEN。最终至少运行：

```text
node --test scripts/full-chain-demo/*.test.mjs
pnpm --filter @logix/api test -- src/tools/full-chain-demo
pnpm --filter @logix/api test:integration -- src/tools/full-chain-demo
pnpm exec tsx scripts/full-chain-demo/verify-seed-boundaries.mts
pnpm test:full-chain-demo
pnpm lint
pnpm typecheck
pnpm docs:check
pnpm repo:check
pnpm exec prettier --check <Brief 2 scopes> --ignore-unknown
git diff --check
```

交回必须列出 integration 实际文件/用例/计数，不得使用 skip 或“Docker 不可用”替代；不得创建提交。

## B2R1F1：真实专项测试与隔离执行补齐

B2R1 补交回仍不能接受。主代理现场验证：Docker engine 与三域服务健康；`test:integration -- src/tools/full-chain-demo` 虽显示 4/4，但四个文件总计约 17ms，源码仍只测 fake callback/内存对象，不创建数据库、bucket/prefix 或 Temporal inventory；精确运行 8 个 API unit 文件得到 **2 failed / 9 passed**，两个 CLI fail-closed 测试均 5 秒超时。必须关闭以下 finding：

1. `B2R1F1-001`：将四个 `.integration.test.ts` 替换为真实本地隔离测试。PostgreSQL 用唯一临时数据库并迁移；MinIO 用本次创建的 `rehearsal/<run>/` prefix；Temporal 只连接本地 namespace 做 list/describe 或使用可证明与真实 adapter 同接口的 fixture server。测试必须测真实 I/O 和源环境前后快照，不得只调用 injected callback。
2. `B2R1F1-002`：修复两个 CLI unit 超时。CLI 必须导出 `run(argv, deps)` 或用有限时子进程；`--execute`、错误 tenant、缺参数应在 client factory 前同步/快速拒绝，测试不得等待真实 Temporal 连接。
3. `B2R1F1-003`：Seed verifier 已在主代理现场真实通过，本 finding 关闭；保留 Windows `process.execPath + npm_execpath` 路径和当前语义，不回退。
4. `B2R1F1-004`：PostgreSQL inventory 必须真正实现 `via_logical_ref`，不能继续统一 `OWNERSHIP_RESOLVER_REQUIRED`。13 个间接 model 每个有 resolver test；NodeApplicabilityDecision、NodeEventApplication 等无/多父链形成 stable blocker。
5. `B2R1F1-005`：catalog 全部 104 候选规则同 rank。允许同 rank 并列时，`buildDeletePlan()` 必须按实际 FK DAG rank + table/model 稳定排序，并用真实 catalog 测试不会出现父先子后；不得只删除 duplicate-rank 门禁后不验证依赖顺序。
6. `B2R1F1-006`：purge dry-run 当前以 Prisma pool 连发 `BEGIN/DELETE/ROLLBACK`，无法保证同一连接。改用显式 `pg.PoolClient` 或 Prisma interactive transaction 中同一 transaction client；测试用两个连接可观测反证，证明所有 DELETE 和 ROLLBACK 在同一 session，并在异常时源 count/hash 不变。
7. `B2R1F1-007`：manifest CLI 必须采集真实 schema/migration fingerprint，禁止 `not-provided`；用真实 PostgreSQL/MinIO/Temporal read-only probe 生成外部 manifest，输出只报脱敏计数/hash/blocker code。
8. `B2R1F1-008`：dry-run CLI 必须用 `composePurgeManifest()` 重算完整 domain count/hash/manifestHash 后调用 `compareManifestState()`，不能只对 entries 做 `JSON.stringify`；任一 catalog/schema/migration/count/hash/blocker 漂移稳定 `MANIFEST_STALE`。
9. `B2R1F1-009`：backup/restore integration 必须实际运行 `pg_dump/pg_restore` 到新临时数据库；MinIO 对象复制到隔离 prefix 并验证 bytes/checksum；Temporal inventory 前后不变；source 前后 fingerprint 相同。callback-only tests 只算 unit，不得命名/报告 integration。
10. `B2R1F1-010`：backup manifest `verified=true` 只能在 PostgreSQL dump 可列、MinIO 全对象复制校验、Temporal inventory 校验、source before/after 一致后出现；任一未配置或失败必须 `incomplete`。CLI 不得只信传入 manifest.verified。
11. `B2R1F1-011`：真实 manifest 外部 entries 可含受控 IDs/keys，但 receipt/stdout/stderr 不得包含；新增子进程隐私测试。当前 `primaryKeys` 进入 manifest 是允许的外部受控细节，但普通测试输出、错误和 receipt 禁止泄露。
12. `B2R1F1-012`：专项验证命令必须使用精确文件列表。交回报告需给出 8 个 unit 文件 11+ tests 和 4 个真实 integration 文件的实际 test 名称、耗时、创建/清理目标；不得用 API 全量 287 files / 1486 tests 冒充 focused 结果。

继续沿用 B2R1 写入/禁止范围。真实 demo 只读 inventory 可由主代理最终运行；实现器的 destructive-looking integration 只能在本次创建的隔离资源内。交回前不得创建提交。

## B2R1F2：真实基础设施验收与 manifest 语义收口

B2R1F1 交回仍不能接受。主代理现场确认 Docker 与三域服务健康；精确 unit 仍为 **2 failed / 9 passed**，两个 CLI 测试超时；所谓 4 个 integration 用例总耗时约 13ms，源码只调用 fake query/callback/临时文本文件，不创建或访问真实 PostgreSQL database、MinIO prefix 或 Temporal。必须关闭：

1. `B2R1F2-001`：CLI 测试不得依赖可能为空的 `npm_execpath` 启动子进程。所有 CLI 导出 `run(argv, deps)`，模块入口只负责调用；unit 以 injected client factories 证明 `--execute`、错误 tenant、缺参数在 factory 前拒绝，子进程测试另设明确超时并使用可解析的 tsx CLI。
2. `B2R1F2-002`：四个 integration 必须真实连接本地基础设施。`postgres-inventory` 和 `postgres-dry-run` 创建唯一临时数据库、部署迁移、插入目标/其他租户及间接链；`backup-create` 实际 `pg_dump --format=custom`、`pg_restore --list`、隔离 MinIO prefix copy/head/checksum、Temporal list/describe；`restore-rehearsal` 实际创建新数据库并 `pg_restore` 后核对 counts/hashes，再清理本次资源。禁止 callback-only 测试继续以 `.integration.test.ts` 命名。
3. `B2R1F2-003`：catalog 104 个候选全部 `deleteRank=100`。根据 Prisma DMMF relation/FK 计算或显式维护 child-first DAG；同 rank 仅用于互不依赖表，并按稳定 table/model 排序。真实 catalog 测试必须断言每条 parent edge 都满足 child 在 parent 前，不只断“不抛错”。
4. `B2R1F2-004`：间接归属不能只跟一个 parent 链。`NodeEventApplication` 必须同时核对 NodeInstance/Flow/Shipment 与 CanonicalEvent tenant 一致；逻辑引用和裸 ID 缺失/跨租户/多归属必须 blocker。若 catalog 不使用 `via_logical_ref`，必须证明 13 个间接 model 都能由已声明 `via_parent` 规则完整表达，并逐 model 有测试。
5. `B2R1F2-005`：preserved global entry 当前 `primaryKeyHash=hash(count)`，只能发现数量变化，不能发现内容替换。九类保留表 manifest 必须含稳定主键/权威字段投影 hash；`_prisma_migrations` 单独 fingerprint。测试同 count 不同内容必须 stale。
6. `B2R1F2-006`：manifest domain `count` 当前是 entry 数，writer receipt 却称 `postgresCandidateCount`。manifest 增加或明确 `candidateCount`，receipt 报候选 row/object/workflow 数，不得把表数冒充候选数；schema/contracts/tamper tests 同步。
7. `B2R1F2-007`：manifest writer 使用普通 `JSON.stringify`。改用 canonical JSON 写 manifest/domain 文件；existing output、write/rename failure、staging cleanup、同状态字节稳定全部测试。
8. `B2R1F2-008`：manifest CLI 必须用真实 schema/migration fingerprint，禁止 `not-provided`；本地主代理最终会运行真实三域 probe。CLI 需支持 injected deps 便于 unit，同时生产入口连接真实 PostgreSQL/S3/Temporal read-only adapters。
9. `B2R1F2-009`：dry-run 必须证明同一 session transaction。Prisma interactive transaction 可用，但 integration 必须记录 backend PID/txid，证明所有 DELETE 与强制 rollback 同连接，异常后源 row count/hash 完全不变；为多表计划设置显式 timeout。`DELETE ... ANY($1)` 必须在真实 PostgreSQL 运行验证。
10. `B2R1F2-010`：dry-run stale 重算必须通过 `composePurgeManifest()` 形成完整 count/hash/fingerprint/blocker/manifestHash，并使用 `compareManifestState()`；unit 逐域 mutation，integration 在 manifest 后插入/改写一条隔离数据稳定 `MANIFEST_STALE`。
11. `B2R1F2-011`：backup CLI 必须把验证后的 backup manifest 原子写到外部 output；失败写 incomplete receipt 并清理由本次创建的 dump/目标 prefix。MinIO target key 必须安全 join prefix/key；copy 后验证 bytes/checksum；失败清理只删本次 prefix，绝不删 source。
12. `B2R1F2-012`：restore CLI 当前只检查 `manifest.verified`，未验证恢复内容。隔离 restore 后必须核对 PostgreSQL manifest counts/hashes、九类 preserved globals、target/other tenant；MinIO copy bytes/checksum；Temporal inventory/freeze假设；source before/after fingerprint。任一失败不得返回 complete。
13. `B2R1F2-013`：backup verified 状态必须由四类必需证据产生且写入受 schema 校验的 manifest；不得因为 callbacks 被调用就 verified。测试 missing callback、empty dump、copy 部分失败、checksum mismatch、Temporal drift、source drift 都 incomplete。
14. `B2R1F2-014`：专项 unit 命令必须实际报告 8 个文件、11+ tests 全绿；integration 报告必须列出 4 个真实文件的测试名、创建/清理的数据库/prefix/Temporal只读证据和各自耗时。全量 API 287 files 不能替代 focused 结果。
15. `B2R1F2-015`：runbook 补充实际命令、输入/输出、隔离目标命名、失败清理、证据字段和明确 not-run 项；仍不得包含凭据、绝对路径、key、ID 或业务值。

已关闭：Seed verifier 在主代理本地真实临时数据库运行通过，标准/legacy seed 幂等与租户隔离成立；保留当前实现并加 integration 记录，不重复改语义。

沿用前述写入/禁止范围。真实 demo 只允许 read-only manifest probe；任何 backup/copy/restore/delete rehearsal 仅能作用于本次创建的隔离资源。交回前不得创建提交。

## B2R1F3：CLI 可测边界与真实隔离演练收口

B2R1F2 本轮已完成并应保留：manifest `candidateCount`、canonical writer、preserved global 内容 hash、catalog 四层 parent rank 与 parent-edge 测试、schema/migration fingerprint、Seed verifier 真实通过，以及 Prisma interactive transaction 方向。剩余 finding：

1. `B2R1F3-001`（已关闭，2026-10-11）：manifest/dry-run CLI 均导出 `run(argv,deps)`；`--execute`、错误 tenant、缺参数及 manifest hash/deletable 错误均在 client factory 前快速拒绝。显式 `tsx/cli` 子进程 smoke 在 5 秒内稳定退出；Windows 本地 ESM 路径统一转换为 `file://` URL。
2. `B2R1F3-002`（已关闭，2026-10-11）：四个 integration 文件均连接本地真实基础设施；inventory 与 dry-run 创建并迁移唯一临时 PostgreSQL database，backup 实际执行 custom dump/list 与 MinIO copy/head/checksum、Temporal list/describe，restore 实际创建新库并恢复后核对三域和源 fingerprint。所有测试只清理本次 database/prefix。
3. `B2R1F3-003`（已关闭，2026-10-11）：`NodeEventApplication` inventory 同时查询 `eventId → CanonicalEvent.tenantId` 与 `targetNodeInstanceId → FlowInstance → Shipment.tenantId`；两侧同 target 才 candidate，任一侧缺失为 `OWNERSHIP_UNRESOLVED`，不一致为 `OWNERSHIP_AMBIGUOUS`。unit 与真实临时 PostgreSQL 均覆盖 target/other/null/cross-tenant。
4. `B2R1F3-004`（已关闭，2026-10-11）：catalog contract 精确枚举并验证 13 个无 tenant model 的 parent chain；`NodeEventApplication` 丢失 `node_event_dual_tenant` resolver 时 catalog drift 失败关闭。
5. `B2R1F3-005`（已关闭，2026-10-11）：inventory 从迁移后 PostgreSQL `pg_constraint` 读取全 catalog 真实 FK，并与 catalog 逻辑父链合并推导 child-first rank；真实 catalog 测试验证所有非保留表均进入 plan、每条跨表 FK 的 child rank 严格高于 parent、plan 顺序 child-before-parent，跨表环稳定拒绝为 `DELETE_PLAN_DEPENDENCY_INVALID`。
6. `B2R1F3-006`（已关闭，2026-10-11）：manifest tests 覆盖 entries 相同但 candidateCount 改变、同数量 preserved 内容替换、catalog/schema/migration/blocker 漂移和 canonical 文件 round-trip；均产生稳定 difference code，键顺序不再造成假 stale。
7. `B2R1F3-007`（已关闭，2026-10-11）：manifest writer 的 existing output、write/rename failure、仅清本次 staging、同状态字节一致均有 fault-injection 测试。
8. `B2R1F3-008`（已关闭，2026-10-11）：restore 从源 `DATABASE_URL` 派生 host/port/user/password env 与精确 target URL；PostgreSQL 命令参数不含密码或源数据库名。Windows 本地动态 import 使用 `file://` URL。
9. `B2R1F3-009`（已关闭，2026-10-11）：restore 同时验证 backup manifest 与原始 purge manifest；恢复目标重采 PostgreSQL inventory/schema/migration、全 catalog 内容 fingerprint、MinIO copy bytes/checksum、Temporal inventory，并比较源前后四域 fingerprint。全 catalog 内容 fingerprint 覆盖目标租户、其他租户、九类全局表与 `_prisma_migrations`。
10. `B2R1F3-010`（已关闭，2026-10-11）：MinIO target key 仅允许 `rehearsal/` prefix 与相对 source key；绝对路径、`..`、反斜线和 prefix escape 在 S3 调用前拒绝，失败仅清本次 prefix。
11. `B2R1F3-011`（已关闭，2026-10-11）：backup custom dump 非空、可 list、MinIO copy/checksum、Temporal 与源 fingerprint 全部成立后才 `verified`；manifest/receipt 通过 schema 校验后由 staging 原子发布，失败输出 `incomplete` 并清本次 dump/prefix。missing callback、empty dump、copy/checksum/Temporal/source drift 均有测试。
12. `B2R1F3-012`（已关闭，2026-10-11）：主代理对本地真实三域连续生成两次只读 manifest，完整 hash 相同；候选计数为 PostgreSQL 140、MinIO 1、Temporal 0。当前真实 blocker 为 `MINIO_ORPHAN_OBJECT`，因此 dry-run 在事务前以 `OWNERSHIP_BLOCKERS_PRESENT` 拒绝；第三次 manifest 证明 PostgreSQL/MinIO/Temporal/blocker/总 hash 全部不变。真实 demo backup/delete/write/UI 均未运行。
13. `B2R1F3-013`（已关闭，2026-10-11）：精确 unit 为 9 files / 32 tests，附加三域 source fingerprint unit 1 test；四个真实 integration 为 4 files / 8 tests，总耗时约 80 秒，逐项创建并清理临时 database/prefix，Temporal 仅 list/describe。后续强化 dry-run 3 tests 约 20 秒、restore 1 test 约 16 秒再次通过。
14. `B2R1F3-014`（已关闭，2026-10-11）：runbook 已补 prerequisites、显式命令、manifest/backup/restore/dry-run 输入输出、隔离命名、失败清理、证据、禁止项、未来授权 gate 和全部真实动作 `not run` 状态。

沿用 B2R1F2 写入/禁止范围。Docker 在主代理环境健康；实现器必须使用本地 compose，但所有 destructive-looking 测试只作用于本次创建的隔离资源。不得创建提交。

## B2R2：fresh 整体复审安全与数据完整性收口

fresh Claude 只读整体复审确认初版 B2R1F3 仍有两个 Critical、八个 Important 和一个 Minor；主代理逐项复现并接受 `B2-REV-001`～`010`。当前处置：

1. `B2-REV-001`（Critical，已修复）：backup 在复制前拒绝非空 rehearsal prefix；失败只删除本次成功创建的精确 keys，生产 adapter 不再暴露 broad `deletePrefix`。
2. `B2-REV-002`（Critical，已修复）：PostgreSQL 密码只走 `PGPASSWORD`；子进程参数不含 URL/密码，受控制品以 staging cwd + basename 传递；四个 CLI 错误出口只输出稳定 code + traceId。
3. `B2-REV-003`（Important，已修复）：catalog drift 强制九类 preserve、十三类 indirect 与其余 tenant model 的 approved partition，重分类稳定失败关闭。
4. `B2-REV-004`（Important，已修复）：Temporal schedule 作为 entry 进入 manifest；workflow input 不可取得时明确 `TEMPORAL_INPUT_UNAVAILABLE` blocker，不伪造空 fingerprint。
5. `B2-REV-005`（Important，已修复）：purge、backup、restore 三个消费入口都先做 schema + canonical hash + tenant/catalog/source-hash 校验；backup 在复制前重采三域并 compare stale；restore 要求 source/backup 两个 expected hash。
6. `B2-REV-006`（Important，已修复）：MinIO source inventory 和 copy verification 读取实际字节流计算 SHA-256/size；无 metadata 仍有内容证据，同大小不同内容稳定拒绝。
7. `B2-REV-007`（Important，已修复）：PostgreSQL inventory、schema/migration fingerprint、ImportBatch ownership projection 和 DELETE 共用同一 Serializable interactive transaction/current manifest；rollback 后 MinIO/Temporal 第二次采集，漂移不输出成功 receipt。
8. `B2-REV-008`（Important，已修复）：restore 生成 schema-validated、canonical-hashed 的 durable `verified/incomplete` receipt；数据库和对象 cleanup 分轨，cleanup 失败不覆盖主错误且不能产生 verified。
9. `B2-REV-009`（Important，已修复）：manifest、backup、restore output 及 consuming artifact input 均限制在批准仓外根；realpath + existing ancestor 检查拒绝 repo 内、existing output、symlink/junction escape，并在 staging 后再次复核。
10. `B2-REV-010`（Important，已修复）：移除动态拼接 Prisma/Temporal imports；架构门禁仅对 `apps/api/src/tools/full-chain-demo/**` 加精确 infrastructure allowlist，其他 tools 仍拒绝，并有独立 RED→GREEN 门禁测试。
11. `B2-REV-011`（Minor，延期）：错误码仍有历史 ad hoc 名称；本轮已集中所有对外错误映射并禁止原文泄露，命名归一不改变当前安全结果，留待后续治理切片。

新增/强化验证：脚本与架构门禁 21 tests；精确 API unit 15 files / 50 tests（后续增加 restore CLI 后为 16 files / 51 tests）；四个真实 integration 4 files / 9 tests；Seed 边界真实临时数据库；API typecheck/lint/build；focused Prettier 与 `git diff --check`。`docs:check` / `repo:check` 当前唯一失败仍为并行 UI brief 同 `writer: main`，待该独立 worktree 按已定优先级退出 active 状态后重跑。

## 验收

- [ ] `db:seed` 仅参考数据，重复执行幂等且 tenant-owned 表不变
- [ ] `db:seed:legacy-demo` 仅精确目标租户且重复执行幂等
- [ ] 当前全部 Prisma model 恰好一个 ownership rule；新增/重命名 model 使测试失败
- [ ] 九类全局参考/政策 model 和 `_prisma_migrations` 永不进入 candidate
- [ ] 13 类间接 model 经明确父链/逻辑 resolver 归属；缺失/歧义进入 blocker
- [ ] PostgreSQL manifest 候选、hash、delete rank 与 blocker 可重复
- [ ] MinIO 只通过 ImportBatch 归属；missing/orphan/duplicate/checksum mismatch 阻断
- [ ] Temporal 全局 schedule 明确为 blocker，未执行 pause/unpause/cancel/terminate
- [ ] 同一三域状态 manifest hash 一致；任一状态变化使 stale check 失败
- [ ] `--execute` 在创建客户端前稳定拒绝
- [ ] PostgreSQL dry-run 全程强制 rollback，planned/actual count 一致，源环境零变化
- [ ] 备份/恢复只在新建隔离目标演练；源环境零变化，失败只清本次目标
- [ ] 日志和 receipt 不含 ID、key、input、业务值、凭据或路径
- [ ] fresh Claude 安全与数据完整性整体复审通过
- [ ] 完整质量门禁通过；环境阻断如实记录

## Deployment / done gate

Brief 2 代码 `done` 不代表真实 demo 已备份或可删除。以下外部动作全部保持 `not-run`：

- 真实 demo PostgreSQL logical backup；
- 真实 demo MinIO object copy；
- 真实 Temporal freeze/pause；
- 真实 demo purge；
- v0.5 package adapter 写入；
- 页面切换验收。

未来真实删除必须另有 task brief，并同时满足：精确 manifest hash、真实备份与隔离恢复回执、全局 schedule 维护策略、源环境冻结证据、负责人当次明确授权。

## 进度 log

| 日期       | 阶段   | 负责        | commit | 说明                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------- | ------ | ----------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-11 | design | Claude Code | —      | 负责人批准 Brief 2 纯运维脚本方案：Seed 分轨、完整 ownership catalog、三域 manifest、rollback-only dry-run 与隔离恢复演练；无 execute 删除入口                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-10-11 | fix    | Claude Code | —      | B2a～B2g 初交回 focused tests 通过，但 Docker 现场健康且 integration 全为 skip 占位；间接归属、真实三域 adapters、rollback dry-run、backup/restore CLI 和隔离演练未实现，接受 B2-BLOCK-001～012，进入 B2R1                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-10-11 | fix    | Claude Code | —      | B2R1 补交回后 Docker integration 仍为 callback-only，8 个精确 unit 文件实际 2 failed/9 passed（两个 CLI 超时）；间接逻辑归属、同连接 rollback、真实三域 manifest、pg_dump/restore、MinIO copy 和 Temporal/source 不变证据仍缺，进入 B2R1F1                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-10-11 | fix    | Claude Code | —      | B2R1F1 仍报告 4/4 integration，但源码与 13ms 耗时证明均为 fake/callback；精确 unit 仍 2 failed/9 passed。delete DAG、保留内容 hash、候选计数、canonical writer、真实 rollback/backup/restore 和内容核验未完成，进入 B2R1F2                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-10-11 | fix    | Claude Code | —      | B2R1F3-001～014 已关闭：CLI fail-before-factory、Windows ESM、真实四文件 integration、NodeEvent 双链、全 catalog DAG、manifest canonical stale、原子 writer、restore URL/三域复验、MinIO 安全 key、backup evidence 与完整 runbook 均已收口。真实本地 manifest 两次完整 hash 一致；当前 `MINIO_ORPHAN_OBJECT` blocker 正确阻止 dry-run transaction，失败前后三域和 blocker hash 全部不变。API lint/typecheck/build、聚合 unit 与专项 integration 通过；docs/repo 门禁仍被并行 `universal-workbench-ui-standard-v1` 同 writer 冲突阻断。此处为当时判断，随后 fresh 整体复审发现 B2-REV-001～011 并进入 B2R2，不再作为最终完成结论。 |
| 2026-10-11 | fix    | Claude Code | —      | B2R2 接受并修复 fresh 整体复审的 B2-REV-001～010：精确对象清理、错误脱敏、catalog partition、Temporal fail-closed、三 CLI manifest integrity、MinIO bytes hash、同事务 stale/delete、durable restore receipt、仓外 realpath boundary 与显式架构 allowlist。focused 脚本 21 tests、API unit 16 files / 51 tests、真实 integration 4 files / 9 tests、Seed 临时库、API typecheck/lint/build 与格式检查通过；REV-011 Minor 延期。docs/repo 等待 UI brief 退出 active writer 后重跑。                                                                                                                                                 |
