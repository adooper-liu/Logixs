---
status: review
branch: fix/full-chain-sample-empty-protection
verification: "FC1R6 final checkpoint pending: focused 58/58; real v0.5 compiles twice with matching hash to 37 records across six types, 11 informational gaps, 74 checks; publishable=false from one real HBL-scope failure and one real duplicate-key failure; PostgreSQL/MinIO/Temporal deltas all zero; fresh final review pending"
owner: main
writer: main
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

### FC1R5：空保护占位兼容修复

FC1f 进一步核对发现，v0.1～v0.5 都由 `openpyxl.Workbook()` 直接生成，生成脚本未启用工作簿保护，但所有版本的 `xl/workbook.xml` 均包含无任何属性的空 `<workbookProtection/>`。这类占位元素没有锁定效果；当前扫描器仅凭元素存在即 exit 3，属于对受控生成器输出的误拒绝。

本片只修复以下行为：

1. 先构造与真实源同构的无属性 `<workbookProtection/>` fixture，观察当前 `inspectXlsxArchive()` RED；最小修改为允许空元素。
2. 继续拒绝任何带属性的工作簿保护，包括 `lockStructure`、`lockWindows`、`lockRevision`、password/hash/salt/spin 等，无论属性值为何；已有 protection 测试不得放宽。
3. 不通过直接删改真实 XLSX 内部 XML、重新打包原件或绕过 fingerprint 解决；修复必须发生在明确的安全语义判断上。
4. 最终运行 XLSX security tests、`pnpm test:full-chain-sample`、lint、scoped format、repo check、diff check，并交回 HANDOFF，不提交、不运行备份/删除/写库/UI。

允许写入：

```text
scripts/full-chain-sample/xlsx-security.mjs
scripts/full-chain-sample/xlsx-security.test.mjs
scripts/full-chain-sample/test-support.mjs（仅 fixture 必需时）
```

FC1R5 通过后由主代理立即重跑 FC1f 两次真实编译和三域零写入验证。

### FC1R6：真实 v0.5 结构与分级适配

FC1R5 后真实 v0.5 已通过安全扫描并两次确定性生成诊断包，package hash 一致、三域变化均为 0；但 package 为 `publishable=false`，仅有 0 records、48 blocking gaps、9 not-applicable checks。结构对拍确认这是 compiler/policy 与已批准 v0.5 结构不一致，不是进入 Brief 2 的信号：

- 六个 pilot Sheet 不存在“证据等级/证据级别”列，生成器写出时也没有保留 R/D/S/P cell style；当前 `declaredClass` 必然为空。
- `26_样本构建清单` 的真实表头是 `工作表 / 行 / 字段 / 值 / 构建依据`；其中“行”是生成器 `row_key`（数据列 2 与 3 用 `/` 连接），不是 policy business key，也不是 Excel 行号。当前索引器读取不存在的 `行 identity`。
- `25_推导依据` 的 ID 列是 `编号`，当前索引器读取不存在的 `推导依据ID`；pilot 相关条目只支撑说明/跨表事实，不能静默把所有 mapped cell 判 D。
- policy 多个 payload 输入名与真实表头不符；计划要求报关品名行 evidence-only，当前实现却产生 11 个 blocking gaps。

本片只完成以下适配：

1. `WorkbookScan` 为每行提供稳定的生成器 row-key（数据列 2 与 3，外层空白规范化后以 `/` 连接），不把它当 record business key；测试证明 26 清单可按 `工作表 + row-key + 字段` 命中 S。
2. provenance 索引读取真实列名：26 的 `工作表/行/字段`，25 的 `编号/性质/支撑的样本表/字段`；保留旧别名仅用于测试兼容时必须显式说明。重复 key 继续稳定 conflict。
3. 移除对不存在的 row-level “证据等级”列的依赖。逐 mapped field 分类顺序固定为：26 命中且 policy 允许 override → S；明确 P/未授权/冲突 → blocking gap；可唯一绑定批准“推导”的字段 → D；否则只有 policy 字段明确 `directSource=true` 才为 R。不得用默认 R 掩盖未知。
4. 仅按既有 plan 六类 record 和 cross-reference 修正 policy 到真实表头：
   - shipment plan：`合并备货单`、`订舱号/SO`；
   - booking：`主备货单号`、`MBL`、`HBL/AMS`；
   - cargo ready：`主备货单号`、`数量合计`，不虚构当前表没有的 SKU/数量单位；
   - stuffing：`装载数量`、`毛重kg`、`体积m³`；
   - customs：`分提单`、`报关金额`；
   - dispatch：沿用当前真实表头。
     对应 canonical payload allowlist 与 checks 只做上述既有语义的同步，不增加新 record 类型。
