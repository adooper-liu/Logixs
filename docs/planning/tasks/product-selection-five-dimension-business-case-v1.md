---
status: done
branch: feat/product-selection-five-dimension-business-case-v1
verification: https://github.com/adooper-liu/Logixs/pull/146
owner: main
writer: codex
risk: high
dependsOn: []
writeScopes:
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - docs/planning/tasks/product-selection-five-dimension-business-case-v1.md
  - packages/contracts/schemas/v1/product-initiative.schema.json
  - packages/contracts/schemas/v1/index.json
  - packages/contracts/fixtures/v1/schema-instances.json
  - packages/contracts/generated/contracts.d.ts
  - database/schema.prisma
  - database/migrations/**
  - database/dictionary/dictionary.annotations.json
  - database/dictionary/DATA_DICTIONARY.generated.md
  - database/dictionary/NATIVE_OBJECTS.generated.md
  - database/dictionary/database-data-dictionary.xlsx
  - apps/api/src/modules/product-selection/domain/product-initiative.ts
  - apps/api/src/modules/product-selection/domain/product-initiative.test.ts
  - apps/api/src/modules/product-selection/domain/product-initiative.repository.ts
  - apps/api/src/modules/product-selection/application/decide-product-initiative.service.ts
  - apps/api/src/modules/product-selection/application/get-product-initiative.service.ts
  - apps/api/src/modules/product-selection/application/list-npi-queue.service.ts
  - apps/api/src/modules/product-selection/application/product-initiative.services.test.ts
  - apps/api/src/modules/product-selection/infrastructure/prisma-product-initiative.repository.ts
  - apps/api/src/modules/product-selection/presentation/product-initiative.dto.ts
  - apps/api/src/modules/product-selection/presentation/product-npi.dto.ts
  - apps/api/src/infrastructure/integration/product-initiative-flow.integration.test.ts
  - apps/api/src/infrastructure/integration/product-initiative-migration-upgrade.integration.test.ts
  - apps/api/src/infrastructure/integration/product-initiative-test-fixtures.ts
  - apps/api/src/infrastructure/integration/workbench-network-volume.integration.test.ts
  - apps/api/src/infrastructure/integration/supplier-nomination-flow.integration.test.ts
  - apps/api/src/infrastructure/integration/product-npi-intake-flow.integration.test.ts
  - apps/api/src/infrastructure/integration/product-identity-flow.integration.test.ts
  - apps/api/src/infrastructure/integration/product-definition-flow.integration.test.ts
  - apps/web/src/composables/useProductInitiativeDecision.ts
  - apps/web/src/composables/useProductInitiativeDecision.test.ts
  - apps/web/src/components/product-selection/ProductInitiativeReviewPanel.vue
  - apps/web/src/components/product-selection/ProductInitiativeReviewPanel.test.ts
  - apps/web/src/components/product-selection/ProductInitiativeResultPanel.vue
  - apps/web/src/components/product-selection/ProductInitiativeResultPanel.test.ts
  - apps/web/src/components/product-npi/ProductNpiHandoffDetail.vue
  - apps/web/src/views/ProductSelectionWorkbench.vue
  - apps/web/src/views/ProductSelectionWorkbench.test.ts
  - apps/web/src/views/ProductNpiWorkbench.test.ts
  - apps/web/e2e/workbench-network.spec.ts
exclusiveLocks:
  - business-policy:ps-five-dimension-business-case
  - public-contract:product-initiative-v1
  - generated:contracts
  - database-schema
  - database-migrations
  - database-dictionary
  - generated:database-catalog
sharedIntegrationScopes:
  - apps/web/e2e/workbench-network.spec.ts
authorityRefs:
  - AGENTS.md
  - doc/cross-border-supply-chain/01-authoritative-business-chain.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - doc/cross-border-supply-chain/wisdom-baseline/全局.md
  - doc/cross-border-supply-chain/wisdom-baseline/选品立项.md
  - docs/planning/tasks/product-selection-resource-commitment-v1.md
  - docs/product/UI_SYSTEM.md
uiStructure:
  - 固定办理壳：PageHeader → 岗位/交接上下文 → 左侧任务队列 + 中间对象事实/五面论证 + 右侧结果动作
  - 中栏顺序：五类业务缺口导航 → 紧凑机会事实 → 五面商业论证摘要 → 当前选中维度编辑；结果详情只读展示冻结五面快照
uiMustStayVisible:
  - 当前任务、责任、真实去向、五面判断状态、阻断维度、关键未知、主动作、失败与恢复
  - 单位经济摘要继续作为商业可行性的结构化支撑，不复制录入
uiProgressiveDisclosure:
  - 每面证据明细、结论备注、旧四项历史评审、适用理由与交接原文按需展开
uiForbidden:
  - 把旧四项自动映射成五面、继续由前端短句决定业务语义、万能总分、字段卡墙、说明墙、重复单位经济输入
  - 改变全局三栏办理壳、夹带队列双轴、权限拆分、完整 U1、组合优化器或反馈 KPI
uiViewportEvidence:
  - 1440x900：首屏可见对象、五面状态、当前阻断/关键未知与主动作；三栏无横向溢出
  - 1024x768：同一业务顺序折叠，五面摘要与当前编辑区可达，无页面级横向溢出
  - 390x844：队列 → 对象事实 → 五面摘要 → 当前维度 → 动作；不铺开五份长表单
---

# 任务：选品立项——五面商业论证 V1

## 目标

把选品立项从“旧四项有文字和证据即可通过”升级为可复核的投资门：选品负责人必须分别说明客户与需求、价值与差异、商业可行性、供应与技术可行性、战略与组合是否支持投入，并明确会使结论失效的关键未知。新立项冻结五面快照交给 NPI；历史旧四项只读保留，不自动改写或冒充五面结论。

本片直接减少两类已定损失：依据不完整却形成投入决定；单品局部成立但供应、技术或组合代价未被看见。它位于“可信机会已接受 → 商业论证 → 资源承诺并立项 → NPI 接收”的关键路径。

## 边界 / 不做

- 只做五面商业论证的当前态、投资门、不可变 NPI 快照和固定工作台承接。
- 复用现有单位经济快照作为“商业可行性”支撑，不新增预算、销量、利润率阈值、汇率或第二套金额字段。
- 复用现有同租户/同信号证据真实性校验；不判断证据内容是否足够，不建设通用证据平台。
- 不做 Q1 队列双轴、P1 权限拆分、U1 完整假设元数据、C1 自动组合优化、M1 反馈指标、动态适用风险项；它们分别后续切片。
- 不改变市场→选品责任交接、NPI 阶段状态机、全局固定三栏壳。
- R13（legacy 无单位经济快照移动端说明）继续非阻塞延期，不夹带进本片。

## 智慧开启基线

| 基线原结论                   | 处置   | 依据                                 | 本片落点                                 |
| ---------------------------- | ------ | ------------------------------------ | ---------------------------------------- |
| 选品是商业论证与投资门工作台 | `沿用` | 负责人已定 B；`08` §4.2              | 目标与岗位结果                           |
| E1 只接收可信机会包          | `沿用` | 已由市场→选品交接任务实现            | 不新增入口                               |
| D1 五面评审 + 适用风险项     | `沿用` | 负责人已定 E1+D1+G1                  | 本片只做五面；适用风险项后续             |
| F1 区间与情景                | `沿用` | 已由资源/单位经济任务实现            | 商业可行性只引用摘要                     |
| U1 事实/假设/计算/判断四轨   | `沿用` | 已定但本片仅承接证据、结论、关键未知 | 完整元数据后续                           |
| R1 资源责任                  | `沿用` | PR #145 已实现                       | 作为 approve 既有前置                    |
| Q1 队列双轴                  | `沿用` | 已定                                 | 后续，不进入本片                         |
| P1 能力拆分                  | `沿用` | 已定                                 | 后续，沿用 planning.read/draft           |
| H1 风险比例门槛              | `补强` | 阻断未知不能带病投入，普通假设可保留 | 五面判断与关键未知                       |
| C1 轻量组合检查              | `沿用` | 已定                                 | 本片只让“战略与组合”可人工判断，不做算法 |
| M1 结果反馈                  | `沿用` | 已定                                 | 后续                                     |

## 已证实实现事实

1. 公共契约当前允许 5 个旧 review point code，Domain 仅把前 4 个作为 approve 门槛；`customer_feedback` 非门槛。
2. 旧 shape 只有 `{ code, evidenceRefs, conclusion }`，不能表达维度投资判断和关键未知；前端短句不属于服务端业务权威。
3. 当前态与 NPI handoff 都把旧 `reviewPoints` 存为 JSON；数据库只校验数组外壳，业务规则在 Domain。
4. 现有单位经济、资源承诺、证据归属、事务、幂等和并发能力可直接复用。
5. `ProductInitiativeReviewPointDto` 的 Swagger enum 仍只列 4 项，与当前契约 5 项漂移；本片迁移到五面时一并消除，不复制该漂移。

## 负责人决策记录

| 决策 ID                | 已知事实与未知                                                               | 选项、成本/收益/风险/可逆性                                                                                                                                                            | 推荐与理由                                                          | 负责人结论                              | 权威落点 / 状态      |
| ---------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------- | -------------------- |
| PS5-D01 五面判断状态   | H1 要区分支持投入、阻断未知和不支持；普通事实/假设已由证据及单位经济表达     | A 三态：`supports_investment / validate_before_investment / does_not_support`；B 五态照搬 H1 全分类；C 继续自由文本。A 成本最低、服务端可解释、可逆；B 首片过重；C 不解决问题          | A；`validate_before` 明确是投入前阻断未知，走暂缓验证，不能 approve | 2026-10-06 选择 A（三态投资判断）       | `08` §4.2 / approved |
| PS5-D02 历史与在办迁移 | completed legacy 必须可追溯；pending legacy 仍需继续办理；禁止自动映射旧四项 | A completed 只读旧四项，pending 下次编辑建立空五面草稿并保留旧四项审计；B 全部 legacy 永久只读后另建新版本；C 自动映射。A 不阻断在办、无伪造、实现成本中等；B 恢复路径不足；C 数据造假 | A                                                                   | 2026-10-06 选择 A（完成只读、在办迁移） | `08` §4.2 / approved |

## 推荐方案（PS5-D01/D02 已定，可转 coding）

### 唯一新写结构

新增 `businessCaseDraft` 与 `businessCaseSnapshot`，每面只包含：

- `dimensionCode`：`customer_need`、`value_differentiation`、`commercial_viability`、`supply_technical_feasibility`、`strategy_portfolio`
- `decision`：PS5-D01 定案的稳定状态
- `conclusion`：岗位结论
- `evidenceRefs`：复用当前机会合法证据
- `criticalUnknown`：仅阻断验证状态必填，其他状态必须为空

草稿允许部分填写；完整快照只由服务端产生。approve 要求五面齐全、全部支持投入、既有资源责任与单位经济门槛同时满足。`validate_before_investment` 只能暂缓并使用现有验证重点与重判日期；`does_not_support` 只能不立项或先修改论证，不得 approve。前端不自行推断状态。

### 历史兼容

- completed legacy：继续只读显示“历史四项评审”，不计为当前缺口，不生成五面快照。
- pending legacy：按 PS5-D02 建立空五面草稿，旧 reviewPoints 原样保留为审计信息，不自动映射。
- 新写 current/handoff：冻结五面 snapshot；旧 reviewPoints 不再作为新 approve 门槛。

## 首个执行切片 `S1-five-dimension-investment-gate`

| 项目        | 内容                                                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 基线        | PR #145 合并提交 `9a507b92` 后的新任务分支                                                                                                                                                 |
| 执行角色    | 实现执行器：Codex（GPT-5.6）                                                                                                                                                               |
| 复审        | 高风险：fresh Codex 只读复审公共契约、状态语义、迁移和核心工作流                                                                                                                           |
| 禁止范围    | 队列双轴、权限新能力码、动态风险项、完整 U1、组合评分/KPI、NPI 阶段行为                                                                                                                    |
| UI 强制结构 | 逐项遵守 frontmatter 五项；固定工作台壳不变，只替换当前评审区域与结果摘要                                                                                                                  |
| 验证命令    | product-selection Domain/Application 单测；product-initiative flow + migration PostgreSQL；contract/drift；dictionary；Web focused/full；三视口专项 E2E；API/Web lint/typecheck；repo/diff |
| 停止条件    | 完成后 `ready-for-review`，不得推送/建 PR/改状态；若发现需要队列、权限、动态风险或新数值阈值则返回 blocked                                                                                 |

### 修复切片 `S1F1-legacy-evidence-closure`

| 项目     | 内容                                                                                                                                                                                                                                                                               |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 依据     | `S1-five-dimension-investment-gate-evidence-01` 已由主代理核验并接受；旧四项冻结进新 handoff 时，其引用也必须进入同一不可变快照的 `evidenceRefs` 汇总。                                                                                                                            |
| 写入范围 | `apps/api/src/modules/product-selection/infrastructure/prisma-product-initiative.repository.ts`、`apps/api/src/infrastructure/integration/product-initiative-flow.integration.test.ts`、`apps/api/src/modules/product-selection/application/product-initiative.services.test.ts`。 |
| 实现要求 | 从最终写入 handoff 的旧 `reviewPoints`、新五面 snapshot/draft 与单位经济 snapshot 统一汇总、去重并稳定排序证据引用；不得自动映射旧四项为五面。更新旧 Application 完整命令 fixture，使其按新五面门槛表达，不放宽生产规则或既有断言。                                                |
| 验收反证 | pending legacy 含旧证据 `E_old`，本次五面使用不同证据 `E_new` 后完成立项；handoff 保留旧四项且 `evidenceRefs` 同时包含 `E_old`、`E_new`。Application 模块原 4 条失败恢复通过。                                                                                                     |
| 验证     | Application 定向测试；product-initiative Domain 测试；product-initiative flow PostgreSQL 测试；API lint/typecheck；`git diff --check`。                                                                                                                                            |
| 禁止     | 不改 task brief、业务权威、公共契约、UI、迁移、权限、状态语义；不提交、不推送、不改任务状态。                                                                                                                                                                                      |
| 停止条件 | 返回 `ready-for-review`；若修复需要改变快照契约或历史兼容政策则返回 `blocked`。                                                                                                                                                                                                    |

### 修复切片 `S1F2-viewport-information-order`

| 项目     | 内容                                                                                                                                                                                                                                                                             |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 依据     | 三视口专项 E2E 3/3 通过且无横向溢出，但主代理人工核对工作态截图后确认：1440×900 与 1024×768 首屏只到五面标题，390×844 完全看不到五面摘要或当前维度；不满足 frontmatter 要求的“首屏可见五面状态 / 移动端队列→对象事实→五面摘要→当前维度→动作”。                                   |
| 写入范围 | `apps/web/src/views/ProductSelectionWorkbench.vue`、`apps/web/src/views/ProductSelectionWorkbench.test.ts`、`apps/web/e2e/workbench-network.spec.ts`；只有确需压缩五面摘要本身时才允许改 `apps/web/src/components/product-selection/ProductInitiativeReviewPanel.vue` 及其测试。 |
| 实现要求 | 保持 PageHeader、岗位/交接上下文、队列、三栏/响应式办理壳和单一主动作不变；把五面摘要与当前维度编辑提升到紧凑机会事实之后，专业要求与历史审计下移为后续渐进披露。桌面/窄屏首屏必须同时看见五面状态、当前阻断和主动作；移动端按既定顺序可达，不让固定动作条遮住五面摘要。         |
| 验收反证 | 在 1440×900、1024×768、390×844 的工作态真实截图中，五面摘要与当前维度完全不可见，或页面/内容横向溢出，或专业要求仍排在五面之前，均判失败；结果态只读三栏/顺序不得回归。                                                                                                          |
| 验证     | Web focused/full 单测、lint/typecheck、三项目专项 E2E；保留 working/result 六张真实截图及 overflow JSON，由主代理逐张人工核对。                                                                                                                                                  |
| 禁止     | 不改 API、契约、Schema、业务状态、权限、队列双轴、单位经济规则；不把五面铺成五份长表单，不删除专业要求或 legacy 审计，不用缩小字体掩盖信息层级问题；不提交、不推送、不改 brief 状态。                                                                                            |
| 停止条件 | 三视口证据齐全后返回 `ready-for-review`；若必须改变既定三栏壳或业务顺序则返回 `blocked`。                                                                                                                                                                                        |

### 修复切片 `S1F3-unsupported-routing-guard`

| 项目     | 内容                                                                                                                                                                                                                                                                                      |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 依据     | 业务权威明确利润、供应或组合判断不成立必须由选品暂缓或不立项，不得退回市场代办；当前 Domain 只限制 `validate_before_investment` 的去向，实测 `does_not_support + return_to_market` 会形成 `return_requested`。                                                                            |
| 写入范围 | `apps/api/src/modules/product-selection/domain/product-initiative.ts`、`apps/api/src/modules/product-selection/domain/product-initiative.test.ts`；若需服务层错误映射回归，可改 `apps/api/src/modules/product-selection/application/product-initiative.services.test.ts`。                |
| 实现要求 | 服务端拒绝任一五面为 `does_not_support` 时使用 `return_to_market`；仍允许选品侧 `reject`，以及按既定规则保存/暂缓后修改论证。不得由前端按钮状态代替 Domain 守卫，不改变 `returnBasis` 的上游机会退回语义。                                                                                |
| 验收反证 | 完整五面中 `strategy_portfolio=does_not_support`，同时提交 `outcome=return_to_market`、合法 `returnBasis` 与原因；当前实现返回 `completion=completed/currentDestination=return_requested`，修复后必须稳定拒绝且不产生持久化、市场退回或 Outbox。`outcome=reject` 仍可按既有原因规则关闭。 |
| 验证     | Domain/Application 定向测试、API lint/typecheck、`git diff --check`；如触及服务编排，补 product-initiative PostgreSQL flow。                                                                                                                                                              |
| 禁止     | 不改业务权威、公共契约、Schema/迁移、UI、权限、队列或 NPI 行为；不新增状态、阈值或通用路由策略；不提交、不推送、不改 brief 状态。                                                                                                                                                         |
| 停止条件 | 返回 `ready-for-review`；若需要改变市场退回政策或新增状态则返回 `blocked`。                                                                                                                                                                                                               |

### 修复切片 `S1F4-completed-legacy-readonly`

| 项目     | 内容                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 依据     | PS5-D02 明确 completed legacy 只读、pending legacy 才建立空五面草稿继续办理；当前 UI 仅把 `handed_off/return_requested` 视为只读，Repository 也只拒绝这两种 destination，因此迁移前已 `completion=completed` 的 `rejected/deferred` 旧四项记录仍会出现五面编辑器并可被覆盖。                                                                                                                                                      |
| 写入范围 | `apps/api/src/modules/product-selection/infrastructure/prisma-product-initiative.repository.ts`、`apps/api/src/infrastructure/integration/product-initiative-flow.integration.test.ts`、`apps/web/src/composables/useProductInitiativeDecision.ts`、`apps/web/src/composables/useProductInitiativeDecision.test.ts`、`apps/web/src/views/ProductSelectionWorkbench.vue`、`apps/web/src/views/ProductSelectionWorkbench.test.ts`。 |
| 实现要求 | 只把“无五面快照/草稿且在迁移前已 completed”的 legacy 记录锁为历史只读；pending legacy 仍建立空五面草稿并可恢复。服务端必须拒绝改写，前端以独立的 `legacyReadOnly` 语义呈现旧四项审计，不得只靠隐藏按钮形成安全边界，也不得把历史拒绝/暂缓写成“已交 NPI”或“结论已冻结”。不得把 NPI 退回后的新式记录误锁死，也不得把普通在办 defer 当作 completed legacy。                                                                          |
| 验收反证 | 构造 `completion=completed + currentDestination=rejected/deferred + businessCaseDraft=[] + businessCaseSnapshot=null + legacy reviewPoints`：页面只读显示历史四项，服务端新决定稳定拒绝且原行不变；构造 `completion=pending_completion` 的同形 legacy 记录仍可创建五面草稿；NPI `returned_from_npi` 当前态仍可再判断。                                                                                                            |
| 验证     | Domain/Application/Web focused；product-initiative PostgreSQL flow；API/Web lint/typecheck；`git diff --check`。                                                                                                                                                                                                                                                                                                                  |
| 禁止     | 不改 completed 判定的业务政策、公共契约、Schema/迁移、权限、NPI 状态机或队列双轴；不回填/映射旧四项，不新建 legacy 状态码；不提交、不推送、不改 brief 状态。                                                                                                                                                                                                                                                                      |
| 停止条件 | 返回 `ready-for-review`；若无法从现有持久化事实无歧义地区分 completed legacy 与新式当前态，则返回 `blocked`，不得猜默认值。                                                                                                                                                                                                                                                                                                       |

### 修复切片 `S1F5-contract-semantic-parity`

| 项目     | 内容                                                                                                                                                                                                                                                        |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 依据     | 公共 Schema 当前接受 Domain 会拒绝的五面草稿：`validate_before_investment + criticalUnknown=null`、`supports_investment + 非空 criticalUnknown`；五面 snapshot 数组只限制长度为 5，仍接受五个重复 `dimensionCode`。这违反“公共契约 + Domain 单一解释”验收。 |
| 写入范围 | `packages/contracts/schemas/v1/product-initiative.schema.json`、`packages/contracts/fixtures/v1/schema-instances.json`、`packages/contracts/generated/contracts.d.ts`；如生成器要求索引漂移同步，可改 `packages/contracts/schemas/v1/index.json`。          |
| 实现要求 | 在公共契约表达与 Domain 相同的关键未知条件：验证态必须是非空字符串，其他状态必须为 null 或缺省；对完整五面集合表达五个稳定维度各一次。优先使用 JSON Schema 2020-12 可验证结构，不复制业务评分或新增状态。生成类型必须由标准生成命令更新，不手写。           |
| 验收反证 | `validate_before_investment + criticalUnknown=null`、`supports_investment + criticalUnknown='unexpected'`、完整 snapshot 含五个重复 `customer_need` 当前均通过 AJV；修复后均失败。合法部分草稿、合法验证态及完整五面 snapshot 继续通过。                    |
| 验证     | `pnpm contract:generate`、`pnpm contract:check`、`pnpm contract:drift`、API/Web typecheck、相关 Domain/fixture 测试、`git diff --check`。                                                                                                                   |
| 禁止     | 不改 Domain 行为、Schema/迁移、API 路由、UI、权限或业务权威；不把 draft 强制为五面齐全，不新增评分、阈值或动态风险项；不提交、不推送、不改 brief 状态。                                                                                                     |
| 停止条件 | 返回 `ready-for-review`；若 JSON Schema 无法在不破坏 partial draft 的前提下表达唯一五面集合，则返回 `blocked`，不得仅依赖 TypeScript 类型冒充运行时契约。                                                                                                   |

### 修复切片 `S1F6-business-case-migration-upgrade`

| 项目     | 内容                                                                                                                                                                                                                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 依据     | 本片新增迁移 `20261006120000_add_product_initiative_business_case`，但现有 upgrade 测试只在已应用全部迁移的库中顺带断言新列，没有回退该迁移的记账与列后再部署，因此没有验证“真实旧库 → 本次迁移”的升级路径。                                                                                                                               |
| 写入范围 | `apps/api/src/infrastructure/integration/product-initiative-migration-upgrade.integration.test.ts`。                                                                                                                                                                                                                                       |
| 实现要求 | 为本次五面迁移建立独立旧版本升级场景：先部署并造 legacy current/handoff 数据，再移除本迁移新增约束与列、删除该迁移记账，重新执行标准迁移入口；验证旧 current 得到空 draft/null snapshot、旧 handoff 得到 null snapshot，旧四项原样不变，pending/completed 事实不被伪造，并验证新 shape 约束会拒绝非法长度。不得复制迁移 SQL 作为测试实现。 |
| 验收反证 | 若测试没有删除 `20261006120000_add_product_initiative_business_case` 的 `_prisma_migrations` 记录与新增列，它不能证明升级；若重部署后旧 reviewPoints、outcome/completion/destination 被改写，或五面被自动回填，判失败。                                                                                                                    |
| 验证     | 定向 migration upgrade PostgreSQL 测试、现有 product-initiative flow、API typecheck/lint、`git diff --check`。                                                                                                                                                                                                                             |
| 禁止     | 不改迁移 SQL、Schema、Domain、契约、UI、业务权威或状态；不新建第二套迁移器，不用测试专用数据修复绕过标准迁移入口；不提交、不推送、不改 brief 状态。                                                                                                                                                                                        |
| 停止条件 | 返回 `ready-for-review`；若历史迁移不可安全回退构造，则返回 `blocked` 并给出具体依赖，不得把空库测试冒充升级测试。                                                                                                                                                                                                                         |

### 修复切片 `S1F7-downstream-integration-fixture`

| 项目     | 内容                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 依据     | 最终 `pnpm test:integration` 中 S1 自身 flow/migration 51 条通过，但 5 个下游集成套件共 41 条失败；共同根因是它们通过共享 `product-initiative-test-fixtures.ts` 构造“完整立项前置”时仍只带旧四项或空 reviewPoints，未携带本片新增的五面支持投入事实，因此在进入各自被测模块前被新投资门拒绝。                                                                                                                                                                                                                                      |
| 写入范围 | `apps/api/src/infrastructure/integration/product-initiative-test-fixtures.ts`、`apps/api/src/infrastructure/integration/workbench-network-volume.integration.test.ts`、`apps/api/src/infrastructure/integration/supplier-nomination-flow.integration.test.ts`、`apps/api/src/infrastructure/integration/product-npi-intake-flow.integration.test.ts`、`apps/api/src/infrastructure/integration/product-identity-flow.integration.test.ts`、`apps/api/src/infrastructure/integration/product-definition-flow.integration.test.ts`。 |
| 实现要求 | 在共享集成 fixture 中新增唯一的完整五面支持投入草稿，并建立语义明确的“完整 approve 前置”对象；五个下游 handoff 构造器显式使用该 approve 前置。资源承诺 fixture 保持只含责任/资源事实，`workbench-network-volume` 的 defer/reject/return_to_market 样本不得被无条件注入五面支持投入。不得逐文件复制五面常量。保持证据 UUID 合法且不依赖真实证据仓储，因为这些套件直接测试领域准备后的下游持久化，不得修改生产门槛或新增测试旁路。                                                                                                   |
| 验收反证 | `workbench-network-volume`、`supplier-nomination-flow`、`product-npi-intake-flow`、`product-identity-flow`、`product-definition-flow` 当前在立项前置处报五面缺失；修复后完整 `pnpm test:integration` 必须通过，且 S1 flow/migration 继续通过。任何通过放宽 `prepareProductInitiativeDecision`、跳过测试或逐文件复制 fixture 的做法均失败。                                                                                                                                                                                         |
| 验证     | 先定向运行上述 5 个套件，再运行完整 `pnpm test:integration`；API lint/typecheck、定向 Prettier、`git diff --check`。                                                                                                                                                                                                                                                                                                                                                                                                               |
| 禁止     | 不改五个下游测试文件、生产 Domain/Application/Repository、契约、Schema/迁移、UI 或业务权威；不新增环境分支或测试专用后门；不提交、不推送、不改 brief 状态。                                                                                                                                                                                                                                                                                                                                                                        |
| 停止条件 | 返回 `ready-for-review`；若某个下游套件需要不同五面事实才能表达其前置业务，则返回 `blocked` 并指出消费者，不得在共享 fixture 中混入特例。                                                                                                                                                                                                                                                                                                                                                                                          |

## 业务步骤五面映射

| 业务步骤与岗位结果 | 岗位任务                               | 数据事实                                 | 技术保障                                      | 权限边界                       | 界面承接                         | 验收证据/状态 |
| ------------------ | -------------------------------------- | ---------------------------------------- | --------------------------------------------- | ------------------------------ | -------------------------------- | ------------- |
| 逐面形成投资判断   | 对五面给出状态、结论、依据和阻断未知   | 五面 draft；事实/判断/未知分轨           | 契约校验、证据归属、部分草稿可恢复            | 沿用 `planning.draft` + tenant | 五行摘要，单面编辑，一个当前焦点 | design        |
| 达到投资门并立项   | 决策者确认五面均支持投入，同时承诺资源 | 完整 snapshot + 既有单位经济/资源承诺    | Domain 门槛、事务、幂等、并发、不可变 handoff | 沿用当前服务端授权，不新增角色 | 右栏单一主动作，具体阻断人话     | design        |
| NPI 接收商业论证   | NPI 读取冻结投入理由和关键边界         | handoff 五面 snapshot；legacy 旧四项只读 | 不可变、版本化、历史不回填                    | 沿用 NPI read/claim            | 结果详情与 NPI 交接只读摘要      | design        |

### 相关数据事实子集

| 轨道                 | 字段/事实                                     | 来源                           | 建议承载                            | 决策/状态            |
| -------------------- | --------------------------------------------- | ------------------------------ | ----------------------------------- | -------------------- |
| `current_physical`   | 旧 reviewPoints、单位经济、资源承诺、证据候选 | 当前契约/Schema/实现           | 保留，旧评审只读                    | verified             |
| `approved_gap`       | 五面商业论证、阻断未知、完整快照              | 智慧基线 D1/H1；负责人已定五面 | JSON draft + snapshot + Domain 门槛 | PS5-D01/D02 approved |
| `industry_candidate` | 自动评分、权重、组合优化                      | 无项目定案                     | `undecided`                         | 不进入本片           |

## 23 台共同最低线承接

| 基线   | 本片承接                                                | 状态                   |
| ------ | ------------------------------------------------------- | ---------------------- |
| WB-B01 | 主动作围绕“形成商业论证并作投入决定”                    | design                 |
| WB-B04 | 复用既有责任、目标日期、下一决策点                      | implemented / reuse    |
| WB-B05 | 五面判断、证据、关键未知分轨                            | design                 |
| WB-B07 | 五面不可变 NPI 快照与 legacy 兼容                       | design                 |
| WB-B09 | AI 不自动作投资判断、不自动映射历史                     | invariant              |
| WB-B10 | 成功、部分待补、阻断未知、不支持、legacy、并发/失败路径 | pending implementation |

## 验收

- [x] 新写五面语义由公共契约 + Domain 单一解释，前端不发明判断档位
- [x] approve 不能带 `validate_before_investment`、`does_not_support` 或未说明的关键未知
- [x] defer/reject 可保存部分草稿，刷新和任务切换不串线
- [x] 证据继续限定当前租户与当前机会来源信号；无效引用整体拒绝
- [x] 新立项冻结五面、单位经济和资源责任；NPI 只读消费同一快照
- [x] completed legacy 不回填、不冒充五面；pending legacy 按已定迁移政策可恢复
- [x] 固定三栏壳及 1440×900、1024×768、390×844 视觉顺序不变
- [x] 最终 CI 通过

## 进度 log

| 日期       | 阶段   | 负责        | commit | 说明                                                                                                                                                                                                                                                                                                            |
| ---------- | ------ | ----------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-06 | design | Claude Code | —      | PR #145 合并后建立下一业务薄片；继承选品智慧基线，限定为五面三态投资门，不夹带后续能力                                                                                                                                                                                                                          |
| 2026-10-06 | fix    | Claude Code | —      | 主代理接受 `evidence-01`：pending legacy 旧四项虽冻结进 handoff，但证据汇总只读取新命令，会令不可变快照丢失旧引用；修复片同时补齐既有 Application 测试夹具。该回报声明复用了实现上下文，不计为 fresh 独立复审通过。                                                                                             |
| 2026-10-06 | review | Claude Code | —      | 主代理验收 S1F1：核对最终 handoff 证据汇总与 `E_old`/`E_new` 回归场景；独立复跑 Domain/Application 38 条、PostgreSQL flow 34 条、API lint/typecheck、定向格式及 diff 检查均通过。整片仍待 fresh Codex 独立复审与三视口视觉证据。                                                                                |
| 2026-10-06 | review | Codex       | —      | fresh 只读复审未建立新的业务、安全、兼容或数据真实性 finding。主代理驳回自指的 `S1-RV-001`（当前回报本身即 fresh review），接受 `S1-RV-002` 为外部验收缺口；三视口 E2E 因普通 Vite 占用固定 5173 端口而尚未执行。                                                                                               |
| 2026-10-06 | fix    | Claude Code | —      | 经负责人授权释放 5173/5174 后，三视口专项 E2E 3/3 通过且 overflow 数据合格；人工核对确认结果态合格，但工作态五面摘要/当前维度未进入约定首屏与移动顺序，接受为 `S1F2-viewport-information-order`，不得以自动化通过结案。                                                                                         |
| 2026-10-06 | review | Claude Code | —      | 主代理验收 S1F2：逐张核对六张截图和 overflow JSON；独立复跑 Web 685 条、lint/typecheck、三视口专项 E2E 3/3 均通过，工作态与结果态满足既定结构。整片继续修复已确认的 `does_not_support` 错误退回市场路径。                                                                                                       |
| 2026-10-06 | review | Claude Code | —      | 主代理验收 S1F3：Domain 守卫在证据读取与仓储事务前拒绝错误退回，Application 反证确认不调用 evidence reader 或 repository；独立复跑 40 条及 API lint/typecheck 通过。整片继续处理 completed legacy 只读兼容。                                                                                                    |
| 2026-10-06 | fix    | Claude Code | —      | S1F4 服务端阶段验收：completed legacy reject/defer 拒改、原行不变、pending legacy 与 NPI return 可继续；PostgreSQL flow 37/37。实现器正确因 UI 文案越界返回 blocked，主代理扩入 Workbench 页面并要求独立 `legacyReadOnly` 呈现。                                                                                |
| 2026-10-06 | review | Claude Code | —      | 主代理验收 S1F4：服务端与前端使用同一组现有事实识别 completed legacy；历史拒绝/暂缓独立只读，pending/new-style/NPI return 不误锁。复跑 PostgreSQL 37、API 40、Web 74、双方 lint/typecheck、三视口 3/3 均通过。                                                                                                  |
| 2026-10-06 | review | Claude Code | —      | 主代理验收 S1F5：AJV 正反探针、54 个 fixture、contract generate/check/drift、API/Web typecheck、API 40 与 Web 66 均通过；本次收紧只作用于同一未提交 S1 新增结构且与 Domain 既有拒绝一致。继续补真实旧库升级验证。                                                                                               |
| 2026-10-07 | review | Claude Code | —      | 主代理验收 S1F6：独立旧库场景真实删除五面列/约束与目标迁移记账，再走标准入口重放；legacy current/handoff 原事实保留、五面不回填、新约束生效。复跑 migration 14 + flow 37、API lint/typecheck 通过，进入最终 fresh 独立复审。                                                                                    |
| 2026-10-07 | review | Codex       | —      | 最终 fresh 只读复审覆盖 S1F1～S1F6 后返回 `no-blocking-findings`，无 finding/unknown。reviewer 未独立重跑 PostgreSQL；该证据缺口由主代理本轮新鲜执行的 flow 37/37 与 migration+flow 51/51 覆盖，进入最终完整门禁。                                                                                              |
| 2026-10-07 | fix    | Claude Code | —      | 最终 `validate` 的 repo/contract/dictionary/generate/lint 通过；全仓 format 仅被非任务 `.pytest_cache` 的 Windows EPERM 阻断，任务差异逐路径格式通过。全仓 unit 2164 条、typecheck、build 通过；完整 integration 暴露 5 个下游套件共 41 条旧前置 fixture 失败，进入 S1F7。                                      |
| 2026-10-07 | fix    | Claude Code | —      | S1F7 初次交回的五套件 44/44 已复验，但共享 `COMMITMENT` 无条件携带五面支持投入，污染 defer/reject/return 样本；主代理扩充同片范围，要求资源承诺与 approve 前置分离并由五个 handoff 构造器显式使用。                                                                                                             |
| 2026-10-07 | review | Claude Code | —      | 主代理验收 S1F7：资源承诺与 approve prerequisite 分离，五个消费者显式使用；全量 PostgreSQL 26 files / 195 tests 与 Web E2E 169 passed / 7 skipped 均通过。全仓 unit 2164、typecheck、lint、build、契约/字典/生成物通过；仅全仓格式扫描受非任务 `.pytest_cache` EPERM 阻断，任务差异逐路径格式通过。进入 PR/CI。 |
| 2026-10-07 | done   | Claude Code | —      | PR #146 必需检查全部通过：quality、static、unit、dictionary、e2e、build、changes 为 success，security 按路径规则 skipped；PR 状态 CLEAN/MERGEABLE。完成最终 brief 收口并合并。                                                                                                                                  |
