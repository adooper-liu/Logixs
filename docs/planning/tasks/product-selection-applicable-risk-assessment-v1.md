---
status: done
branch: feat/product-selection-applicable-risk-assessment-v1
verification: https://github.com/adooper-liu/Logixs/actions/runs/37876002837
owner: main
writer: codex
risk: high
dependsOn:
  - product-selection-five-dimension-business-case-v1
writeScopes:
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - doc/cross-border-supply-chain/wisdom-baseline/选品立项.md
  - docs/planning/tasks/product-selection-applicable-risk-assessment-v1.md
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
  - apps/api/src/modules/product-selection/application/list-product-initiatives.service.ts
  - apps/api/src/modules/product-selection/application/product-initiative.services.test.ts
  - apps/api/src/modules/product-selection/application/product-npi.services.test.ts
  - apps/api/src/modules/product-selection/infrastructure/prisma-product-initiative.repository.ts
  - apps/api/src/modules/product-selection/presentation/product-initiative.dto.ts
  - apps/api/src/modules/product-selection/presentation/product-npi.dto.ts
  - apps/api/src/infrastructure/integration/product-initiative-flow.integration.test.ts
  - apps/api/src/infrastructure/integration/product-initiative-migration-upgrade.integration.test.ts
  - apps/api/src/infrastructure/integration/product-initiative-test-fixtures.ts
  - apps/web/src/data/productEvaluationRequirements.ts
  - apps/web/src/data/productEvaluationRequirements.test.ts
  - apps/web/src/composables/useProductOpportunityWorkbench.ts
  - apps/web/src/composables/useProductOpportunityWorkbench.test.ts
  - apps/web/src/composables/useProductInitiativeDecision.ts
  - apps/web/src/composables/useProductInitiativeDecision.test.ts
  - apps/web/src/components/product-selection/ProductEvaluationRequirementsPanel.vue
  - apps/web/src/components/product-selection/ProductEvaluationRequirementsPanel.test.ts
  - apps/web/src/components/product-selection/ProductInitiativeReviewPanel.vue
  - apps/web/src/components/product-selection/ProductInitiativeReviewPanel.test.ts
  - apps/web/src/components/product-selection/ProductInitiativeResultPanel.vue
  - apps/web/src/components/product-selection/ProductInitiativeResultPanel.test.ts
  - apps/web/src/components/product-npi/ProductNpiHandoffDetail.vue
  - apps/web/src/views/ProductSelectionWorkbench.vue
  - apps/web/src/views/ProductSelectionWorkbench.test.ts
  - apps/web/src/views/ProductNpiWorkbench.test.ts
  - apps/web/e2e/workbench-network.spec.ts
  - apps/web/e2e/product-npi-workbench.spec.ts
exclusiveLocks:
  - business-policy:ps-applicable-risk-assessment
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
  - docs/planning/tasks/product-selection-five-dimension-business-case-v1.md
  - docs/product/UI_SYSTEM.md
uiStructure:
  - 固定办理壳：PageHeader → 岗位/交接上下文 → 左侧任务队列 + 中间对象事实/五面论证/适用风险 + 右侧结果动作
  - 中栏顺序：紧凑机会事实 → 五面摘要 → 五类风险摘要 → 当前选中风险编辑 → 单位经济与后续专业材料；结果态和 NPI 只读展示冻结快照
uiMustStayVisible:
  - 当前对象、五面状态、五类风险适用性、阻断风险、关键未知、主动作、失败与恢复
  - 不适用理由与尚不能判断必须使用文字表达，不能只靠颜色、空值或 tooltip
uiProgressiveDisclosure:
  - 单项证据明细、旧四项审计、历史未记录说明、未来规则建议来源在真实消费者出现后按需展开
uiForbidden:
  - 前端根据品类、市场、accepted 状态或 AI 自行推断风险适用性
  - 未知显示成不适用、风险万能总分、五份长表单、通用规则平台、预建 recommendationRef、逐风险 NPI 责任交接
uiViewportEvidence:
  - 1440x900：首屏可见五面摘要、五类风险状态、当前阻断与主动作；三栏无横向溢出
  - 1024x768：风险摘要与当前编辑区按同一业务顺序可达，主动作不遮挡内容
  - 390x844：对象事实 → 五面摘要 → 风险摘要 → 当前风险 → 动作；不铺开五份表单，无页面级横向溢出
---

# 任务：选品适用风险显式判定 V1

## 目标

在选品负责人作出投入决定前，把合规、知识产权、包装物流、退货、平台限制五类风险的适用性和投资判断变成服务端权威事实。首版采用人工显式判断与严格投资门，消除“未知被当成不适用”和前端自行推断；新立项冻结风险快照交给 NPI，历史不回填。暂缓和不立项继续允许保存部分草稿，但不得借非立项去向绕过已显式形成的风险状态约束。

本片继续位于“可信机会已接受 → 商业论证 → 风险适用性判断 → 投资门 → NPI 接收”的关键路径，直接减少适用风险未展开却形成投入决定、风险责任被静默转移给下游两类损失。

## 边界 / 不做