5. `层级=品名行` 按 plan 作为 informational/evidence-only gap，不阻断 publishable；只有 status=`blocking` 的 gap 才阻止发布。P、未分类、无稳定键和 failed checks 继续阻断。
6. 新增一份只含结构、虚构值和 R/D/S/P 组合的 v0.5-like fixture，证明六类 records 可生成、S 由 26 命中、P 不进 records、品名行不阻断、mapping 与 33 Sheet policy 一致。不得复制真实业务值、hash 或 workbook 行。

允许写入：

```text
scripts/full-chain-sample/workbook-scan.mjs
scripts/full-chain-sample/xlsx-security.mjs
scripts/full-chain-sample/classification.mjs
scripts/full-chain-sample/classification.test.mjs
scripts/full-chain-sample/compile-records.mjs
scripts/full-chain-sample/compile-records.test.mjs
scripts/full-chain-sample/reconcile.mjs（仅字段同步）
scripts/full-chain-sample/contracts.mjs（仅 allowlist 同步）
scripts/full-chain-sample/policies/v0.5.json
scripts/full-chain-sample/schemas/policy.schema.json（仅 policy 表达能力必需时）
scripts/full-chain-sample/test-support.mjs
```

每项先 RED 后 GREEN。最终运行相关单测、`pnpm test:full-chain-sample`、lint、scoped format、repo check、diff check，交回 HANDOFF，不提交、不执行备份/删除/写库/UI。主代理随后再次运行 FC1f。

### FC1R6F1：真实 v0.5 反证修复

FC1R6 focused 48/48 不能关闭真实结构验收。主代理在未提交 diff 上重跑真实 v0.5，得到 9 records、68 gaps、21 checks，仍有 25 `BUSINESS_KEY_MISSING`、29 `PROVENANCE_CONFLICT`、2 `DATE_PRECISION_REQUIRED`、1 `CODE_INVALID` blocking gaps。必须修复以下偏差：

1. `generatorRowKey()` 必须与生成器 `row_key()` 完全一致：数据列 2 和 3以 `" / "` 连接。测试 fixture 也必须使用该格式；不得用 `A/B` 自证。
2. 25 表只有单列 `支撑的样本表/字段`，不得读取不存在的 `支撑的样本表` 和 `字段`。只有能从该单列唯一解析到 `Sheet + exact mapped field` 的批准“推导”才绑定 D；“说明”、跨表模糊文本或零/多字段命中不得绑定。
3. 恢复 plan 规定的六类业务主键，不得用 cross-reference 代替：shipment=`出运计划编号`、booking=`订舱编号`、cargo-ready=`备货单号`、stuffing=`柜号+备货单号+SKU+分提单`、customs=`报关发票号`、dispatch=`柜号`。cross-reference 只进入 payload。
4. policy payload 只使用真实表头，但不得删除计划所需业务身份：shipment 使用 `合并备货单` 作为 cargo-ready refs、`订舱号/SO` 作为 booking ref；booking 使用 `主备货单号`、`MBL`、`HBL/AMS`；cargo-ready 使用 `主备货单号` 和 `数量合计`；stuffing 使用 `备货单号/SKU/分提单/装载数量/毛重kg/体积m³`；customs 使用 `报关发票号/分提单/报关单号/报关金额/币种`。
5. normalization 不得对一般文本字段套 `normalizeCode()`：船名允许空格和非 ASCII；code 规则只用于稳定编号字段。日期 precision/timezone 必须由 policy 字段级配置或已映射字段明确提供；真实 v0.5 的 `日期精度` 文本如不符合已批准枚举，产生清晰 gap，不得猜机器时区。
6. 真实 v0.5 再跑必须至少满足：六类 record type 均有记录；不存在 `BUSINESS_KEY_MISSING`、因索引错误造成的 `PROVENANCE_CONFLICT` 或错误 `CODE_INVALID`；informational 品名行不阻断。其他真实 P/日期缺口可使 exit 2，但必须是来源事实而非 mapping 缺陷。

