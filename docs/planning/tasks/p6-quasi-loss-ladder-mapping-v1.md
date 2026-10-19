---
status: design
branch: docs/p6-quasi-loss-ladder-mapping-v1
owner: main
writer: main
risk: medium
dependsOn:
  - p6-workbench-action-index-v1
  - p6-abc-field-mapping-v1
  - p6-charges-three-segment-fields-v1
writeScopes:
  - docs/planning/tasks/p6-quasi-loss-ladder-mapping-v1.md
exclusiveLocks:
  - quasi-loss-ladder-mapping
sharedIntegrationScopes:
  - .claude/discussion/2026-10-19-利润-成本-工作台映射-讨论意见稿.md
  - doc/cross-border-supply-chain/wisdom-baseline/费用.md
authorityRefs:
  - AGENTS.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - doc/cross-border-supply-chain/wisdom-baseline/README.md
  - doc/cross-border-supply-chain/wisdom-baseline/全局.md
  - doc/cross-border-supply-chain/wisdom-baseline/费用.md
  - doc/cross-border-supply-chain/wisdom-baseline/异常中心.md
  - .claude/discussion/2026-10-19-利润-成本-工作台映射-讨论意见稿.md（讨论稿非权威）
---

# 任务：已有动作的 5 阶准损失触发 mapping 与落账候选补强（D4）

## 已有 vs 补强（定位先行）

| 项目                                          | 现状             | 本 brief 归类      | 权威状态                                             |
| --------------------------------------------- | ---------------- | ------------------ | ---------------------------------------------------- |
| D1 的 23 工作台动作                           | 正式 / 候选分轨  | mapping 输入       | 仅 formal_authority 动作可作为当前动作；其余保留候选 |
| 费用三段闭环                                  | 正式规格 + 基线  | 结果承接边界       | `08-role-workbenches.md` 第十五节；不等于 5 阶       |
| 异常中心专业处置 / 获批风险接受               | 正式规格 + 基线  | 风险承接边界       | 第十六节支持一般风险接受，不自动证明五阶政策         |
| 清货 / 暂停出运 / 提价 / 退市 / 暂缓 NPI 五阶 | 尚未进入业务权威 | **讨论稿新内容**   | 只能形成条件式 mapping，不能实施                     |
| 已有动作 → 五阶触发 / reverse 映射            | 尚未形成         | **mapping + 派生** | 依赖五阶先获负责人定案并写回权威                     |
| `charges.quasi_loss_realization_record`       | schema 不存在    | **候选补强**       | 讨论稿新内容；未获新 ADR / 业务权威前禁止入 schema   |

**本任务不新建动作。** 它只对 D1 既有动作做条件式 mapping；五阶本身和落账字段仍是讨论稿新内容，不能因出现在 brief 中就被视为已定。

## 目标

回答两个分开的设计问题：

1. 若五阶获得业务定案，D1 哪些已有动作可以成为某阶的显式 forward / reverse 触发；
2. 若需要把准损失兑现为费用事实，`charges` 最小落账记录需要哪些可追溯事实。

在五阶与落账语义写回正式业务权威 / ADR 前，本 brief 只保留候选设计，不进入实施。若负责人定案，政策必须写入正式 `doc/` 业务权威；智慧基线只追加日期、依据与确认记录，不能反向成为业务权威。

## 已收敛候选：5-action 阶梯

负责人本轮确认保留以下设计稿结构，但它仍须写回正式业务权威后才能实施：

| 阶  | 名称     | 候选含义                                                          | `state_attr` 候选                     |
| --- | -------- | ----------------------------------------------------------------- | ------------------------------------- |
| 1   | 清货     | 低位库存清理；准损失兑现并降低仓储 / 持有成本，不等同普通亏损销售 | `quasi_loss_cashable`                 |
| 2   | 暂停出运 | 撤回已发布计划、取消订舱或取消出运                                | `quasi_loss_cashable`                 |
| 3   | 提价     | 外部销售价格上调；工作台只承接影响、决定和回执                    | `quasi_loss_cashable`                 |
| 4   | 退市     | 某 SKU × 市场 / 渠道永久下架                                      | `risk_exposure → quasi_loss_cashable` |
| 5   | 暂缓 NPI | NPI 项目暂停或终止，未来恢复需受控回开                            | `quasi_loss_cashable`                 |