- 首版固定五类风险：`compliance`、`intellectual_property`、`packaging_logistics`、`returns`、`platform_restrictions`。
- 只做人工显式适用性、服务端门禁、当前态、不可变 NPI 快照和固定工作台承接。
- 不做自动品类/市场/平台规则目录，不复用 cargo-ready 合规规则为选品权威。
- 不做逐风险负责人、NPI 显式接受、目标 NPI 阶段/日期、退出条件或带风险立项；这些形成真实消费者后再升级。
- 不做 Q1 队列双轴、P1 权限拆分、U1 完整元数据、组合优化、风险评分或反馈 KPI。
- 复用当前同租户/同来源信号证据真实性校验，不建设第二套证据平台。
- 不改变市场→选品退回边界：选品侧风险不成立只能暂缓、不立项或修改论证，不得退回市场代办。

## 智慧开启基线

| 基线原结论                                                  | 处置   | 依据                                          | 本片落点                                          |
| ----------------------------------------------------------- | ------ | --------------------------------------------- | ------------------------------------------------- |
| D1 五面评审 + 适用风险项                                    | `沿用` | 负责人已定 E1+D1+G1；五面已由 PR #146 实现    | 本片只交付适用风险后一半                          |
| 适用风险按市场/品类展开，不适用有理由，未知不能伪装为不适用 | `补强` | 2026-10-07 负责人选择人工显式判断和严格投资门 | 五类固定风险、三态适用性、服务端门禁              |
| G1 投入/暂缓/否决/退回均有后续责任                          | `沿用` | 现有选品决定状态和责任边界                    | 风险验证态只暂缓，不支持只不立项/修改，不退回市场 |
| U1 事实/假设/计算/判断四轨                                  | `沿用` | 本片只区分适用性、人员判断、证据和关键未知    | 完整 U1 元数据继续延期                            |
| NPI 只读接收选品结论                                        | `补强` | 选品拥有概念判断，NPI 不得改写                | 冻结适用风险快照，NPI 只读                        |
| 规则目录未来可扩展                                          | `补强` | 负责人要求保留方案 B 扩展性但首片不建设       | 未来版本化建议 Port 边界，不进入 V1 Schema        |

## 负责人决策记录

| 决策 ID                    | 已知事实与未知                                                                    | 选项、成本/收益/风险/可逆性                                                                                               | 推荐与理由                            | 负责人结论                                                          | 权威落点 / 状态      |
| -------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------- | -------------------- |
| PSR-D01 首版风险族与适用性 | 当前 Web 本地三类专业要求不是服务端权威；正式链要求合规/IP/包装物流/退货/平台风险 | A 人工显式五类；B 先建版本化规则目录；C 继续自由文本。A 最薄、可审计、可逆；B 需规则治理；C 不解决未知=N/A                | A；先消除权威倒置                     | 2026-10-07 选择 A；风险族为合规、知识产权、包装物流、退货、平台限制 | `08` §4.2 / approved |
| PSR-D02 投资门与未来扩展   | 当前无逐风险责任、NPI 接受、目标阶段/日期和退出机制                               | A 严格门，未知/验证态均暂缓；B 允许带条件立项并同步建设责任交接；C 只记录不门禁。A 不发明下游责任；B 首片过大；C 虚假闭环 | A；待真实逐风险责任消费者出现后升级 B | 2026-10-07 选择 A；保留版本化规则建议扩展，建议不得自动成为决定     | `08` §4.2 / approved |

## 业务模型

### 风险目录

| `riskCode`              | 中文名   | 首版边界                                                          |
| ----------------------- | -------- | ----------------------------------------------------------------- |
| `compliance`            | 合规     | 产品/目标市场层面的准入、标签、认证或限制；不替代下游货物放行合规 |
| `intellectual_property` | 知识产权 | 专利、商标、外观、内容或授权风险                                  |
| `packaging_logistics`   | 包装物流 | 包装体积、易损、运输方式和履约限制                                |
| `returns`               | 退货     | 退货原因、损耗、可售恢复和成本敏感风险                            |
| `platform_restrictions` | 平台限制 | 渠道准入、禁限售、类目或履约政策限制                              |

### 草稿项

```text
riskCode
applicability: applicable | not_applicable | undetermined
applicabilityReason
investmentDecision: supports_investment | validate_before_investment | does_not_support
conclusion
evidenceRefs
criticalUnknown
```

条件规则：

- 草稿允许部分填写，但同一风险码最多一次，服务端按固定目录排序。
- `not_applicable`：`applicabilityReason` 必填；`investmentDecision`、`conclusion`、`criticalUnknown` 必须为空；证据可选。
- `undetermined`：`criticalUnknown` 必填；`investmentDecision` 与 `conclusion` 必须为空；形成待验证缺口。
- `applicable`：`investmentDecision`、`conclusion`、至少一项合法证据必填；`applicabilityReason` 为空。
- `applicable + validate_before_investment`：`criticalUnknown` 必填。
- `applicable + supports_investment/does_not_support`：`criticalUnknown` 必须为空。

### 严格投资门

Approve 必须同时满足：

1. 五类风险各出现一次；
2. 没有 `undetermined`；
3. 每个 `not_applicable` 都有明确理由；
4. 每个 `applicable` 都有结论和当前机会合法证据；
5. 所有 `applicable` 项均为 `supports_investment`；
6. 既有五面、单位经济和资源责任门槛继续满足。

路由规则：

