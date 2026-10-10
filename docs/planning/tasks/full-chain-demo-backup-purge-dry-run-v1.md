---
status: coding
branch: feat/full-chain-demo-backup-purge-dry-run
verification: "Brief 1 merged via PR #164 at be56f2e9; Brief 2 design and implementation plan approved; implementation pending"
owner: main
writer: codex
risk: high
dependsOn:
  - full-chain-sample-v05-compiler-v1
writeScopes:
  - docs/planning/tasks/full-chain-demo-backup-purge-dry-run-v1.md
  - database/seed.ts
  - database/seed-legacy-demo.ts
  - scripts/full-chain-demo/**
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

- Codex（GPT-5.6）为唯一实现执行器；按 plan 逐任务 RED→GREEN 并提交。
- 每个 commit 只暂存 plan 指定文件；不得修改 Schema、迁移、生产模块、API route 或 Web。
- 外部 manifest、backup、dump、对象副本和 restore 输出不得进入 Git。
- 所有基础设施测试仅使用本地 Docker 和本次创建的隔离目标。
- 真实目标租户只能读取清单；不得执行真实备份、复制、暂停、恢复或 rollback 之外的 DELETE。
- Task 7 完成后返回标准 HANDOFF；不得将状态改为 `done`。

首轮实现任务：

```text
TASK docs/planning/tasks/full-chain-demo-backup-purge-dry-run-v1.md#B2a-B2g base=<brief-commit-sha> role=implementer workspace=D:\Logixs
```

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
- [ ] fresh Codex 安全与数据完整性复审通过
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

| 日期       | 阶段   | 负责        | commit | 说明                                                                                                                                           |
| ---------- | ------ | ----------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-11 | design | Claude Code | —      | 负责人批准 Brief 2 纯运维脚本方案：Seed 分轨、完整 ownership catalog、三域 manifest、rollback-only dry-run 与隔离恢复演练；无 execute 删除入口 |
