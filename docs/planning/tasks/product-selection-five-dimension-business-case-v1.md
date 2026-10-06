---
status: coding
branch: feat/product-selection-five-dimension-business-case-v1
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
  - apps/api/src/modules/product-selection/infrastructure/prisma-product-initiative.repository.ts
  - apps/api/src/modules/product-selection/presentation/product-initiative.dto.ts
  - apps/api/src/modules/product-selection/presentation/product-npi.dto.ts
  - apps/api/src/infrastructure/integration/product-initiative-flow.integration.test.ts
  - apps/api/src/infrastructure/integration/product-initiative-migration-upgrade.integration.test.ts
  - apps/api/src/infrastructure/integration/product-initiative-test-fixtures.ts
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

- [ ] 新写五面语义由公共契约 + Domain 单一解释，前端不发明判断档位
- [ ] approve 不能带 `validate_before_investment`、`does_not_support` 或未说明的关键未知
- [ ] defer/reject 可保存部分草稿，刷新和任务切换不串线
- [ ] 证据继续限定当前租户与当前机会来源信号；无效引用整体拒绝
- [ ] 新立项冻结五面、单位经济和资源责任；NPI 只读消费同一快照
- [ ] completed legacy 不回填、不冒充五面；pending legacy 按已定迁移政策可恢复
- [ ] 固定三栏壳及 1440×900、1024×768、390×844 视觉顺序不变
- [ ] 定向门禁、完整 Web、真实 PostgreSQL、专项 E2E、最终 CI 与独立复审通过

## 进度 log

| 日期       | 阶段   | 负责        | commit | 说明                                                                                   |
| ---------- | ------ | ----------- | ------ | -------------------------------------------------------------------------------------- |
| 2026-10-06 | design | Claude Code | —      | PR #145 合并后建立下一业务薄片；继承选品智慧基线，限定为五面三态投资门，不夹带后续能力 |