- approve 使用上述全部严格门；
- defer/reject 可保存部分风险草稿，不要求五类完整，但草稿中已出现的每项仍必须满足字段组合约束；
- 草稿中出现 `undetermined` 或 `validate_before_investment` 时，只允许 defer，不允许 approve、reject 或 `return_to_market`，避免把仍待验证事项静默关闭或转嫁；
- 草稿中出现 `does_not_support` 时，只允许 reject 或继续编辑，不允许 approve、defer 或 `return_to_market`；
- 完全尚未填写风险草稿时，仍允许 defer/reject 按现有原因规则保存为部分办理；`return_to_market` 只处理机会本身证据不足或方向错误，不能携带任何已形成的选品风险判断；
- 前端动作可见性不是安全或业务门禁，Domain 必须重新计算。

## 数据、契约与迁移

沿用五面 draft/snapshot 模式，新增同级字段：

```text
product_initiative.risk_assessment_draft      JSONB NOT NULL DEFAULT []
product_initiative.risk_assessment_snapshot   JSONB NULL
product_initiative_handoff.risk_assessment_snapshot JSONB NULL
```

公共契约新增稳定风险码、适用性状态、草稿项、完整快照项，并扩展 decision/current/handoff/NPI queue DTO。为每个风险码新增 pending code；pending code 只表示该风险尚不满足 approve 门，不替代 `applicability` 或生命周期状态。Domain 按固定风险顺序返回缺口，Application/HTTP 错误继续使用稳定错误码并列出具体风险码，Web 只翻译显示。

完整快照固定包含五类风险各一次，并保留草稿条件成立后的原字段：`riskCode`、`applicability`、`applicabilityReason`、`investmentDecision`、`conclusion`、`evidenceRefs`、`criticalUnknown`。快照不引入状态外推或建议来源；`not_applicable` 项冻结理由和可选证据，`applicable` 项冻结投资判断、结论和证据。完整快照只能由服务端从满足严格门的草稿产生。

选择 JSON 而不是子表，因为首版没有跨立项风险查询、逐项责任、独立生命周期或单项历史消费者。真实消费者出现后再评审是否正规化，不提前建平台。

迁移与兼容：

- 空库迁移、真实旧库升级和新约束均需 PostgreSQL 测试；
- 旧 current：draft 默认 `[]`，snapshot 为 `null`；旧 handoff snapshot 为 `null`；
- completed legacy：只读显示“历史未记录适用风险”，不生成缺口、不回填；
- pending legacy：下次编辑建立空风险草稿，按新门槛继续；
- 不从旧四项、`compliance_risk`、五面文本、品类、市场或证据反推风险决定；
- 风险证据与五面、单位经济证据统一汇总进 handoff `evidenceRefs`。

## 技术流程

```text
Decision Command
  → Domain 规范化五类风险并计算缺口/合法去向
  → Application 复用当前机会 evidence reader 校验全部引用
  → Repository 在同一事务写 current draft/snapshot
  → approve 时追加 immutable handoff risk snapshot + evidenceRefs + Outbox
  → NPI queue/read-only UI 消费冻结快照
```

必须保持现有版本冲突、幂等键、同租户对象检查、交接不可变和失败原子性。风险校验失败不得写 current、handoff、市场退回或 Outbox。

## 界面设计

工作态保持固定三栏壳与 PR #147 的内容边距。中栏在五面摘要后增加紧凑五类风险摘要，一次只编辑当前风险：

- 每行显示风险名、适用性、投资判断和具体缺口；
- `undetermined` 明确显示“尚不能判断”，不使用空白或“不适用”样式；
- `not_applicable` 展示理由；
- `applicable` 展示结论、证据数和阻断未知；
- 证据候选继续来自当前来源信号；
- 右栏缺口和主动作读取服务端返回的风险 pending code/拒绝原因；
- 结果态与 NPI 只读显示冻结摘要；legacy 明确显示历史未记录。

当前 `productEvaluationRequirements.ts` 不再计算权威适用性。若保留，只能作为纯标签/证据提示；竞争供给、价格带和售后原声回归五面或证据辅助，不冒充五类风险。

## 未来规则目录扩展边界

V1 不新增 `assessmentSource`、`recommendationRef` 等空字段。未来真实规则消费者出现后，通过独立 Port 返回：

```text
ruleCode
ruleVersion
contextHash
recommendedApplicability
recommendationReason
```

固定不变量：

- 推荐只是版本化建议，不是决定；
- 人员必须显式采纳或改判；
- 服务端保存实际决定；
- 接受建议仍写入同一风险 assessment；
- 规则更新不得反写历史；
- 可在契约新版本增加可选建议来源并冻结进 handoff；
- 不复用下游 cargo-ready 合规规则作为选品权威。

升级到允许带风险立项前，必须先有逐风险责任人、NPI 显式接受、目标阶段/日期、通过标准和退出/退回条件的真实消费者及负责人定案。

## 权限边界

- 沿用当前 `planning.read` / `planning.draft`，不新增法务、合规、专家等角色或 capability；
- 服务端继续执行认证、租户隔离、对象范围、证据归属和 Domain 前置；
- 能力拆分 P1 仍为后续，不影响本片的最低可信门禁；
- NPI 仅按现有 read/claim 读取冻结风险快照，不能编辑。