保持 FC1R6 原写入范围。新增真实结构回归必须使用脱敏结构 fixture，不复制真实业务值。最终交回除 focused tests 外，必须报告一轮真实 v0.5 的脱敏摘要（exit、六类 record counts、gap/check code counts），不得回显路径、hash 或业务值。

### FC1R6F2：剩余真实结构与对账语义修复

FC1R6F1 focused 50/50 后，主代理真实 v0.5 probe 已生成 24 records（shipment 2、booking 2、cargo-ready 3、stuffing 15、customs 2），但缺 dispatch，且仍有 39 provenance conflict、1 construction override、2 date precision blocking gaps 和 2 quantity check failures。根因已经只读定位：

1. provenance conflict 不能按整个 workbook 全局阻断 Brief 1：29 个重复键来自 unsupported Sheet。仅 pilot mappings 实际消费的 provenance 冲突可以阻断 package；其他 Sheet 保留在 evidence-only/unsupported 诊断，不进入 package-level blocking gap。
2. `11_装箱` 的 26 清单 row-key 为 `柜号 / 封号`，同柜多 SKU 行会共享 row-key；必须使用 `工作表 + row-key + 字段 + 原始值` 精确匹配 construction evidence。完全相同的重复清单行可幂等折叠；同 key 但值或依据冲突时才 `PROVENANCE_CONFLICT`。不得把原始值写入 gap/log/package，只用于内存匹配与 hash。
3. customs 有一条报关票被 26 清单明确标记为 S，五个 mapped 字段都应在 policy 显式允许 construction override；未命中 26 的其他票仍按批准 direct source 为 R。
4. dispatch 日期字段需要 policy 字段级 normalization：`进港日期`、`ATD/出运日期`、`母船出运日期` 的 precision/timezone 必须显式声明。真实表内 `日期精度` 只描述出运日期且文本不是当前枚举，不能直接当机器参数；本片只能采用已经由 source/业务权威明确的 date-only 与起运港 UTC+08:00 口径。若 policy 无配置则继续 gap，不从机器时区猜测。
5. quantity reconciliation 只在 cargo-ready 有一个或多个 stuffing 子行且双方数量都存在时适用。无任何子行的 cargo-ready record 必须 `not_applicable`，不得 fail；有子行但合计不等继续 fail。weight/volume 同理遵循适用性，不以缺子行冒充 mismatch。
6. 真实 v0.5 再跑最低验收：六类 record type 均有记录；不存在因 unsupported Sheet、row-key 碰撞或无子行对账造成的 false blocking；两次 hash 一致；三域变化 0。真实 P 或真实数据不一致仍可 exit 2，但必须按稳定 code 如实留下。

允许写入沿用 FC1R6，并允许修改 `scripts/full-chain-sample/schemas/policy.schema.json` 表达字段级 normalization。新增测试必须使用脱敏 fixture，覆盖：同 row-key 不同值精确 S 匹配、完全重复折叠、冲突值阻断、unsupported provenance 不阻断、dispatch policy 日期规范、无子行 quantity `not_applicable` 与有子行 mismatch `fail`。

最终交回必须包含 focused tests 和真实 v0.5 的脱敏摘要；不得仅报告测试计数，不提交，不进入备份/删除/写库/UI。

### FC1R6F3：最后两类适配误判修复

FC1R6F2 focused 53/53 后，真实 v0.5 已生成六类共 26 records；剩余 12 provenance conflict、1 dispatch date 阻断和 1 HBL scope failed check。主代理只读分析确认：HBL scope 中两票能匹配 stuffing、一票既不在 stuffing 也不在 booking，属于真实来源范围缺口，应保留 failed check；不得为追求 `publishable=true` 放宽。其余两类属于 compiler 适配误判：

