---
status: fix
branch: feat/full-chain-sample-compiler-implementation
verification: "FC1R3 checkpoint cd1c7bb9 with 41 focused tests passing; final review reproduced three high findings; FC1R4 authorized below; FC1f not run"
owner: main
writer: codex
risk: high
dependsOn: []
writeScopes:
  - docs/planning/tasks/full-chain-sample-v05-compiler-v1.md
  - docs/planning/tasks/product-npi-visual-flow-return-v1.md
  - docs/superpowers/specs/2026-10-06-full-chain-sample-rebuild-design.md
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

### FC1R1：主代理验收 finding 修复

> FC1R1 只修复 FC1a～FC1e 与已批准 spec/plan 的偏差，不运行 FC1f 真实外部样本，不启动 Brief 2～4。

| Finding                                   | 当前反证                                                                                   | 当前片必须完成                                                                                                                                                                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FC1-BLOCK-001` XLSX 安全反证不足         | 测试只有非法 ZIP 与公式                                                                    | 先 RED 后 GREEN 覆盖宏、外链、连接、路径穿越、大小写不敏感重复成员、symlink-like member、加密/保护内容、entry/展开大小/压缩比、Sheet/行/列/单元格上限；所有项在产生 canonical record 前失败                                              |
| `FC1-BLOCK-002` 未分类值泄漏              | `declaredClass ?? "R"` 会把缺失等级提升为 R                                                | 缺失/未知等级进入 blocking gap；P 永不进 records；构造冲突、D 缺准确 derivation、S 缺 scenario 均失败关闭；policy R 需要明确批准 source reference，construction override 需 policy 显式允许                                              |
| `FC1-BLOCK-003` policy 门禁不足           | 现有测试未证明 33 Sheet 唯一全集、header/fingerprint 漂移和未授权规则拒绝                  | 严格校验 33 个唯一 Sheet、批准 disposition、header row/fingerprint、未知 Sheet/未授权规则失败；六类 pilot mapping 和字段白名单固定                                                                                                       |
| `FC1-BLOCK-004` 编译/对账不完整           | normalize helpers 未接入；checks 只实现 3 类                                               | 实现六类稳定 key；重复 key、cargo/stuffing/booking/dispatch/customs 引用、HBL/MBL、日期/时区、金额/币种、数量/重量/体积、D 重算、品名行、P 排除；接入 normalizeDate/Decimal/List/Code；实现 plan 全部九个稳定 check code                 |
| `FC1-BLOCK-005` manifest/package 契约不足 | package manifest schema 只要求 source/hash/publishable，package validation 不校验 manifest | 按 spec 校验 source alias/fingerprint 元数据、workbook 版本/Sheet 数、compiler/mapping/policy/Git 版本、package hash、record/gap/check 数量与 hash、publishable、允许/禁止证明、敏感处理声明；package validation 必须验证 manifest       |
| `FC1-BLOCK-006` 原子发布/CLI 隐私未证明   | 只测成功写包和已有输出；CLI 只测缺参数                                                     | 已有输出不改写；写/rename 失败只清理本次 staging、保留 sibling；publishable false=exit2 诊断包，unsafe=3 无输出，output/publish=4，valid=0；stdout/stderr 不泄露绝对路径、原始值、完整 hash；Windows/Linux 路径和换行不影响 package hash |

#### FC1R1 写入范围

仅允许修改现有 frontmatter `writeScopes` 中与 finding 直接相关的：

```text
scripts/full-chain-sample/**
scripts/compile-full-chain-sample.mjs
scripts/compile-full-chain-sample.test.mjs
package.json
.gitignore
```

不得修改 NPI brief、业务权威、数据库、API、Web、迁移、Seed、MinIO、Temporal 或外部系统。不得提交 workbook、source manifest、package、records、lineage、gaps、checks、report、绝对路径、完整 hash 或商业值。

#### FC1R1 RED / GREEN 命令

按 finding 分组先新增真实失败测试并逐组观察 RED；禁止一次写完实现后补测。最终 GREEN 至少执行：

```text
node --test scripts/full-chain-sample/contracts.test.mjs
node --test scripts/full-chain-sample/xlsx-security.test.mjs
node --test scripts/full-chain-sample/classification.test.mjs
node --test scripts/full-chain-sample/compile-records.test.mjs
node --test scripts/full-chain-sample/package-writer.test.mjs scripts/compile-full-chain-sample.test.mjs
pnpm test:full-chain-sample
pnpm lint
pnpm format:check
pnpm repo:check
git diff --check
```

#### FC1R1 停止条件

- 六组 finding 均有对应 RED→GREEN 证据；
- `pnpm test:full-chain-sample` 覆盖 plan 五项 Review Focus，不再只保留烟雾测试；
- 返回标准 `HANDOFF` + `logix-handoff/v1`，列出每组测试名、RED 失败原因、GREEN 计数和未运行的 FC1f；
- 不提交实现；是否形成 checkpoint/提交由主代理验收后决定。

### FC1R2：剩余可复现缺陷与行为反证

> FC1R1 增加到 25 项测试，但主代理逐项核对实现后仍存在以下可复现缺陷。FC1R2 只关闭这些项目，不重复已绿范围，不运行 FC1f。

1. **Symlink 检查恒为假**：`(entry.externalAttributes >>> 16) & (0xf000 === 0xa000)` 将右侧比较先算成 boolean，永远无法识别 symlink。先构造 symlink-like central-directory member 观察 RED；修正为对 mode bitmask 的正确比较，并覆盖大小写重复成员、encrypted flag、workbook protection。测试必须真实构造对应 ZIP 元数据，不能只循环几个普通文件名。
2. **Policy 仍不能表达已批准 source / construction override**：当前 `approvedDirectSources` 从所有 payload 字段自动生成，等于默认批准；`policy.schema.json` / v0.5 policy 没有 `constructionOverrideAllowed` 或字段级 source reference。按 plan 为每个 pilot 字段显式声明 direct-source approval 和 construction override；没有批准的 R、未批准的 S override 均进入 blocking gap。补 33 Sheet 唯一全集、未知 Sheet、header fingerprint drift 和 conversation-only/未授权 policy rule 的失败测试。
3. **对账测试不能只断 code 存在**：为九个稳定 check code 各构造至少一个真实 pass/fail 或 applicable/not-applicable 场景。必须覆盖重复 key、缺 cargo-ready、stuffing 断链、MBL mismatch、customs HBL scope、date order、quantity/weight/volume mismatch、D recomputation mismatch。若真实业务字段不足以计算某项，policy 必须显式声明 `not_applicable` 原因，不能在 `runPackageChecks` 末尾无条件补码冒充完成。
4. **Normalization 接入需行为测试**：用 `compilePilotRecords` 真实输入证明非法日期/精度/时区、金额、code 产生 blocking gap 且不产 record；合法金额输出定点字符串、Refs 输出数组。不得只直接测试 helper。
5. **Manifest 仍缺 Git commit 与完整 source 元数据**：按 spec 增加 `gitCommit`（由调用上下文显式传入，不由编译器执行 git）、最后修改时间或明确受控 manifest 版本字段、lineage hash/count，并在 schema/validation/hash projection 中核对；测试篡改 counts/hashes/manifest/packageHash 必须被拒绝。不得在日志输出这些值。
6. **原子失败与 CLI exit/privacy 仍缺覆盖**：注入 write/rename 失败，证明只清理本次 staging 且 sibling/既有输出不变；真实 CLI synthetic fixtures 覆盖 valid=0、diagnostic publishable=false=2、unsafe source=3 且无输出、existing/publish failure=4；stdout/stderr 不含绝对路径、secret/raw value、完整 source/package hash。`publishable=false` 仍可写诊断包，但不得打印成功发布语义。
7. **测试真实性**：测试必须断行为和产物，不得以“所有 check code 被自动补成 `not_applicable`”或只断测试名/计数关闭 finding。FC1R2 完成后 `pnpm test:full-chain-sample` 的测试数不是验收标准，以上场景逐项通过才是标准。

FC1R2 写入范围、禁止范围和最终命令沿用 FC1R1；返回 HANDOFF 时逐条映射 1～7 的 RED/GREEN 测试名与结果。

### FC1R3：独立复审真实风险修复

独立复审 5 项 finding 均已复现并接受，只修以下风险：

1. `S` 必须有匹配的 `26_样本构建清单` 且 policy 允许 override；`D` 引用的 derivation `性质` 必须是批准的“推导”，候选/事实不得冒充 D。
2. 日期必须严格校验真实日历；`2026-02-31` 等不得滚入 3 月。datetime 必须按显式时区解释；ExcelJS Date 对象必须可靠规范化。
3. `originalValueHash` 必须覆盖原始映射源值，不得对 normalize 后 payload 求 hash；`1,234.00` 与 `1234.00` 必须得到不同 source hash。
4. 公式检查覆盖 header row 及其之前所有非空单元格，任何公式在读取为 header/元数据前失败关闭。
5. canonical/package 排序不得使用 locale-dependent `localeCompare`；改用明确 UTF-8/Unicode code-point 字节稳定比较，并用非 ASCII key 证明跨 locale 一致。

每项先写可复现 RED，再最小 GREEN。不得顺手补元数据、扩测试矩阵或改 FC1f。最终只跑对应 focused tests、`pnpm test:full-chain-sample`、lint、scoped format、repo check、diff check，返回 HANDOFF，不提交。

### FC1R4：最终复审高风险修复

fresh Codex 最终复审的三项 high finding 均由主代理独立复现并接受。本片只修以下边界，不运行 FC1f：

1. `FC1-FR01`：package hash 必须覆盖 `publishable`、允许证明、禁止证明和敏感处理声明；`validatePackageArtifacts()` 必须从 gaps/checks 重新计算 publishable，并拒绝 manifest 声明与重算结果不一致。先以“blocking gap + 篡改 publishable=true 仍被接受”观察 RED，再 GREEN。
2. `FC1-FR02`：金额、数量、重量、体积的十进制定点规范化不得经过 JavaScript `Number`。严格拒绝非法分组、指数、非十进制和超出已批准格式的输入；用字符串算法输出定点值，覆盖 `9007199254740993` 不失真、`1,2,3` 拒绝以及既有合法分组/小数。不得新增依赖。
3. `FC1-FR03`：`25_推导依据` 与 `26_样本构建清单` 的重复业务键不得由 `Map.set` 覆盖。相同 key 的重复行无论值相同或冲突均产生稳定 blocking provenance conflict；反转行顺序不得改变结果。冲突必须在分类前失败关闭，不能由后出现行胜出。

写入范围只允许：

```text
scripts/full-chain-sample/canonical-json.mjs
scripts/full-chain-sample/contracts.mjs
scripts/full-chain-sample/contracts.test.mjs
scripts/full-chain-sample/classification.mjs
scripts/full-chain-sample/classification.test.mjs
scripts/full-chain-sample/compile-records.mjs
scripts/full-chain-sample/compile-records.test.mjs
```

每项先写行为 RED，再最小 GREEN。最终运行对应单测、`pnpm test:full-chain-sample`、lint、scoped format、repo check、diff check，返回 HANDOFF，不提交，不扩写测试矩阵、不运行 FC1f、不触及备份/删除/写库/UI。

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

负责人 2026-10-10 确认总顺序为：`只读编译 package → 备份 → 仅清 demo 租户旧业务数据 → 领域 adapter 写入演示库 → 页面核对新单据并确认旧演示单消失`。当前只授权第一步；本 brief 不执行备份、删除、写库或页面切换。Brief 1 package 仍只含六类中段 pilot records；市场、选品和产品开发/NPI 留待后续 adapter brief 从同一工作簿承接，禁止 Excel 直写数据库。

以下证据只阻止 FC1f 和任务 `done`，不阻止 FC1a～FC1e 代码交付、PR 审查与合并：

- 受控外部 source 与 source manifest 可读；
- 两次仓外诊断 package hash 一致；
- 33 Sheet 处置与六类 records 的脱敏摘要核对；
- PostgreSQL、MinIO、Temporal 前后计数变化均为 0；
- 不允许证明边界经独立复审未被弱化。

## 进度 log

| 日期       | 阶段    | 负责        | commit                  | 说明                                                                                                                                                   |
| ---------- | ------- | ----------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-10-06 | design  | Claude Code | `83cd4c10`              | 负责人批准全链样本 v0.5 分层编译与 demo 重建设计；只启动 Brief 1                                                                                       |
| 2026-10-06 | design  | Claude Code | `8721509e`              | 完成六任务 TDD 实施计划，尚未建立 brief 或实现代码                                                                                                     |
| 2026-10-10 | coding  | Claude Code | `6fc5c380` / `aaafb507` | 将未合并设计和计划接回 PR #151 后的最新 main；建立 Brief 1，准备下发 Codex                                                                             |
| 2026-10-10 | blocked | Claude Code | `36bc07c7`              | FC1a 尚未下发且无产品差异；按负责人当前优先级暂停，释放唯一 Codex 写入席位给目录减法，目录支线收口后恢复                                               |
| 2026-10-10 | fix     | Codex       | `4f697bb8`              | 独立复审 5 项均属安全、数据真实性或确定性发布风险；主代理复现后全部接受，授权 FC1R3 唯一修复                                                           |
| 2026-10-10 | coding  | Claude Code | —                       | 负责人确认五步固定顺序，当前仅完成编译 package；后续备份、仅清 demo 租户、领域 adapter 写库和页面核对均未开始，禁止 Excel 直写数据库                   |
| 2026-10-10 | review  | Claude Code | `cd1c7bb9`              | FC1R3 五项风险已按行为测试关闭并形成 checkpoint；过期 review 槽已由 PR #162 收口，当前只做 fresh 整体复审，所有后续处置与 FC1f 继续留在同一最终实现 PR |
| 2026-10-10 | fix     | Claude Code | —                       | fresh Codex 最终复审 3 项 high finding 均已独立复现并接受：publishable 可篡改、十进制定点失真、重复 provenance 随行序变化；授权 FC1R4 同分支修复       |