## 首个实现切片 `S1-risk-draft-gate-snapshot`

| 项目        | 内容                                                                                                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 基线        | `4488604d7b252d7b8a5c99a764a364657845ff48`                                                                                                                                 |
| 执行角色    | 实现执行器：Codex（GPT-5.6）                                                                                                                                               |
| 复审        | 高风险：fresh Codex 只读复审公共契约、状态/责任语义、迁移、证据、快照和核心工作流                                                                                          |
| 写入范围    | 精确路径见 frontmatter；只允许契约/生成物、Schema/迁移/字典、product-selection Domain/Application/Repository/DTO、Web/NPI 和列明测试                                       |
| 禁止范围    | 自动规则目录、推荐来源字段、逐风险责任/NPI 接受、权限新能力码、Q1/P1/U1/组合优化/M1、下游合规规则泛化                                                                      |
| UI 强制结构 | 逐项遵守 frontmatter 五项，保持既定三栏、信息顺序和响应式边距                                                                                                              |
| 验证命令    | contract/check/drift；Domain/Application；真实 PostgreSQL flow + migration upgrade；API/Web lint/typecheck/full unit；三视口 E2E/截图；dictionary；repo/diff；最终完整门禁 |
| 停止条件    | 完成后 `ready-for-review`，不得提交/推送/改 brief 状态；如需带风险立项、规则目录、角色拆分或新数值阈值则返回 blocked                                                       |

### 修复切片 `S1F1-contract-legacy-result-ui`

| 项目     | 内容                                                                                                                                                                                                                                                                                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 依据     | 主代理静态验收与 AJV 反证确认：当前公共 Schema 接受不适用缺理由、未知缺关键未知、适用缺判断和重复风险码；工作态同时展开五份风险表单；选品结果态未显示风险快照；未覆盖本迁移真实旧库升级；completed legacy 判定仍只看五面，无法识别 PR #146 后“有五面、无风险”的历史完成记录。                                                                                                |
| 写入范围 | frontmatter 已列路径；本片重点为公共 Schema/fixture/生成物、migration-upgrade 测试、Domain/Repository legacy 判定、`useProductInitiativeDecision`、`ProductInitiativeReviewPanel`、`ProductInitiativeResultPanel`、`ProductSelectionWorkbench`、旧 professional requirements/composable 及对应测试/E2E。                                                                     |
| 实现要求 | 1) Schema 与 Domain 单一解释条件字段和风险码唯一性，current/handoff 完整 snapshot 五类各一次；2) completed legacy 按风险 draft/snapshot/pending code 识别，五面已存在但风险未记录的历史 reject/defer 仍只读；3) 工作态改为五行摘要 + 单一当前风险编辑；4) 选品结果态与 NPI 都只读显示冻结快照/历史未记录；5) 移除 Web 本地适用性计算权威，旧专业要求仅保留纯证据提示或删除。 |
| 验收反证 | AJV 四个非法样本必须失败、合法 partial/完整 snapshot 通过；迁移测试必须删除 `20261007100000_add_product_initiative_risk_assessment` 的列/约束/记账后重放标准入口；有五面但 `riskAssessmentDraft=[]/snapshot=null` 的 completed reject/defer 只读且原行不变；同一时刻只有一份风险编辑器；结果态与 NPI 不出现内部英文状态码。                                                  |
| 验证     | contract generate/check/drift；Domain/Application；migration upgrade + flow PostgreSQL；Web focused/full；API/Web lint/typecheck；三视口专项 E2E/截图；dictionary；repo/diff。                                                                                                                                                                                               |
| 禁止     | 不放宽严格门、不预建规则目录/建议来源、逐风险责任或新 capability；不把 `undetermined` 默认提交来替代真正空草稿；不新增第二套业务权威；不提交、不推送、不改 brief 状态。                                                                                                                                                                                                      |
| 停止条件 | 返回 `ready-for-review`；若需要改变已定风险族、允许带风险立项或新增跨岗责任则返回 `blocked`。                                                                                                                                                                                                                                                                                |

### 修复切片 `S1F2-empty-draft-legacy-authority`

| 项目     | 内容                                                                                                                                                                                                                                                                                                             |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 依据     | S1F1 定向门禁通过，但主代理行为验收确认：Web 仍把五个默认 `undetermined` 全量提交，空关键未知会阻断本应允许的 defer/reject 部分保存；Repository completed legacy 守卫仍只检查五面；migration-upgrade 没有风险迁移场景；`productEvaluationRequirements` 与 opportunity composable 仍在前端计算“适用规则”。        |
| 写入范围 | frontmatter 已列路径；重点为 `useProductInitiativeDecision`、Repository、migration-upgrade、`productEvaluationRequirements` / `useProductOpportunityWorkbench` / Workbench 及相关测试、E2E。                                                                                                                     |
| 实现要求 | 1) 仅序列化人员实际触碰或服务端已保存的风险项，真正空草稿发送 `[]`；2) completed legacy 以风险 draft/snapshot/pending code 判只读，不依赖五面为空；3) 新增本迁移真实旧库回退重放测试；4) 删除前端适用性计算，旧竞争供给/价格带/售后原声若保留只能是静态证据提示，不再产生 applicable/withheld 业务结论。         |
| 验收反证 | 未填写任何风险时 defer/reject 可按现有原因规则保存 `riskAssessmentDraft=[]`，return 也不携带风险判断；触碰 `undetermined` 后必须填写关键未知且只允许 defer；已有五面但无风险的 completed reject/defer 页面只读且服务端拒改；旧库重放后风险字段为空/null且原事实不变；Web 不再根据 category/accepted 计算适用性。 |
| 验证     | Web/API focused；migration upgrade + flow；contract/dictionary/repo；API/Web lint/typecheck；三视口 E2E/截图；diff。                                                                                                                                                                                             |
| 禁止     | 不放宽已填写风险项的字段/路由门禁，不恢复五份长表单，不新增规则目录、建议来源或权限；不提交、不推送、不改 brief 状态。                                                                                                                                                                                           |
| 停止条件 | 返回 `ready-for-review`；若静态证据提示无法与权威风险 UI 清楚区分，则删除旧专业要求入口，不得保留双重权威。                                                                                                                                                                                                      |