1. construction index 不得在仅 `sheet + row-key + field` 层面把不同 raw value 标成 conflict。索引应保留同 key 下按规范化 raw value 分组的候选；完全相同 value+basis 幂等折叠；同 raw value 但 basis 冲突才阻断；分类时以当前 cell raw value 精确选择唯一候选。不同 raw value 是同柜多 SKU 的合法清单行，不构成冲突。
2. unsupported Sheet provenance 继续不进入 pilot blocking；package-level conflict gap 只为实际消费并在 raw-value 匹配后仍冲突的 pilot cell 产生一次，不得按 record 重复放大。
3. dispatch 的真实受控格式包括 ISO date、`M/DD/YYYY` 和 `YYYY-MM-DD HH:mm:ss`。policy 字段级 normalization 必须显式声明允许格式集合及 `+08:00`，规范化到 ISO；不接受任意字符串、不依赖机器 locale/timezone。测试覆盖三种允许格式和至少两个非法格式。
4. `日期精度` 是源业务描述字段，可保留原文，不作为 normalization 参数；precision/timezone 只来自 policy。
5. 真实 FC1f 验收：六类 records 仍齐全；`PROVENANCE_CONFLICT` 与 `DATE_PRECISION_INVALID` 的上述 false blocking 清零；HBL scope 真实 failed check 原样保留；两次 package hash 一致，三域变化 0。允许 exit 2/publishable=false，因为诊断 package 的职责就是诚实暴露真实来源缺口。

沿用 FC1R6 写入范围。新增 fixture 不得复制真实值。最终交回必须附真实 v0.5 脱敏摘要，不提交、不进入备份/删除/写库/UI。

### FC1R6F4：分提单引用文本兼容

FC1R6F3 focused 56/56 后，真实 v0.5 六类共 27 records；provenance/date false blocking 已清零，仅剩 stuffing 的 10 个 `CODE_INVALID`、11 个 informational 品名行和 1 个真实 HBL scope failed check。结构核对确认这 10 行全部来自 `分提单` 的带空格引用文本，其他 stuffing 编号字段均为单 token。

本片只修复：

1. `houseBillNo`/分提单按规范化文本处理：NFC、CRLF→LF、外层 trim，保留内部空格；不得静默删空格或拆成多个 HBL。
2. `planNo`、`bookingNo`、`cargoReadyNo`、`containerNo`、`sku`、`invoiceNo`、`declarationNo`、`masterBillNo`、`voyageNo` 继续使用严格 code 校验。
3. 补行为测试：带空格分提单可生成 stuffing record 且业务键稳定；空白值仍失败/缺口；普通 code 字段含空格仍 `CODE_INVALID`。
4. HBL scope failed check 逻辑和真实结果不得放宽。

允许修改：`compile-records.mjs`、`compile-records.test.mjs`，必要时 `test-support.mjs`。最终必须运行 focused tests、完整 `test:full-chain-sample`、lint、scoped format、repo/diff，并附真实 v0.5 脱敏摘要。若真实结果只剩 informational 品名行和已确认 HBL scope failed check，则 FC1R6 验收通过；不提交、不进入备份/删除/写库/UI。

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