候选定义：准损失是“当前未实现、但若继续持有或继续出运将转为损失的敞口”。五阶按轻 → 重设计，只允许向前；普通 forward、跨阶升级、reverse 与不可逆边界必须分别记录，跨阶跳跃必须由 `exceptions` 显式升级。负责人本轮要求所有五阶都经 `exceptions` 显式风险接受与成本论证，并由 `charges` 记录兑现；由于 exceptions 当前物理对象主要是 container / shipment，NPI、选品、SKU / 市场级决定在对象模型扩展前仍不能落地。

## 22 / 172 候选触发覆盖

讨论稿从约 172 个候选动作中标出 22 个 forward/reverse 候选，约 12.8%。D4 以它为审核目标，不把比例当权威结果：

| 阶         | 候选触发来源                                        | 工作台范围                                                          | forward / reverse 候选 |
| ---------- | --------------------------------------------------- | ------------------------------------------------------------------- | ---------------------- |
| 1 清货     | 风险事件关闭、提柜 go/no-go、国家 / 渠道 / 仓库调整 | demand_replenishment / pickup / shipment_planning                   | 3 / 0                  |
| 2 暂停出运 | 计划变更、释放备货、订舱变化、装箱 / 出运截点冲突   | shipment_planning / cargo_ready / booking / stuffing / dispatch     | 7 / 0                  |
| 3 提价     | 单位经济更新、批准执行需求                          | product_selection / demand_replenishment                            | 2 / 0                  |
| 4 退市     | 验货阻断、清关底线、法规变化、不支持投入、来源退回  | supply_readiness / customs / compliance_operations / market_signals | 8 / 1                  |
| 5 暂缓 NPI | 暂停 / 终止、不立项、受控回开                       | product_npi / product_selection                                     | 2 / 2                  |

每一行必须分别证明：(a) D1 中正式动作存在；(b) 本讨论稿为何候选映射到某阶；(c) 是否需要风险接受；(d) forward / reverse 是否可逆。缺任一项就标“待定 / 缺”，不计入已确认触发。

## 典型跨台候选链

- 清货：补货风险决定 → exceptions 风险接受 → 计划 / 执行决定 → charges 准损失兑现 → 成本反馈。
- 暂停出运：计划变更 → exceptions 风险接受 → 订舱 / 备货 / 出运受控停止 → charges 兑现。
- 提价：补货 / 选品单位经济决定 → exceptions 风险接受 → 外部销售动作回执 → 成本 / 收入反馈。
- 退市：合规 / 清关 / 供给阻断 → exceptions 风险接受 → 原业务域作退市决定 → charges 兑现。
- 暂缓 NPI：NPI 暂停 / 终止 → exceptions 风险接受 → 选品 / NPI 受控交接 → charges 兑现。

这些链只说明候选责任关系；exceptions 不替专业域作结论，charges 不触发阶梯，任何工作台不得用 mapping 直接推进他域状态。

## 条件式 mapping 产出

| `action_code` | `ladder_stage_candidate` | `direction`       | `explicit_decision_required` | `precondition`       | `result_boundary`            | `source_ref`               |
| ------------- | ------------------------ | ----------------- | ---------------------------- | -------------------- | ---------------------------- | -------------------------- |
| D1 已有动作   | 1～5 / 不适用 / 未知     | forward / reverse | 是                           | 既有状态、责任与证据 | 原业务域继续拥有正式动作结果 | D1 权威来源 + 讨论稿候选段 |

约束：