### 修复切片 `S1F3-post-five-dimension-legacy-snapshot`

| 项目     | 内容                                                                                                                                                                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 依据     | S1F2 已闭合空草稿、迁移重放和前端静态提示，但 server/Web legacy 守卫仍要求五面草稿为空，漏掉 PR #146 后“已有五面、无风险”的 completed reject/defer；公共 risk snapshot 仍允许 `undetermined`，与严格门只可能冻结 `not_applicable` 或 `applicable + supports_investment` 不一致。                 |
| 写入范围 | Repository、`useProductInitiativeDecision`、公共 Schema/fixture/生成物、flow/Application/Web 对应测试；均已在 frontmatter。                                                                                                                                                                      |
| 实现要求 | 1) 风险 legacy 判定只依据 completed + rejected/deferred + risk draft/snapshot/pending code，不再要求五面为空；新式已有风险记录与 NPI return 不误锁；2) snapshot Schema 只允许 `not_applicable` 或 `applicable`，其中 applicable 固定 `supports_investment`，五类唯一；3) API 旧值继续归一 null。 |
| 验收反证 | 构造完整五面 draft、completed rejected/deferred、`riskAssessmentDraft=[]/snapshot=null` 且无 `risk.*` pending：前端只读，服务端拒改，原行不变；构造任一 snapshot `undetermined` 或 applicable 非支持投入：AJV 失败；合法五类快照通过。                                                           |
| 验证     | AJV fixture + contract generate/check/drift；Domain/Application；PostgreSQL flow；Web composable/workbench/result/NPI；API/Web lint/typecheck；repo/diff。                                                                                                                                       |
| 禁止     | 不回退 S1F2 空草稿/静态提示，不改业务门槛、不新增迁移或 UI 结构；不提交、不推送、不改 brief 状态。                                                                                                                                                                                               |
| 停止条件 | 返回 `ready-for-review`；若无法仅用现有风险字段识别历史边界则返回 `blocked`，不得从五面内容推断风险。                                                                                                                                                                                            |

### 修复切片 `S1F4-risk-e2e-acceptance`

| 项目     | 内容                                                                                                                                                                                                                                                                                    |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 依据     | S1F3 代码、契约、迁移与 focused/full Web 门禁通过，但现有 `workbench-network.spec.ts` 和 `product-npi-workbench.spec.ts` 没有风险草稿、严格门、冻结结果或 NPI 风险快照场景；旧三视口用例只证明五面流程未回归，不能验收本片岗位结果。                                                    |
| 写入范围 | `apps/web/e2e/workbench-network.spec.ts`、`apps/web/e2e/product-npi-workbench.spec.ts`；如 mock 类型需要同步，只改 frontmatter 已列 Web 测试路径。                                                                                                                                      |
| 实现要求 | 扩展选品主流程 mock 与交互：初始五类未判断阻断 approve；逐项填写至少覆盖 applicable+supports、not_applicable+理由，并覆盖一项 undetermined/validate 只能 defer 的服务端回执；完整立项后结果态展示五类冻结摘要，NPI 只读消费同一 snapshot。保持三视口工作态/结果态截图和 overflow JSON。 |
| 验收反证 | 三项目 1440×900/1024×768/390×844 中，若风险摘要/当前风险/主动作不可见或溢出则失败；请求体必须含五类各一次且无内部推断；result/NPI 必须显示中文适用性与判断，不出现内部码；缺失 legacy 快照明确显示历史未记录。                                                                          |
| 验证     | 选品专项三项目 E2E、NPI E2E、真实截图与 overflow；Web lint/typecheck；`git diff --check`。                                                                                                                                                                                              |
| 禁止     | 不改生产组件来迎合测试，不模拟规则目录或带风险立项，不删除既有五面/单位经济/责任验收；不提交、不推送、不改 brief 状态。                                                                                                                                                                 |
| 停止条件 | E2E 与人工截图通过后 `ready-for-review`；如真实视口无法同时承接五面和风险主线，返回 `blocked` 由主代理调整 UI，不得降低断言。                                                                                                                                                           |

### 修复切片 `S1F5-summary-first-shared-editor`

