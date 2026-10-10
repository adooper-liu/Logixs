---
status: blocked
branch: feat/full-chain-sample-compiler-implementation
verification: "design and plan merged via PR #153 at 113d7a4e; FC1a-FC1e implementation pending; temporarily paused before implementation to release the single Codex writer slot for workbench-network-density-v1"
owner: main
writer: codex
risk: high
dependsOn: []
writeScopes:
  - docs/planning/tasks/full-chain-sample-v05-compiler-v1.md
  - docs/planning/tasks/product-npi-visual-flow-return-v1.md
  - scripts/full-chain-sample/**
  - scripts/compile-full-chain-sample.mjs
  - scripts/compile-full-chain-sample.test.mjs
  - package.json
  - .gitignore
exclusiveLocks:
  - root-tooling
  - external-sample-compiler:full-chain-v0-5
sharedIntegrationScopes:
  - docs/planning/tasks/product-npi-visual-flow-return-v1.md
authorityRefs:
  - AGENTS.md
  - docs/superpowers/specs/2026-10-06-full-chain-sample-rebuild-design.md
  - docs/superpowers/plans/2026-10-06-full-chain-sample-compiler.md
---

# 任务：全链路样本 v0.5 编译门禁

> 本 brief 是已批准设计中 Brief 1 的唯一活动交付载体。业务和安全边界只引用既有 spec，逐步实现只引用既有 plan；不建立第二套样本需求或重写计划。

## 目标

建立只读、确定性、失败关闭的全链路样本编译器，把仓外别名
`full-chain-workbench-sample-v0.5` 转换为可审计 canonical package。Brief 1 只证明来源、分级、缺口、检查和 package 可重复生成，不证明任一工作台闭环、真实经营结果或 demo 已切换。

## 边界 / 不做

- 只实现扫描、R/D/S/P 分级、六类 pilot records 编译、对账、诊断报告和原子输出。
- 不连接或写入 PostgreSQL、MinIO、Temporal、API、Web、Seed、迁移或生产系统。
- 不执行 demo 清理、备份恢复、领域 adapter 或 demo 租户切换。
- 不提交真实 workbook、外部 manifest、完整 package、records、lineage、gaps、checks、report、绝对路径、完整 hash 或商业原值。
- 不把 `R` 自动采信为权威事实，不把 `D` 改名为来源事实，不把 `S` 冒充实际发生，不让 `P` 进入 records。
- 不从样本反推业务规则、状态机、阈值、时限、费用口径、KPI 或工作台完成度。
- 不新增依赖；只使用仓库锁定的 Node、ExcelJS、JSZip、AJV 和现有工具链。

## 已定安全与证据政策

| 决策   | 已定结论                                                                                   | 权威                      |
| ------ | ------------------------------------------------------------------------------------------ | ------------------------- |
| FC-D01 | 只读编译器 + 领域 adapter，禁止整包 Excel 直导数据库                                       | spec §2.3                 |
| FC-D02 | `R/D/S/P` 保持独立语义；`P` 只进 gaps                                                      | spec §2.2、§5.3           |
| FC-D03 | 同输入、编译器、mapping 和 policy 产生同 package hash                                      | spec §4.1、§6.5           |
| FC-D04 | 当前只启动 Brief 1；Brief 2～4 不在本任务实现                                              | spec §2.4                 |
| FC-D05 | 六个 pilot records 只覆盖来源较强的中段链路；其余 Sheet 显式 evidence-only/gap/unsupported | spec §4.1、plan Task 3～4 |
| FC-D06 | 真实删除必须等 Brief 4 精确 manifest、恢复演练和当次负责人授权                             | spec §2.1、§4.1           |

## 数据事实三轨

| 轨道                 | 当前事实                                                   | 本片处理                       |
| -------------------- | ---------------------------------------------------------- | ------------------------------ |
| `current_physical`   | 仓库当前没有 v0.5 importer、demo purge 或三域统一恢复命令  | 不补建；Brief 1 保持零外部写入 |
| `approved_gap`       | v0.5 需要结构扫描、证据分级、确定性 package 和失败关闭门禁 | 按 spec/plan 实现编译器        |
| `industry_candidate` | 无；本片不引入行业规则或从样本推导业务政策                 | 不适用                         |

## 直接消费者与后续承接

- 当前消费者：Brief 1 的仓外诊断运行和独立安全/数据真实性复审。
- 后续消费者：Brief 2 的清理准备和 Brief 3 的隔离租户 adapter；两者只能消费 `publishable=true`、版本/hash 一致的 package。
- Brief 4 demo 切换仍需单独删除授权；Brief 1 完成不自动启动或授权 Brief 2～4。

## 执行切片与代理交接

六个切片共用当前任务分支和最终 PR。实现步骤、接口、RED/GREEN 顺序和逐任务提交以
[`2026-10-06-full-chain-sample-compiler.md`](../../superpowers/plans/2026-10-06-full-chain-sample-compiler.md) 为唯一实现计划。

### FC1a：Canonical contracts 与确定性 JSON

| 项目     | 内容                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------- |
| 基线     | brief 提交 SHA                                                                                      |
| 执行角色 | Codex（GPT-5.6）实现执行器                                                                          |
| 写入范围 | `scripts/full-chain-sample/schemas/**`、`contracts.mjs`、`canonical-json.mjs`、`contracts.test.mjs` |
| 禁止范围 | 不读取真实 workbook；不写任何外部系统                                                               |
| 验证命令 | `node --test scripts/full-chain-sample/contracts.test.mjs`，先 RED 后 GREEN                         |
| 停止条件 | 按 plan Task 1 提交；接口或 schema 与 spec 冲突时返回 `blocked`                                     |

### FC1b：安全 XLSX 扫描器

| 项目     | 内容                                                                                   |
| -------- | -------------------------------------------------------------------------------------- |
| 基线     | FC1a 提交 SHA                                                                          |
| 执行角色 | Codex（GPT-5.6）实现执行器                                                             |
| 写入范围 | `xlsx-security.mjs`、`workbook-scan.mjs`、`test-support.mjs`、`xlsx-security.test.mjs` |
| 禁止范围 | ExcelJS 解析前不得跳过 ZIP/XML 安全预检；不得记录原始值或绝对路径                      |
| 验证命令 | `node --test scripts/full-chain-sample/xlsx-security.test.mjs`，先 RED 后 GREEN        |
| 停止条件 | 按 plan Task 2 提交；无法安全拒绝恶意/漂移输入时返回 `blocked`                         |

### FC1c：v0.5 policy 与 R/D/S/P 分级

| 项目     | 内容                                                                                  |
| -------- | ------------------------------------------------------------------------------------- |
| 基线     | FC1b 提交 SHA                                                                         |
| 执行角色 | Codex（GPT-5.6）实现执行器                                                            |
| 写入范围 | `policies/v0.5.json`、`policy.mjs`、`classification.mjs`、`classification.test.mjs`   |
| 禁止范围 | policy 不含商业原值；不得静默解决来源冲突或让 P/未分类值进入 records                  |
| 验证命令 | `node --test scripts/full-chain-sample/classification.test.mjs`，覆盖恰好 33 个 Sheet |
| 停止条件 | 按 plan Task 3 提交；Sheet/表头事实无法从受控结构证据确认时返回 `blocked`             |

### FC1d：六类 pilot records 与跨 Sheet 对账

| 项目     | 内容                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------- |
| 基线     | FC1c 提交 SHA                                                                                  |
| 执行角色 | Codex（GPT-5.6）实现执行器                                                                     |
| 写入范围 | `compile-records.mjs`、`reconcile.mjs`、`compile-records.test.mjs`、必要的 `v0.5.json` mapping |
| 禁止范围 | 仅编译 plan 指定的六类记录；不得为 unsupported Sheet 建表、契约或 adapter                      |
| 验证命令 | `node --test scripts/full-chain-sample/compile-records.test.mjs`，先 RED 后 GREEN              |
| 停止条件 | 按 plan Task 4 提交；键或引用歧义不能失败关闭时返回 `blocked`                                  |

### FC1e：原子 package writer 与 CLI

| 项目     | 内容                                                                                                                                      |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 基线     | FC1d 提交 SHA                                                                                                                             |
| 执行角色 | Codex（GPT-5.6）实现执行器                                                                                                                |
| 写入范围 | `package-writer.mjs`、测试、CLI、`package.json`、`.gitignore`                                                                             |
| 禁止范围 | 不覆盖既有输出目录；失败 package 不得表现为成功发布；不回显路径、原值或完整 hash                                                          |
| 验证命令 | `node --test scripts/full-chain-sample/package-writer.test.mjs scripts/compile-full-chain-sample.test.mjs`；`pnpm test:full-chain-sample` |
| 停止条件 | 按 plan Task 5 提交；输出原子性、确定性或日志脱敏不成立时返回 `blocked`                                                                   |

### FC1f：真实输入诊断与最终门禁

| 项目     | 内容                                                                                                                                                                    |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 基线     | FC1e 提交 SHA                                                                                                                                                           |
| 执行角色 | 主代理编排受控运行；发现缺陷时由 Codex（GPT-5.6）按回归测试修复                                                                                                         |
| 写入范围 | 无缺陷时仅本 brief 记录计数/结论；有缺陷时仅对应 compiler/test 文件                                                                                                     |
| 禁止范围 | 原件、外部 manifest、完整输出、截图、hash 和业务值不得进入 Git、聊天或模型输出                                                                                          |
| 验证命令 | plan Task 6 原命令；`pnpm test:full-chain-sample`、`pnpm test`、`pnpm lint`、`pnpm format:check`、`pnpm typecheck`、`pnpm build`、`pnpm repo:check`、`git diff --check` |
| 停止条件 | 缺外部路径/manifest、source 安全或 fingerprint 失败、外部系统计数非零变化时 `blocked`；不得放宽门禁                                                                     |

实现执行器首轮任务：

```text
TASK docs/planning/tasks/full-chain-sample-v05-compiler-v1.md#FC1a-FC1e base=<brief-commit-sha> role=implementer workspace=D:\Logixs
```

实现完成后必须交回 `HANDOFF` + `logix-handoff/v1`，列出每个 plan Task 的提交、RED/GREEN 检查和未运行的 FC1f 外部证据；不得将状态写成 `done`。

## 验收

- [ ] 六个 canonical schema 严格拒绝未知字段，P、缺 derivation 的 D、缺 scenario 的 S 均不可进入 records
- [ ] ZIP/XML 滥用、宏、外链、连接、加密、公式、路径穿越、重复成员和资源上限全部在解析/发布前失败关闭
- [ ] policy 恰好覆盖 33 个 Sheet，处置为 records / evidence-only / gap / unsupported
- [ ] 只生成六类 pilot records；重复键、歧义 alias、断链、非法类型/时间/金额均使 package 不可发布
- [ ] package hash 排除时间、操作人、本地路径等易变字段；Windows/Linux 路径和换行不影响结果
- [ ] 输出使用新目录和原子 rename；既有目录、半成品和 `publishable=false` 不会冒充成功发布
- [ ] stdout/stderr、fixture、Git diff 不含绝对路径、商业原值、完整 fingerprint 或敏感标识
- [ ] 编译器没有 Prisma、数据库、AWS/MinIO、Temporal、API 或 Web 依赖
- [ ] 相同真实输入两次 package hash 一致；PostgreSQL、MinIO、Temporal 前后变化均为 0
- [ ] fresh Codex 独立复审覆盖 plan 的五项 Review Focus，`writes: none`
- [ ] 完整 Brief 1 门禁通过；任何环境阻断如实记录

## Deployment / done gate

以下证据只阻止 FC1f 和任务 `done`，不阻止 FC1a～FC1e 代码交付、PR 审查与合并：

- 受控外部 source 与 source manifest 可读；
- 两次仓外诊断 package hash 一致；
- 33 Sheet 处置与六类 records 的脱敏摘要核对；
- PostgreSQL、MinIO、Temporal 前后计数变化均为 0；
- 不允许证明边界经独立复审未被弱化。

## 进度 log

| 日期       | 阶段    | 负责        | commit                  | 说明                                                                                                     |
| ---------- | ------- | ----------- | ----------------------- | -------------------------------------------------------------------------------------------------------- |
| 2026-10-06 | design  | Claude Code | `83cd4c10`              | 负责人批准全链样本 v0.5 分层编译与 demo 重建设计；只启动 Brief 1                                         |
| 2026-10-06 | design  | Claude Code | `8721509e`              | 完成六任务 TDD 实施计划，尚未建立 brief 或实现代码                                                       |
| 2026-10-10 | coding  | Claude Code | `6fc5c380` / `aaafb507` | 将未合并设计和计划接回 PR #151 后的最新 main；建立 Brief 1，准备下发 Codex                               |
| 2026-10-10 | blocked | Claude Code | `36bc07c7`              | FC1a 尚未下发且无产品差异；按负责人当前优先级暂停，释放唯一 Codex 写入席位给目录减法，目录支线收口后恢复 |