- 不得按动作名称、颜色、金额阈值或 AI 推断阶梯。
- mapping 不能创造 D1 中不存在的动作。
- `direction` 只表达候选关系，不改变任务、责任或状态。
- 无权威支持的映射保持“未知”，不能为追求覆盖率补齐。

## `quasi_loss_realization_record` 候选补强

该名称只作为候选聚合占位，不是已批准 schema。候选最小事实类别：

- 被兑现的现有动作 / 对象引用；
- 适用五阶与显式决定引用；
- 风险接受引用（如适用）；
- 原始金额、币种、计量基础与来源版本；
- 兑现时间、责任主体与 EvidenceRef；
- 与 D3 三段费用事实的关系；
- reverse / 更正采用追加版本，不反写历史。

每个候选字段必须在未来业务权威或 ADR 中获得依据后才能进入 schema。当前 brief 不定义表结构、类型、FK 或迁移。

## 三道安全门禁（实施停止条件）

`authz-default-deny`、`web-oidc-session`、`tenant-account-owner-scope` 是相互独立的安全门，不属于 D4 功能范围。在三门同时验真前：

- 可以继续设计、讨论、mapping 和 brief 评审；
- 不得把 22 个候选触发、`risk_acceptance_id`、`quasi_loss_id`、金额或责任人写入生产 schema / 真实数据；
- 不得仅因 capability、登录或账套主体其中一门完成就宣称可上线；
- 三门全开也只满足最低安全线，不证明五阶业务政策已获批准或功能已完成。

## 执行切片 `draft-conditional-ladder-mapping-v1`

- 只使用 D1 `action_code` 建立条件式 mapping 草案。
- 将五阶、forward / reverse、落账记录全部标注为讨论稿候选。
- 分开记录“现有权威依据”和“尚待新开决策依据”。
- 形成未来定案所需的最小反证：无显式人员决定、无责任 / 证据、无法回到原业务域时不得映射或落账。

## 共同纪律

1. 五阶不是 `wisdom-baseline/费用.md` 的既有三段闭环，也不是 `wisdom-baseline/异常中心.md` 的已定字段。
2. `quasi_loss_realization_record` 是新增 schema 候选；没有新业务权威 / ADR 前不得进入 schema、契约、代码或生产 UI。
3. D6 的 `cost_basis_justification` 同样是讨论稿候选，本 brief 只能引用其候选关系。
4. 所有动作必须来自 D1；找不到 D1 来源的触发动作不能进入 mapping。
5. 本 brief 不替负责人决定五阶是否成立、各阶定义、阈值或风险接受政策；风险接受是否为某个候选 mapping 的前置也必须逐项定案，不默认全部经过异常中心。
6. 本设计涉及经营状态语义、金额和风险接受；负责人定案并写回权威后、进入实施前必须安排独立复审。

## 五面边界

| 面   | 本任务结论                                              |
| ---- | ------------------------------------------------------- |
| 岗位 | 不新增动作或岗位；显式决定仍由原业务域 / 风险责任人作出 |
| 数据 | 只有候选 mapping 和候选落账事实类别，不改 schema        |
| 技术 | 无运行时实现                                            |
| 权限 | 不新增 capability；风险接受政策待业务定案               |
| 界面 | 不建设阶梯 UI                                           |

## 验证

- 讨论稿候选 mapping 中每个动作都能回到 D1 `action_code`，22 / 172 与 12.8% 仅作审计目标。
- 五阶与落账字段每次出现都标注“讨论稿新内容 / 未写回业务权威”。
- 三段费用闭环与五阶概念没有混写。
- 未产生 schema、契约、API 或 UI 实施要求。
- `pnpm repo:check` 与 scoped Prettier 通过。

## 待负责人定案 / 新开路径

- 五阶是否成为正式业务政策及其定义、顺序、适用对象和 reverse 规则。
- 哪些 D1 动作允许映射到各阶。
- `quasi_loss_realization_record` 是否需要持久化及其事实所有者。
- 以上结论须写回正式业务权威；涉及架构 / schema 取舍时另立 ADR，之后才能建立实施 brief。