| 项目     | 内容                                                                                                                                                                                                                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 依据     | S1F4 E2E 72/72 通过，但主代理逐张人工核对三视口截图发现风险摘要/当前风险未进入工作态首屏：组件仍按“完整五面区含编辑器 → 风险区”排列，违反 frontmatter 的“五面摘要 → 风险摘要 → 当前风险 → 动作”，自动化全绿不能替代视觉门禁。                                                          |
| 写入范围 | `ProductInitiativeReviewPanel.vue` 及测试、`ProductSelectionWorkbench.vue`/测试（仅事件接线需要时）、`workbench-network.spec.ts` 三视口几何/顺序断言；均已在 frontmatter。                                                                                                             |
| 实现要求 | 将五面与风险改为两组连续摘要导航，后接一个共享当前编辑区；点击五面项显示一个五面编辑器，点击风险项显示一个风险编辑器，同一时刻只存在一个编辑区。默认当前项可保持客户与需求，但风险摘要必须在首屏/同一业务顺序可见。保持 PR #147 的桌面/窄屏 16px、移动 12px 内容边距和右栏固定主动作。 |
| 验收反证 | DOM 顺序必须为 opportunity → business summary → risk summary → active editor → professional followup；三个视口截图中风险摘要、当前阻断和主动作可见/可达且不溢出；页面不得同时存在 business/risk 两个编辑器；结果态与 NPI 不回归。                                                      |
| 验证     | ReviewPanel/Workbench focused；Web full；选品三视口 E2E + NPI E2E；working/result 截图与 overflow JSON；lint/typecheck/build；repo/diff。                                                                                                                                              |
| 禁止     | 不缩小字体、不折叠风险摘要、不把五类铺成长表单、不改变业务状态/契约/服务端；不提交、不推送、不改 brief 状态。                                                                                                                                                                          |
| 停止条件 | 真实截图通过后 `ready-for-review`；如 1440×900 仍无法同时看到两组摘要和主动作，则压缩机会事实/辅助说明，不隐藏业务状态。                                                                                                                                                               |

### 修复切片 `S1F6-risk-editor-truth-and-evidence`

| 项目     | 内容                                                                                                                                                                                                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 依据     | fresh Codex（GPT-5.6）独立复审确认三项当前范围 finding：`PSR-S1F5-001` 尚不能判断没有关键未知输入，导致允许的 defer 路径无法保存；`PSR-S1F5-002` 不适用但缺理由未进入本地阻断；`PSR-S1F5-003` 适用但未选投资判断时摘要误显示“不支持投入”。另有验证缺口：风险迁移自身完成记录未直接断言，且现有 `.tmp` 截图早于 S1F5。           |
| 裁决     | 三项 finding 均 `accepted`：它们分别违反草稿条件、严格门可见缺口和“不得发明业务结论”，必须在当前 brief 修复。迁移断言与新截图作为当前验收证据补齐，不改变业务政策。`product-npi-workbench.spec.ts` 已是本片 NPI 快照验收消费者，补入 frontmatter 精确写入范围；不扩大生产范围。                                                 |
| 写入范围 | `ProductInitiativeReviewPanel.vue` 及测试、`useProductInitiativeDecision.ts` 及测试、`product-initiative-migration-upgrade.integration.test.ts`、`workbench-network.spec.ts`；只在 NPI 回归证据需同步时修改已补列的 `product-npi-workbench.spec.ts`。                                                                           |
| 实现要求 | 1) `undetermined` 显示并保存关键未知；2) `not_applicable` 缺理由保持具体阻断并禁用 approve；3) applicable + null investment decision 明确显示“尚未判断投资结论”，只有 `does_not_support` 显示“不支持投入”；4) migration-upgrade 直接断言 risk migration 记录完成；5) 重新生成 S1F6 三视口 working/result 截图和 overflow JSON。 |
| TDD 反证 | 先增加会失败的组件/组合式测试：尚不能判断可输入关键未知并形成 defer 草稿；不适用空理由仍 `missing/canApprove=false`；适用空投资判断不显示“不支持投入”。先证明失败，再最小修复并跑 focused/full Web。迁移测试先改为对风险迁移完成记录断言并运行专项集成测试。                                                                    |
| 验收反证 | 输入 `undetermined + criticalUnknown` 后 defer 成功且刷新恢复；清空关键未知时服务端前保持显式阻断；`not_applicable + 空理由` 行与右栏仍显示具体缺口且 approve 禁用；`applicable + null` 只显示未判断，不伪造 does_not_support；三视口顺序、共享单编辑器、当前阻断、主动作和无横向溢出由新截图人工核对。                         |
| 验证     | ReviewPanel/composable focused red→green；migration-upgrade PostgreSQL；Web full；选品三视口 E2E + NPI E2E；fresh working/result 截图与 overflow JSON；lint/typecheck/build；Prettier；`git diff --check`。                                                                                                                     |
| 禁止     | 不改服务端既定状态/路由规则，不允许带风险立项，不新增规则目录、角色或字段，不把空关键未知静默补值，不用旧 S1F2 截图冒充当前证据，不提交、不推送、不改 brief 状态。                                                                                                                                                              |
| 停止条件 | 修复和新截图通过后 `ready-for-review`；如真实 UI 无法承接关键未知输入与首屏顺序，返回 `blocked`，不得隐藏字段或放宽 Domain 门禁。                                                                                                                                                                                               |