| 日期       | 阶段    | 负责        | commit                  | 说明                                                                                                                                                                                                                  |
| ---------- | ------- | ----------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-06 | design  | Claude Code | `83cd4c10`              | 负责人批准全链样本 v0.5 分层编译与 demo 重建设计；只启动 Brief 1                                                                                                                                                      |
| 2026-10-06 | design  | Claude Code | `8721509e`              | 完成六任务 TDD 实施计划，尚未建立 brief 或实现代码                                                                                                                                                                    |
| 2026-10-10 | coding  | Claude Code | `6fc5c380` / `aaafb507` | 将未合并设计和计划接回 PR #151 后的最新 main；建立 Brief 1，准备下发 Codex                                                                                                                                            |
| 2026-10-10 | blocked | Claude Code | `36bc07c7`              | FC1a 尚未下发且无产品差异；按负责人当前优先级暂停，释放唯一 Codex 写入席位给目录减法，目录支线收口后恢复                                                                                                              |
| 2026-10-10 | fix     | Codex       | `4f697bb8`              | 独立复审 5 项均属安全、数据真实性或确定性发布风险；主代理复现后全部接受，授权 FC1R3 唯一修复                                                                                                                          |
| 2026-10-10 | coding  | Claude Code | —                       | 负责人确认五步固定顺序，当前仅完成编译 package；后续备份、仅清 demo 租户、领域 adapter 写库和页面核对均未开始，禁止 Excel 直写数据库                                                                                  |
| 2026-10-10 | review  | Claude Code | `cd1c7bb9`              | FC1R3 五项风险已按行为测试关闭并形成 checkpoint；过期 review 槽已由 PR #162 收口，当前只做 fresh 整体复审，所有后续处置与 FC1f 继续留在同一最终实现 PR                                                                |
| 2026-10-10 | fix     | Claude Code | —                       | fresh Codex 最终复审 3 项 high finding 均已独立复现并接受：publishable 可篡改、十进制定点失真、重复 provenance 随行序变化；授权 FC1R4 同分支修复                                                                      |
| 2026-10-10 | coding  | Claude Code | —                       | FC1R4 三条原始反证均转为 GREEN，focused 43/43、lint、repo check、scoped format、diff check 通过；进入 FC1f 只读真实输入诊断和三域零写入验证                                                                           |
| 2026-10-10 | review  | Claude Code | `f7e630ba`              | FC1f 真实 v0.5 输入因 `workbookProtection` 按安全契约 exit 3 失败关闭且未创建输出；PostgreSQL demo 行、MinIO bucket/object、Temporal schedule/workflow 前后差值均为 0。需提供同版本未保护受控导出后重跑才能标 done    |
| 2026-10-10 | fix     | Claude Code | `17e2b58b`              | 进一步核对 v0.1～v0.5 与生成脚本后确认均为 openpyxl 生成的无属性空 `<workbookProtection/>`，无实际锁定效果；当前存在性判断误拒绝，授权 FC1R5 精确兼容修复                                                             |
| 2026-10-10 | fix     | Claude Code | —                       | FC1R5 后真实 v0.5 两次 exit 2、hash 一致、三域差值 0；诊断包 33 Sheet/0 records/48 gaps/9 checks。确认真实表头、26 row-key、分级与 policy mapping 不一致，授权 FC1R6 结构适配                                         |
| 2026-10-10 | fix     | Claude Code | —                       | FC1R6 focused 48/48 但真实 probe 仅 9 records、68 gaps，仍有 25 主键缺失、29 provenance 冲突、2 日期精度和 1 code 阻断；fixture 未复现真实 row-key/25 表结构且 policy 改错业务键，进入 FC1R6F1                        |
| 2026-10-10 | fix     | Claude Code | —                       | FC1R6F1 focused 50/50，真实 probe 产 5/6 类共 24 records；剩余阻断来自 unsupported provenance 全局化、stuffing row-key 碰撞、customs S override、dispatch 日期参数及无子行数量对账误判，进入 FC1R6F2                  |
| 2026-10-10 | fix     | Claude Code | —                       | FC1R6F2 focused 53/53，真实 probe 六类共 26 records；剩余 12 provenance 与 1 日期为适配误判，1 HBL scope 为真实来源缺口应保留。进入 FC1R6F3，不以强行 publishable=true 为目标                                         |
| 2026-10-10 | fix     | Claude Code | —                       | FC1R6F3 focused 56/56，真实 probe 六类共 27 records；provenance/date 误判清零，仅 10 个 stuffing 分提单因内部空格误触 code 校验。HBL scope 真实 failed check 保留，进入 FC1R6F4 单点修复                              |
| 2026-10-10 | review  | Claude Code | —                       | FC1R6 最终真实验收：六类 37 records、11 informational gaps、74 checks；两次 exit 2 且 package hash/计数一致，三域差值 0。publishable=false 仅来自 1 个真实 HBL scope 与 1 个真实 stuffing 重复键，进入 fresh 最终复审 |
