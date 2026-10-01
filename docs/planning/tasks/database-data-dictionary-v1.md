---
status: review
branch: feat/database-data-dictionary-v1
owner: codex
writer: claude
risk: medium
dependsOn: []
writeScopes:
  - docs/planning/tasks/database-data-dictionary-v1.md
  - scripts/generate-data-dictionary.mjs
  - scripts/generate-data-dictionary.test.mjs
  - scripts/data-dictionary/**
  - database/dictionary/**
  - package.json
  - pnpm-lock.yaml
  - .github/workflows/ci.yml
  - .prettierignore
  - docs/INDEX.md
  - docs/architecture/DATABASE_SCHEMA_CONTRACT_V1.md
exclusiveLocks:
  - database-dictionary
  - generated:database-catalog
  - root-tooling
  - repository-governance
  - database-contract
sharedIntegrationScopes:
  - package.json
  - pnpm-lock.yaml
authorityRefs:
  - docs/architecture/decisions/ADR-013-generated-data-dictionary.md
  - database/schema.prisma
  - database/migrations/**
  - doc/**
  - docs/architecture/DATABASE_SCHEMA_CONTRACT_V1.md
verification: |
  已在隔离 PostgreSQL 完整重放当前迁移并生成 112 张表、1,589 个物理字段、278 个 Prisma relation、
  1 个 PostgreSQL enum、477 个当前有效命名 CHECK、505 个唯一索引、2 个函数和 2 个触发器。
  当前 reconciliation findings 为 9 个可空性差异、8 个默认值差异和 5 个 FK 动作差异，均保留在生成字典中。
  首版语义注解覆盖全部对象：83 张表使用 Prisma 中文实施注释，349 个跨表通用字段使用工程规则释义，
  3 个币种字段和 3 个时区字段由正式契约确认，其余语义槽保持 needs_business_confirmation。
  八轮独立复审的 Important/Standards/Spec findings 均已通过 RED→GREEN 修复；专项测试 53/53、
  generate/check、repo:check、contract check/drift、db:generate、lint、format、typecheck、根单测、真实 PostgreSQL
  integration 和 build 已通过。完整 `pnpm validate` 仅在无本任务 Web diff 的主线移动端 shell overflow E2E 失败
  （稳定复现 contentScroll 492 > 381）；本 PR 路径分类 `e2e=false`，由远端必需 `quality` 作最终权威。
  根 workspace 已显式声明 Excel 生成依赖；冻结安装后 security:audit（high 门槛）通过，剩 8 个 moderate。
  ExcelJS 重载确认 10 个 sheet、模块汇总对账 112 表/1,589 字段、字段页 31 列且精确 1,590 行、
  待确认页覆盖全部 112 表/1,589 字段并显示具体维度、0 个公式单元格。人工注解已改为稀疏存储：
  表不保存字段专用槽，字段只持久化 6 个 confirmed 槽。Microsoft Excel 365 原生只读打开通过，
  10/10 sheet 冻结首行与 Table 筛选正常、0 公式/错误/隐藏/合并，源文件打开前后哈希不变；
  原生截图抽查后按内容列宽与 18～72 行高可读。全部 review findings 已完成 disposition，待 PR CI/quality。
---

# 任务：数据库数据字典与业务语义工作簿 V1

> 本 brief 是技术实施与交接载体，不新增第三套业务权威。`doc/` 继续定义业务含义，
> `database/schema.prisma`、有序迁移和隔离库 `pg_catalog` 定义可验证的结构事实。
> Excel 是业务筛选、批注和确认的导出物，不是可反向覆盖仓库注解的第二真相。

## 目标

建立一条可重复执行的数据字典生成链：从当前 Prisma 模型、完整迁移重放后的 PostgreSQL 目录、现有业务权威
和人工审定注解，生成可检索的仓库字典、原生对象清单与业务可评审 Excel。任何不能由证据确定的中文名、用途、
工作台归属或敏感等级必须明确待确认，不根据英文名、UI 文案或历史候选文档臆造。

## 并行启动与停止条件

- 本任务与 `authz-default-deny-v1` 作为首批两个写任务并行；本任务 writer 为 Claude，authz writer 为 Cursor。
- 切片 A 不修改 Schema、迁移、授权控制面或 authz 的 work-execution 模块；两个任务的独占锁不重叠。
- 切片 A 只实现独立提取器，不修改 `package.json` 或 `pnpm-lock.yaml`。根命令接入另设串行切片，届时先同步
  最新 `main`，再把根文件加入 `writeScopes` 并占用 `root-tooling` 锁。
- 全部切片共用本分支，允许形成可回滚提交，但只建立一个最终 PR。

## 权威与冲突处理

| 层级 | 来源                                          | 可证明内容                                                                         | 冲突处理                                       |
| ---- | --------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------- |
| P1   | 隔离数据库完整重放后的 `pg_catalog`           | 当前物理表、列、类型、默认值、可空性、PK/FK/UNIQUE/CHECK、索引、enum、函数、触发器 | 与 Prisma 不一致时登记 finding；不静默选择一边 |
| P1   | `database/schema.prisma` 生成后的 Prisma DMMF | Model、代码属性、映射名、relation 和 ORM 可见类型                                  | 不能覆盖迁移独有对象                           |
| P2   | `doc/`                                        | 业务含义、岗位结果、流程和工作台                                                   | 只有负责人确认内容可标 `confirmed_business`    |
| P3   | 正式契约与字段目录                            | 稳定技术语义、所有者、单位和代码映射                                               | 候选、快照和过时契约不得提升为现行事实         |
| P4   | Schema、迁移和实现代码                        | 实现意图及消费者证据                                                               | 只能标 `confirmed_implementation`              |
| P5   | 无可靠来源                                    | 未知项                                                                             | 标 `needs_business_confirmation`，不得猜测     |

`docs/architecture/DATABASE_SCHEMA_CONTRACT_V1.md` 的 baseline 仍写 96 张目标表，而当前 Prisma 已有 112 个
model；该文档可作历史语义来源，不能再作为当前数量来源，也不继续人工扩写 1,589 个字段。

## 已核验结构基线

以下数字是本任务启动时的静态复算基线，不是永恒常量。生成器必须在每次运行时重新计算，并在变化时通过
`data-dictionary:check` 报告漂移：

| 项目                      | 当前复算值 | 证据与限制                                           |
| ------------------------- | ---------: | ---------------------------------------------------- |
| Prisma model / 预期物理表 |        112 | `schema.prisma`；须与迁移重放后的实际表逐项对账      |
| 物理标量字段              |      1,589 | Prisma model 中非 relation 字段                      |
| Prisma 虚拟 relation      |        278 | 单列关系，不计入物理字段                             |
| PostgreSQL enum           |          1 | 迁移与 Schema 均可复算                               |
| 当前有效命名 CHECK        |        477 | 隔离 PostgreSQL 完整迁移重放后的 `pg_catalog` 实测值 |
| Prisma 未声明的有效索引   |       动态 | 生成器逐项标记，结果见原生对象清单                   |
| 数据库函数                |          2 | 隔离 PostgreSQL `pg_catalog` 实测                    |
| 普通/约束触发器           |          2 | 1 个普通 trigger、1 个 constraint trigger            |
| Prisma 未表达的原生外键   |       动态 | 由 FK 形状与 Prisma DDL 对账，不预填静态数量         |

## 维护结构

不采用 `database/schema/`，避免与根级 `database/schema.prisma` 形成含义冲突。目标结构固定为：

```text
database/dictionary/
├─ dictionary.annotations.json
├─ DATA_DICTIONARY.generated.md
├─ NATIVE_OBJECTS.generated.md
└─ database-data-dictionary.xlsx

scripts/
├─ generate-data-dictionary.mjs
└─ generate-data-dictionary.test.mjs
```

- `dictionary.annotations.json` 是唯一人工维护语义层，只保存不能从结构自动得出的中文名、用途、业务来源、
  模块/工作台关联、敏感级别和各自确认状态；不复制类型、可空性、默认值和约束。
- 采用 JSON 而非 YAML：仓库根当前没有直接 YAML 解析依赖，JSON 可由 Node 原生解析并稳定校验；业务人员不直接
  编辑该文件，而在 Excel 中批注后由 Codex 裁决并回写。
- 三个 `.generated.*` / `.xlsx` 文件均由同一规范化内存模型生成，禁止手工修改。
- Excel 允许业务人员在外部评审副本填写建议列；评审副本不是权威输入，采纳项必须回写注解并重新生成。
- 后续根工具接入切片在 `package.json` 增加稳定入口 `data-dictionary:generate` 与 `data-dictionary:check`；检查模式不得修改文件。

## 语义注解契约

稳定键使用数据库身份 `schema.table.column`，表级键使用 `schema.table`。重命名必须显式迁移注解，禁止靠中文名
或字段顺序匹配。每个表和字段至少包含：

| 字段               | 规则                                                                             |
| ------------------ | -------------------------------------------------------------------------------- |
| `nameZh`           | 有证据时填中文名；无证据统一填 `待业务确认`，不得从英文机械翻译成业务定义        |
| `nameStatus`       | 中文名自己的证据状态                                                             |
| `purposeZh`        | 有证据时写业务用途；未知时写“业务用途待确认；当前仅确认结构与技术消费者”         |
| `purposeStatus`    | 用途自己的证据状态，不得与名称共用一个状态掩盖证据差异                           |
| `sourceRefs`       | 指向 `doc/`、正式契约、Schema、迁移或代码的稳定路径与章节/标识                   |
| `ownerModule`      | 技术写所有者；共享物理表按正式 owner 字段/契约表达，不能只填 Repository 所在模块 |
| `workbenchCodes`   | 零到多个工作台 code；只有 `doc/` 能证明时填写，禁止由模块名或页面路由推导        |
| `sensitivityClass` | 只使用已接受的数据分级代码；当前无全库统一代码时填 `pending_policy`              |
| `notes`            | 冲突、边界或待负责人确认事项；不得藏业务规则                                     |

允许的名称/用途确认状态只有：

- `confirmed_business`：`doc/` 中已有负责人确认语义；
- `confirmed_contract`：正式契约或字段目录可证明；
- `confirmed_implementation`：只能证明技术用途，不能冒充业务定义；
- `needs_business_confirmation`：现有权威不能可靠确定。

状态不是质量分数。名称和用途分别判断；同一字段可以是“名称由契约确认、用途仍待业务确认”。`status`、
`state`、`type`、`code` 等泛化字段没有状态机证据时，不得擅自翻译成具体业务阶段。

## 规范化生成模型

生成器必须先形成单一规范化模型，再投影 Markdown 和 Excel。至少包含：

- 模块、技术所有者、零到多个工作台；
- Prisma model、代码属性、数据库 schema/table/column；
- 中文名、业务用途及各自确认状态；
- Prisma 类型、PostgreSQL 格式化类型、数组/精度；
- 可空性、默认值、generated/identity；
- PK、FK、UNIQUE、索引、CHECK 及其稳定名称；
- 关联方向与 `physical_fk | prisma_relation | logical_reference` 类型；
- 单位、币种、时区语义及证据；
- 快照、版本、审计属性及证据；
- 敏感等级及政策状态；
- 业务来源、结构来源、生成基线 commit、`verifiedThroughMigration`；
- 结构/语义冲突 findings。

`verifiedThroughMigration` 表示该对象已在完整迁移链的哪个末端版本通过目录验证，不伪造“最后一次修改它的迁移”。
只有生成器能可靠识别对象级 DDL 沿革时，才额外输出 `lastChangedMigration`。

## Excel 工作簿

工作簿固定包含以下工作表，均启用冻结表头、筛选、稳定表名和适度列宽；大文本列换行但不得形成不可读高行。
不添加装饰性图表。

| 工作表          | 内容与规则                                                                         |
| --------------- | ---------------------------------------------------------------------------------- |
| `00_使用说明`   | 基线 commit、生成时间、来源、状态含义、回写流程和结构统计                          |
| `01_模块汇总`   | 模块、技术所有者、工作台关联、表数、字段数、待确认数；数字由明细公式或生成模型派生 |
| `02_表清单`     | 表中文名、用途、技术所有者、工作台、确认状态和来源                                 |
| `03_字段清单`   | 1 行 1 个物理字段；不混入 Prisma relation；包含业务评审建议列                      |
| `04_关系清单`   | 分轨列出物理 FK、Prisma relation 和逻辑引用，明确方向与证据                        |
| `05_约束索引`   | PK、UNIQUE、索引和 CHECK 每个对象一行，保留表达式/谓词与 Prisma 覆盖状态           |
| `06_枚举代码`   | PostgreSQL enum、契约状态码和允许值；来源类型必须分开                              |
| `07_原生对象`   | Prisma 未完整表达的索引、函数、普通/约束触发器和原生 FK                            |
| `08_待业务确认` | 从表/字段明细派生的待确认子集，不单独维护                                          |
| `09_来源追溯`   | 规范化 source ID、路径、章节/标识、来源类型、基线 commit 和消费对象数              |

`03_字段清单` 至少包含用户提出的结构、类型、约束、关系、单位/币种/时区、快照/版本/审计、敏感等级、来源和
确认状态列，并把 `nameStatus` 与 `purposeStatus` 分开。业务评审区增加 `建议中文名`、`建议用途`、`确认意见`、
`确认人`、`确认日期`；这些列用于评审副本，不被生成器当作权威回读。

## 边界 / 不做

- 不修改数据库结构、迁移、生产数据或 PostgreSQL COMMENT；
- 不根据字典直接改变业务规则；
- 不用 UI 文案、英文名称、候选文档或历史快照填充业务释义；
- 不把 Prisma relation 虚拟字段计入物理字段；
- 不把技术模块强行映射为单一工作台；
- 不在本任务补建标准物料、Listing 或其他尚未定案的表；
- 不把结构漂移顺带修掉，只产出带证据 finding 并另行立项；
- 全库 Excel 与待确认语义不作为任何工作台、API 或业务切片的前置门禁；
- 生成器只提供提取、注解、Markdown/Excel 投影和漂移检查，不扩成新的全库治理平台或周期性评审循环；
- 不连接、清空或迁移共享/生产数据库；目录提取只允许使用带固定前缀的隔离临时 schema。

## 负责人决策记录

| 决策 ID   | 已知事实与选项                                                                                                      | 推荐与理由                                                              | 负责人结论                                                       | 权威落点 / 状态                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------- |
| `DDD-D01` | A 手工维护 Excel；B 结构自动提取、仓库注解人工审定并投影 Excel；C 只生成仓库 Markdown。A 会持续漂移，C 不便业务筛选 | B；物理事实可复算、业务语义可追溯，Excel 仍适合筛选批注且不成为第二真相 | 采用 B；字段须分轨呈现物理事实、已定缺口和行业候选               | `ADR-013` / approved                              |
| `DDD-D02` | 全局串行会让数据字典无意义等待 OIDC；无限并行又会制造写入冲突                                                       | 有界并行；独立范围同时推进，共享根工具在授权任务合入后串行接入          | 与 OIDC/授权任务并行；Claude 为本任务唯一 writer，Codex 最终收口 | 本 brief + bounded-parallel governance / approved |
| `DDD-D03` | 全库语义逐项定稿和厚生成平台会拖成新的治理循环                                                                      | 首版只确认现有证据可证明项，其余 pending；生成器保持薄                  | Excel 不阻塞工作台，不建立两周治理循环                           | 本 brief / approved                               |

`DDD-D01` 只确定交付与维护机制，不确认任何具体字段的业务含义、敏感等级或工作台归属；这些仍逐项按来源状态审定。

## 执行切片与代理交接

### 切片 A：规范化提取器与结构基线

| 项目     | 内容                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------ |
| 基线     | `f0fc0e159feae1fa61f1449755946d51e1eed7dd`                                                                   |
| 执行角色 | Claude（本任务唯一 writer；Codex 保留语义裁决与最终收口）                                                    |
| 写入范围 | `scripts/generate-data-dictionary.mjs`、对应测试                                                             |
| 行为     | 生成隔离 schema、完整重放迁移、查询 `pg_catalog`、读取生成后的 Prisma DMMF，输出规范化内存模型并检测两者漂移 |
| 禁止范围 | 不生成中文释义，不写 Excel，不改 Schema/迁移/业务文档，不连接 public/共享 schema                             |
| 定向验证 | 脚本测试、生成器 dry-run、112/1,589/278/1/477/2/2 动态复算、FK 对账、lint/typecheck、`repo:check`            |
| 停止条件 | 结构差异可重复、危险数据库 URL 失败关闭、无硬编码数量后 `ready-for-review`                                   |

### 切片 A2：根工具入口串行接入

| 项目     | 内容                                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------------- |
| 前置     | authz 或其他持有 `root-tooling` / 根门禁共享范围的任务完成对应修改；本分支同步最新 `main`             |
| 执行角色 | Claude                                                                                                |
| 调度更新 | 进入本切片前把 `package.json`、必要锁文件加入 frontmatter `writeScopes`，并新增 `root-tooling` 独占锁 |
| 行为     | 接入 `data-dictionary:generate` 与 `data-dictionary:check`；不改变生成模型、Schema、迁移或业务语义    |
| 定向验证 | 两个根命令、脚本测试、`pnpm repo:check`、`pnpm format:check`、`git diff --check`                      |
| 停止条件 | 根入口可重复执行且未覆盖同期根工具改动后 `ready-for-review`                                           |

### 切片 B：注解契约与首版证据映射

| 项目     | 内容                                                                            |
| -------- | ------------------------------------------------------------------------------- |
| 执行角色 | Claude（机械装载；Codex 保留语义裁决）                                          |
| 写入范围 | `database/dictionary/dictionary.annotations.json`、生成器验证测试               |
| 行为     | 从 `doc/`、现行正式契约、Schema/迁移和实现证据建立表/字段语义；未知项显式待确认 |
| 禁止范围 | Claude 不得自行决定业务含义、敏感级别或工作台归属；不得引用 UI 文案作为权威     |
| 定向验证 | 稳定键唯一、全部物理对象均有覆盖或明确待确认、来源路径存在、候选文档未升格      |
| 停止条件 | Codex 抽样高风险字段并处置所有无来源“确认”状态后 `ready-for-review`             |

### 切片 C：Markdown 与 Excel 投影

| 项目     | 内容                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------- |
| 执行角色 | Claude                                                                                              |
| 写入范围 | `database/dictionary/*.generated.md`、`database-data-dictionary.xlsx`、生成器与测试                 |
| 行为     | 从同一规范化模型生成两份 Markdown 和 10-sheet 工作簿；不得分别维护                                  |
| 禁止范围 | 不从 Excel 回读权威语义，不复制一套手工统计逻辑                                                     |
| 定向验证 | 生成稳定性、总数对账、筛选/冻结/数据类型、公式错误扫描、全部工作表视觉检查、`data-dictionary:check` |
| 停止条件 | 工作簿可读且结构/语义追溯完整后交 Claude 独立复审                                                   |

### 切片 D：独立复审与最终收口

- Claude 只读抽查覆盖率、错误释义、证据等级、状态字段语义、工作台误映射、敏感级别和原生对象遗漏；
- Codex 将 findings 逐项处置为 `accepted | rejected | pending-owner`，采纳项回写本 brief 或注解；
- 负责人只确认真正的业务待定项，不被要求审核自动提取的技术事实；
- 风险面稳定后由 Codex 统一运行最终门禁并建立本任务唯一 PR。

## Review notes

- `accepted/fixed`：`STD-01` 已补齐实际 writeScopes、`pnpm-lock.yaml` 与 root-tooling/repository-governance/database-contract 锁。
- `accepted/fixed`：`STD-02` 根 workspace 显式声明 `exceljs@4.4.0`、`jszip@3.10.2`，生成器不再跨 API 私有依赖边界。
- `accepted/fixed`：依赖审计确认 `origin/main` 同样存在 5 个 high；本分支用精确 override 升至 `brace-expansion@1.1.20/2.1.6` 与 `@grpc/grpc-js@1.14.5`，`security:audit --audit-level high` 已通过，剩 8 个 moderate。
- `accepted/fixed`：`SMELL-01` pending 判定提取到中立共享 helper，统计与工作簿复用同一规则。
- `accepted/fixed`：`SPEC-01` 注解改为字段级合并；名称/用途仍 pending 时独立维护的 owner/workbench/sensitivity/notes/source 仍保留。
- `accepted/fixed`：`SPEC-02` 增加单位、币种、时区、快照、版本、审计六个独立证据槽及 Markdown/Excel 投影；仅 3 个币种字段和 3 个时区字段由正式契约确认，其余保持 pending。
- `accepted/fixed`：`SPEC-03` 模块汇总增加模块、技术所有者、工作台三维，并通过父表对账 112 张表与 1,589 个字段。
- `accepted/fixed`：`SPEC-04` 工作台与敏感等级改为独立证据槽；confirmed 槽必须同时有非空值和合格来源，工作台只接受 `doc/` 业务证据。
- `accepted/fixed`：`SPEC-05/SMELL-02` pending 判定覆盖名称、用途、工作台、敏感等级和六语义槽；待确认页显示具体维度并覆盖全部未闭合对象。
- `accepted/fixed`：`SMELL-03` 人工注解改为稀疏存储；表不保存字段专用槽，字段只持久化非默认证据槽，运行模型补 pending 默认。
- `accepted/fixed`：`STD-03/SPEC-06` 统一证据槽状态—值—来源矩阵；pending 只能规范空值且无来源，confirmed 必须状态与 authority 一致，工作台只允许 business confirmation。
- `accepted/fixed`：`STD-04/SPEC-07` 单一 `EVIDENCE_SLOT_POLICIES` 驱动默认、适用对象、校验、pending 和序列化；表级字段专用槽明确拒绝并防御性剥离。
- `accepted/fixed`：`SPEC-08` 来源消费计数纳入 logical references，每个消费对象只计一次。
- `accepted/fixed`：`STD-05` confirmation status 从 `PENDING_STATUS + STATUS_AUTHORITY` 派生唯一冻结集合，名称/用途与证据槽共用。
- `accepted/fixed`：`SPEC-09` bootstrap 在 merge 后、写入前执行完整 validation；无效注解非零失败，writer 不调用且目标 bytes/mtime 不变。
- `accepted/fixed`：`SPEC-10` merge 保留 existing-only 稳定键，由统一 validation 报 table/field orphan；bootstrap、generate、check 均在写入前拒绝，禁止隐式删除人工语义。
- `accepted/fixed`：`SPEC-11` malformed annotation 与非数组 sourceRefs 只产生结构化 shape findings；coverage/orphan 诊断保留，bootstrap 统一失败且不抛原始 TypeError。
- `accepted/fixed`：`STD-06/SPEC-12` 人工注解 JSON 在 merge 前通过本地 AJV 完整结构校验；root/source/table/field/notes/sourceRefs/evidence/logical-reference 任一非法形态只产生确定性 JSON Pointer findings，不进入 writer/renderer。
- `accepted/fixed`：补齐字段类型族、精度、可空性、数组和默认值对账；真实目录保留 22 个可定位结构差异。
- `accepted/fixed`：来源 authority 按 tracked 路径类别校验，logical reference 要求正式契约证据并验证源/目标字段。
- `accepted/fixed`：索引 catalog 查询仅关联本表拥有的 PK/UQ/EXCLUSION constraint；实测 505 行均为唯一稳定键。
- `rejected`：Excel 重复行 finding 与 ExcelJS 重载实测不符；字段 sheet 为 1,589 条明细 + 1 个表头，已加入精确断言。
- `accepted/fixed`：原生对象 Markdown 增加主字典 reconciliation findings 导航，不复制 findings 清单。
- `accepted/fixed`：Excel Table 筛选与 worksheet AutoFilter 重叠会被 Excel 365 拒绝打开；移除重复筛选后原生只读打开、10 表渲染和视觉检查通过。
- `verification-passed`：Microsoft Excel 365（16.0.20326）只读打开无修复警告；10/10 sheet 冻结首行、Table 筛选、列宽/换行正常，0 公式/错误/隐藏/合并，源文件哈希不变。

## 验收

- [x] 隔离 PostgreSQL 完整重放迁移成功，且生成器拒绝 public、共享或无法证明隔离的目标 schema
- [x] 物理表、字段、enum、CHECK、索引、函数、普通/约束触发器和 FK 数量由工具动态复算，无硬编码通过
- [x] 112 个当前 model 与 1,589 个当前物理标量字段无遗漏、无重复；结构变化会使 check 模式失败
- [x] 278 个 Prisma relation 单列且未计入物理字段；逻辑引用不伪装成 FK
- [x] 每个表/字段都有中文名与用途，或明确、诚实的待业务确认值
- [x] 名称、用途、工作台和敏感等级分别有证据状态，不使用一个笼统状态掩盖未知
- [x] 每个确认语义可追溯到 `doc/`、正式契约或实现证据；候选文档和 UI 文案未升格
- [x] Excel 10 个工作表可按模块、表、技术所有者、工作台、敏感等级和确认状态筛选
- [x] 工作簿关键范围无公式错误、无截断遮挡；全部工作表完成视觉检查
- [x] Markdown、Excel 与结构检查由同一规范化模型生成，手工编辑生成物会被 check 模式发现
- [x] Schema 或迁移增删对象时，`data-dictionary:check` 能报告精确漂移
- [x] Claude 独立复审 findings 已由 Codex 处置；待负责人确认项保持待定，不伪造完成

## 回滚

本任务只增加生成工具和派生物。回滚可删除脚本、命令和 `database/dictionary/`，不会改变数据库。不得以回滚为由
删除业务负责人已经确认并回写的语义；如更换生成格式，先导出并迁移注解稳定键和来源记录。

## 进度 log

| 日期       | 阶段    | 负责   | commit     | 说明                                                                                                      |
| ---------- | ------- | ------ | ---------- | --------------------------------------------------------------------------------------------------------- |
| 2026-09-30 | blocked | Codex  | —          | 核验结构基线并定案双来源对账、证据分级、目录和 A-D 切片；等待并行治理规则定案                             |
| 2026-10-01 | blocked | Codex  | —          | 已完成实施设计；等待有界并行治理合入并写入准确基线，根工具接入已拆为后续串行切片                          |
| 2026-10-01 | coding  | Codex  | —          | PR #111 已合入；以 `f0fc0e15` 开放切片 A，仅实现独立提取器，不修改根工具文件                              |
| 2026-10-01 | review  | Claude | `bbcb49e7` | 最终独立复审 Standards/Spec 双轴通过；后续补齐完整注解边界、原生 Excel 兼容性与视觉验收，待 PR CI/quality |