### 修复切片 `S1F7-first-screen-risk-density`

| 项目     | 内容                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 依据     | S1F6 代码与门禁已闭合三项风险事实 finding，但主代理逐张人工核对 fresh 截图仍确认视觉门禁失败：1440×900 的风险摘要从约 y=852 才开始，只露出标题/首项边缘；1024×768 从约 y=721 才开始，无法看到五类状态；390×844 虽进入风险区，但底部固定动作覆盖第五类风险，当前风险编辑器从约 y=856 才开始。自动化顺序、E2E 全绿和 overflow=0 不能替代 frontmatter 要求的首屏五类风险状态、当前阻断、主动作与移动端业务顺序。 |
| 写入范围 | `ProductSelectionWorkbench.vue`/测试（只压缩机会事实、辅助审计或工作态垂直占用）、`ProductInitiativeReviewPanel.vue`/测试（只优化摘要密度与共享编辑器进入方式）、`workbench-network.spec.ts` 三视口几何/截图；均已在 frontmatter。                                                                                                                                                                            |
| 实现要求 | 1) 1440×900 首屏同时看到五面摘要、五类风险全部状态、当前阻断和主动作；2) 1024×768 保持相同业务顺序，五类风险摘要完整可见，编辑器紧随其后且动作不遮挡；3) 390×844 按对象事实→五面摘要→五类风险摘要→当前风险→动作连续可达，固定动作不得覆盖第五类风险或当前编辑器；4) 优先压缩机会事实、交接审计和辅助说明的垂直占用，可将非当前办理必需内容渐进披露；不缩小字体、不隐藏风险状态、不折叠五类摘要。              |
| TDD 反证 | 先把三视口 E2E 几何断言改为：五类摘要最后一项在约定可视区域内、固定动作不与风险摘要/当前编辑器重叠、DOM 仍只有一个共享编辑器；先运行并看到现有布局失败，再最小调整生产布局。组件/页面测试覆盖压缩后仍保留当前对象、来源、五面/风险摘要、恢复入口和结果态。                                                                                                                                                    |
| 验收反证 | 新截图若 1440×900 或 1024×768 不能读到五类风险全部状态，或 390×844 的平台限制/当前风险被固定动作遮挡，则失败；不得用滚动可达、DOM 存在、文字包含或 bounding box 单项数值替代人工视觉判断。结果态与 NPI 不回归，三视口无页面级横向溢出。                                                                                                                                                                       |
| 验证     | Workbench/ReviewPanel focused red→green；Web full；选品三视口 E2E + NPI E2E；新 S1F7 working/result 截图与 overflow/overlap JSON；主代理逐张人工核对；lint/typecheck/build；Prettier；`git diff --check`。                                                                                                                                                                                                    |
| 禁止     | 不改变业务状态、契约、服务端、证据或风险门槛；不缩小字体、不隐藏/折叠五类风险、不删除五面/单位经济/责任验收、不用 sticky 覆盖内容、不提交、不推送、不改 brief 状态。                                                                                                                                                                                                                                          |
| 停止条件 | 新截图真正满足三视口强制结构后 `ready-for-review`；若仅靠现有壳内压缩仍无法达到，返回 `blocked` 由主代理裁决渐进披露范围，不得降低断言。                                                                                                                                                                                                                                                                      |

## 业务步骤五面映射

| 业务步骤与岗位结果   | 岗位任务来源/状态 | 相关数据事实子集                                    | 技术保障                                          | 权限边界                   | 界面承接                     | 验收证据/状态 |
| -------------------- | ----------------- | --------------------------------------------------- | ------------------------------------------------- | -------------------------- | ---------------------------- | ------------- |
| 逐项判断风险适用性   | PSR-D01 approved  | 五类 draft；适用/不适用/未知；理由、证据、关键未知  | 契约条件、固定排序、证据归属、部分草稿恢复        | planning.draft + tenant    | 五行摘要，单项编辑，未知显式 | design        |
| 严格风险投资门       | PSR-D02 approved  | 完整五类 assessment + 既有五面/单位经济/资源        | Domain 门禁、合法去向、事务、幂等、并发、原子失败 | 沿用服务端授权，不新增角色 | 右栏具体缺口和允许动作       | design        |
| NPI 只读接收风险快照 | `08` §4.2/§5.3    | immutable risk snapshot + evidenceRefs；legacy null | 不可变、版本化、历史不回填                        | NPI read/claim             | 结果态和 NPI 冻结摘要        | design        |

### 相关数据事实子集

| 轨道                 | 字段/事实                                                                                    | 来源                  | 建议承载                         | 决策/状态          |
| -------------------- | -------------------------------------------------------------------------------------------- | --------------------- | -------------------------------- | ------------------ |
| `current_physical`   | 五面、单位经济、资源承诺、旧 reviewPoints、通用 evidence；Web 本地 professional requirements | 当前 Schema/契约/实现 | 保留既有事实；移除前端适用性权威 | verified           |
| `approved_gap`       | 五类风险、三态适用性、严格门、risk draft/snapshot、NPI 只读                                  | D1 + PSR-D01/D02      | JSON current/handoff + Domain    | approved           |
| `industry_candidate` | 自动风险推荐、规则目录、风险分级带条件立项                                                   | 未来方案 B            | 不进入 V1 Schema/生产 UI         | undecided/deferred |

