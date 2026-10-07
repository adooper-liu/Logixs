---
status: design
branch: feat/product-selection-applicable-risk-assessment-v1
owner: main
writer: main
risk: high
dependsOn:
  - product-selection-five-dimension-business-case-v1
writeScopes:
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - doc/cross-border-supply-chain/wisdom-baseline/选品立项.md
  - docs/planning/tasks/product-selection-applicable-risk-assessment-v1.md
exclusiveLocks:
  - business-policy:ps-applicable-risk-assessment
sharedIntegrationScopes: []
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
| 基线        | 设计 PR 合并后的 `main`                                                                                                                                                    |
| 执行角色    | 实现执行器：Codex（GPT-5.6）                                                                                                                                               |
| 复审        | 高风险：fresh Codex 只读复审公共契约、状态/责任语义、迁移、证据、快照和核心工作流                                                                                          |
| 写入范围    | 实现前由主代理依据最终设计差异列出精确路径；包含契约/生成物、Schema/迁移/字典、product-selection Domain/Application/Repository/DTO、Web/NPI、相关测试                      |
| 禁止范围    | 自动规则目录、推荐来源字段、逐风险责任/NPI 接受、权限新能力码、Q1/P1/U1/组合优化/M1、下游合规规则泛化                                                                      |
| UI 强制结构 | 逐项遵守 frontmatter 五项，保持既定三栏、信息顺序和响应式边距                                                                                                              |
| 验证命令    | contract/check/drift；Domain/Application；真实 PostgreSQL flow + migration upgrade；API/Web lint/typecheck/full unit；三视口 E2E/截图；dictionary；repo/diff；最终完整门禁 |
| 停止条件    | 完成后 `ready-for-review`，不得提交/推送/改 brief 状态；如需带风险立项、规则目录、角色拆分或新数值阈值则返回 blocked                                                       |

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

- [ ] 五类风险由公共契约和 Domain 单一解释，前端不推断适用性
- [ ] 未知不能显示为不适用，且稳定阻断 approve
- [ ] 不适用必须有理由；适用项必须有判断、结论和合法证据
- [ ] 验证态只能暂缓，不支持投入只能不立项/修改，均不得退回市场
- [ ] approve 同时满足风险、五面、单位经济和资源门槛
- [ ] defer/reject 可保存部分风险草稿，刷新、任务切换和冲突不串线
- [ ] 新立项冻结风险快照并汇总证据；NPI 只读消费同一快照
- [ ] completed legacy 不回填、不产生风险缺口；pending legacy 可恢复
- [ ] 空库和真实旧库迁移、幂等、并发、原子失败通过
- [ ] 固定三栏及 1440×900、1024×768、390×844 视觉顺序与边距通过人工截图验收
- [ ] fresh 独立复审、完整门禁和最终 CI 通过

## 进度 log

| 日期       | 阶段   | 负责        | commit | 说明                                                                                         |
| ---------- | ------ | ----------- | ------ | -------------------------------------------------------------------------------------------- |
| 2026-10-07 | design | Claude Code | —      | 负责人选择严格投资门 A，确认五类风险并保留未来版本化规则建议边界；建立正式规格，不进入实现。 |