## 验收

- [x] 五类风险由公共契约和 Domain 单一解释，前端不推断适用性
- [x] 未知不能显示为不适用，且稳定阻断 approve
- [x] 不适用必须有理由；适用项必须有判断、结论和合法证据
- [x] 验证态只能暂缓，不支持投入只能不立项/修改，均不得退回市场
- [x] approve 同时满足风险、五面、单位经济和资源门槛
- [x] defer/reject 可保存部分风险草稿，刷新、任务切换和冲突不串线
- [x] 新立项冻结风险快照并汇总证据；NPI 只读消费同一快照
- [x] completed legacy 不回填、不产生风险缺口；pending legacy 可恢复
- [x] 空库和真实旧库迁移、幂等、并发、原子失败通过
- [x] 固定三栏及 1440×900、1024×768、390×844 视觉顺序与边距通过人工截图验收
- [x] fresh 独立复审、完整门禁和最终 CI 通过

## 进度 log

| 日期       | 阶段    | 负责        | commit | 说明                                                                                                                                                                                                |
| ---------- | ------- | ----------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-07 | design  | Claude Code | —      | 负责人选择严格投资门 A，确认五类风险并保留未来版本化规则建议边界；建立正式规格，不进入实现。                                                                                                        |
| 2026-10-08 | fix     | Claude Code | —      | 主代理验收 S1：定向门禁通过，但确认契约条件/唯一性、真实旧库升级、completed legacy、单项编辑、选品结果快照及前端权威移除未闭合；建立 S1F1，继续同一 brief，不新增负责人暂停点。                     |
| 2026-10-08 | fix     | Claude Code | —      | 主代理验收 S1F1：契约、单项编辑和结果摘要已闭合；进一步确认默认 undetermined 被全量提交、风险 legacy 守卫、真实旧库升级及旧前端适用性权威仍未闭合，建立 S1F2 连续修复。                             |
| 2026-10-08 | fix     | Claude Code | —      | 主代理验收 S1F2：空草稿、迁移重放和静态证据提示已闭合；确认 PR #146 后有五面无风险的 completed legacy 仍未锁定，且 snapshot 契约仍允许严格门不可能产生的未知/非支持状态，建立 S1F3。                |
| 2026-10-08 | fix     | Claude Code | —      | 主代理验收 S1F3/S1F4：契约、legacy、迁移、API/Web 与 72 项 E2E 通过；人工截图确认风险摘要未进入三视口工作态主线，建立 S1F5，共享单一编辑器，不降低视觉门禁。                                        |
| 2026-10-08 | fix     | Claude Code | —      | 主代理验收 S1F3：契约、legacy、迁移、API/Web focused/full 和静态门禁通过；确认现有 E2E 无任何适用风险工作态/冻结结果/NPI 快照覆盖，建立 S1F4 后再做三视口最终验收。                                 |
| 2026-10-08 | review  | Codex       | —      | fresh GPT-5.6 独立复审发现 3 项当前范围风险：尚不能判断无关键未知输入、不适用空理由未本地阻断、适用未选判断却误显示不支持投入；另缺风险迁移完成断言和 S1F5 新截图。                                 |
| 2026-10-08 | fix     | Claude Code | —      | 主代理接受 PSR-S1F5-001～003，建立 S1F6 按 TDD 修复编辑、缺口与摘要事实，并补风险迁移断言和 fresh 三视口证据；不改变既定业务政策。                                                                  |
| 2026-10-08 | review  | Claude Code | —      | 主代理验收 S1F6：三项风险事实 finding 和迁移断言已闭合，但 fresh 截图证明 1440/1024 首屏看不到五类完整状态、390 固定动作覆盖第五类；建立 S1F7，不以自动化全绿替代视觉门禁。                         |
| 2026-10-08 | review  | Claude Code | —      | 主代理逐张验收 S1F7 三视口截图通过：两组摘要、五类风险、当前阻断、共享编辑器与动作顺序清晰且无覆盖；完整门禁除全仓 format:check 被既有 `.pytest_cache` EPERM 阻塞外，其余阶段及改动路径格式均通过。 |
| 2026-10-08 | blocked | Claude Code | —      | 负责人已授权 fresh Codex 复审，但 Claude Code 环境仍以数据外传策略拒绝调用；未绕过。brief 保持 `coding`，不宣称独立复审、最终 CI 或任务完成。                                                       |
| 2026-10-09 | review  | Codex       | —      | 负责人手工转发标准 TASK 至 fresh GPT-5.6；独立复审确认 PSR-S1F5-001～003 全部 addressed，最终累计集成 `verdict: pass`、`findings: []`、`writes: none`。                                             |
| 2026-10-09 | review  | Claude Code | —      | 本地高风险门禁通过 repo/contract/drift/dictionary/lint/typecheck、Web 698 + API 1474 单测、PostgreSQL 195 集成、Playwright 172 passed/7 skipped、build 与改动路径格式；最终 CI 待 PR。              |
| 2026-10-09 | done    | Claude Code | —      | PR #149 的 `changes/static/unit/build/e2e/dictionary/quality` 全部通过，`security` 按条件跳过；合并状态 `CLEAN`，task brief 完成。                                                                  |
