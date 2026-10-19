---
status: design
branch: docs/p6-financial-projection-4d-view-v1
owner: main
writer: main
risk: low
dependsOn:
  - p6-workbench-action-index-v1
  - p6-abc-field-mapping-v1
  - p6-charges-three-segment-fields-v1
  - p6-quasi-loss-ladder-mapping-v1
  - p6-exception-risk-acceptance-fields-v1
writeScopes:
  - docs/planning/tasks/p6-financial-projection-4d-view-v1.md
exclusiveLocks: []
sharedIntegrationScopes:
  - .claude/discussion/2026-10-19-利润-成本-工作台映射-讨论意见稿.md
  - doc/cross-border-supply-chain/01-authoritative-business-chain.md
  - doc/cross-border-supply-chain/02-upstream-core-business-objects.md
authorityRefs:
  - AGENTS.md
  - doc/cross-border-supply-chain/01-authoritative-business-chain.md
  - doc/cross-border-supply-chain/02-upstream-core-business-objects.md
  - doc/cross-border-supply-chain/03-sourcing-and-replenishment-workbenches.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - doc/cross-border-supply-chain/wisdom-baseline/README.md
  - doc/cross-border-supply-chain/wisdom-baseline/全局.md
  - doc/cross-border-supply-chain/wisdom-baseline/费用.md
  - doc/adr/ADR-006-separate-state-event-date-task.md
  - doc/adr/ADR-008-plan-does-not-overwrite-actual.md
  - docs/architecture/decisions/ADR-010-bounded-context-modules.md
  - doc/adr/ADR-014-plan-versioning-and-ai-authority.md
---

# 任务：已有财务投影的 4 维视图、时间分轨落实与对账派生（D5）

## 已有 vs 补强（定位先行）

| 项目                              | 现状         | 本 brief 归类           | 依据与边界                                           |
| --------------------------------- | ------------ | ----------------------- | ---------------------------------------------------- |
| 业务对象与业务身份                | 已有         | 4 维中的对象维视图      | 权威业务链、核心对象关系、D1                         |
| 计划 / 预计 / 实际分离            | 已有约束     | 时间事实逐项落实清单    | ADR-006/008 约束相关日期事实；不扩成全字段三态模型   |
| 金额、币种、单位经济与费用事实    | 已有且分散   | 金额维视图              | 工作台权威、费用智慧基线、D2/D3                      |
| 人员决定、理由、证据和版本        | 已有规则     | 决策维视图              | ADR-014、交接规则                                    |
| 4 维结构                          | 尚未集中     | **视图**                | 对已有字段分组，不新建 schema                        |
| `净 = 收入 − 成本` 与 actual 反推 | 用户指定规则 | **派生 + 对账候选规则** | §7 口径；不得倒推为已有 schema 或自动异常工作流      |
| 每字段时间事实缺口                | 尚未逐项核对 | **补强清单**            | 落实既有 plan / commitment / projected / actual 分轨 |

**“双面账投影”实际对应讨论稿 §7，不是 §5。** §5 是 `charges` 三段闭环，由 D3 承接；D5 不重写三段闭环，也不新建 52 字段全集或独立 schema。

## §7 双面账投影的重新定位

双面账投影是已有财务投影字段的**视图 / 派生 / 补强集合**。本 brief 只产出三份文档视图：

1. 已有字段 → 对象 / 时间 / 金额 / 决策 4 维映射；
2. 已有时间事实分轨在逐字段上的落实清单，至少区分 plan / commitment / projected / actual，不要求业务上不适用的字段机械铺满；
3. actual → plan / projected 的反推对账规则。

D5 不独立造字段；它收口 D1/D2/D3 的现有产物，并对 D4/D6 尚未获权威的候选内容保持显式隔离。

## §7.1 已有底子

| 现有权威                                                | 已有内容                                                            | 4 维位置               |
| ------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------- |
| `01-authoritative-business-chain.md` 选品段             | 目标到岸成本、退出条件                                              | 对象 + 金额（plan）    |
| `02-upstream-core-business-objects.md` 总落地成本       | 原始条件、归一假设与总落地成本                                      | 对象 + 金额            |
| `08-role-workbenches.md` 4.2                            | 基准 / 保守单位经济；售价、到岸成本、平台费、履约费、广告、退货成本 | 对象 + 金额 + 决策     |
| `08-role-workbenches.md` 金额规则                       | 金额定点、币种、原始费用与汇率边界                                  | 金额                   |
| `03-sourcing-and-replenishment-workbenches.md` 方案比较 | 成本、时间、库存、利润、现金、风险变化                              | 对象 + 时间 + 决策摘要 |
| `wisdom-baseline/费用.md`                               | 事前减损、账单核定 / 争议、分摊付款关账                             | actual 成本事实        |
| ADR-006/008/010/014                                     | 事实分轨、计划不覆盖实际、模块所有权、AI 不替人                     | 时间 + 决策 + 来源边界 |

引用时使用稳定章节 / 规则说明；历史行号只能作为辅助定位，引用前须核对当前文本。

## §7.2 文档 (a)：4 维结构视图

负责人本轮确认“双面账底账”采用同一对象、同一时间口径下的收入面 / 成本面 / 净面，并用以下候选字段目录核对当前承载；目录是设计视图，不是已批准 schema：

- 收入面 R：售价、销量、收入、退货、COGS、毛利 / 贡献利润、收入窗口与 FX；
- 成本面 C：采购、物流、仓储、持有、关税 / 税、缺货损失、落地成本、现金占用、增量成本、成本窗口与 FX；
- 净面 N：总收入、总成本、贡献利润 / 利润率，以及 D4 获批后才可出现的准损失兑现 / 风险敞口候选；
- 所有字段必须带稳定对象、时间事实类别、金额 + 币种、来源 / 版本和决定责任；缺项标“缺 / 待定”，不默认建列。

| 字段 / 关系 | 现有权威出处 | 所属维度 | 何时产生 | 谁写 / 谁确认 | 当前承载状态 |
| ----------- | ------------ | -------- | -------- | ------------- | ------------ |

四维固定为：

- **A 对象**：稳定业务身份、空间、期间与场景；同一对象可以有收入 / 成本 / 净三面，但不能重复计数；
- **B 时间**：plan / commitment / projected / actual 与来源版本；D4 候选状态只作 overlay；
- **C 金额**：金额、币种、数量 / 期间基础、原始值与归一值；
- **D 决策**：责任人、决定时间、理由、证据、版本与不可变交接。

一项事实可以进入多个维度，但不得复制成多个权威字段。字段不存在或语义未知时明确标记，不从 schema 名称猜测。

## §7.3 文档 (b)：时间事实分轨逐字段补强清单

| 字段 / 关系 | plan | commitment | projected | actual | 缺失类别 | 补强路径 | 生产者 / 确认者 | 权威依据 |
| ----------- | ---- | ---------- | --------- | ------ | -------- | -------- | --------------- | -------- |

规则：

- plan / commitment / projected / actual 来自 ADR-006/008 与核心对象权威的既有分轨要求；D5 不把它们定义成全字段状态枚举。
- 缺失类别只允许“业务上不适用”“已有但未集中投影”“schema 未落”“业务语义未知”。
- “schema 未落”不自动授权新增列；必须回到对应工作台已有业务规则与后续实施 brief。
- 各类时间事实不得互相覆盖；更正保留版本和替代关系。

## §7.4 “调拨 7 项”派生摘要

`03-sourcing-and-replenishment-workbenches.md` 的方案比较要求每个方案展示 7 项：预计到达时间、增量成本、缺货损失、现金占用、平台和合规限制、对其他仓库的影响、成功可能性。

负责人本轮确认：7 项是给补货负责人看的决定摘要，双面账投影是同一对象、同一时间口径下的收入面 + 成本面 + 净面底账；`7 项 ⊂ 双面账投影`，前者不被后者替换。

| 调拨 7 项        | 底账派生来源类别                         | 边界                                                 |
| ---------------- | ---------------------------------------- | ---------------------------------------------------- |
| 预计到达时间     | lifecycle / plan / projected 时间窗口    | 保留来源、版本和新鲜度                               |
| 增量成本         | 方案相对基线的成本差                     | 不能只存摘要结果                                     |
| 缺货损失         | 缺货天数 × 日均销量 × 单位毛利等候选公式 | 公式、输入和适用条件须另有权威；示例金额不是项目事实 |
| 现金占用         | 库存 / 采购 / 期间金额事实               | 不得无汇率来源跨币种相加                             |
| 平台和合规限制   | compliance / customs 专业决定            | 双面账只引用，不重算专业结论                         |
| 对其他仓库的影响 | inventory pool / 调拨模拟                | 保留原节点与假设                                     |
| 成功可能性       | 风险评估与历史事实                       | 当前来源缺口明确显示，不由 AI 静默给值               |

每个摘要值必须记录 `derived_from`、来源版本与 `recorded_at`；底账字段缺失时摘要显示“缺 / 待定”，不得用看似精确的默认值补根。

## §7.5 文档 (c)：actual → plan / projected 反推对账

派生公式：

```text
净 = 收入 − 成本
```

对账规则：

1. 对存在 plan 或 projected 的 actual，按同一业务身份、币种 / 汇率口径、时间窗口和版本显式反推；业务上不存在前序计划时标为“不适用”，不伪造关联。
2. 反推结果区分“匹配”“业务上无对应计划”“引用缺失”“币种 / 版本不可比”，不得静默归零。
3. 反推失败先形成可见对账缺口；是否自动创建 `exceptions` 案件、何时触发和由谁关闭仍是待定运行政策。
4. 原始费用、原始币种、归一假设和实际金额都保留，派生净额不覆盖任一原始事实。
5. 对账触发点与关闭责任由消费工作台的既有闭环决定；D5 不新建运行时工作流。

## §7.6 三道安全门禁（实施停止条件）

三门不属于 D5 功能设计，但决定任何金额 / 归属 / 责任写动作能否进入生产：

| 门禁                         | 最低保障                                        | 未验真时的停止条件       |
| ---------------------------- | ----------------------------------------------- | ------------------------ |
| `authz-default-deny`         | 服务端明确验证谁能写哪类金额事实                | 禁止收入、成本、净额写入 |
| `web-oidc-session`           | `decided_by / recorded_by` 来自当前真实登录会话 | 禁止责任人和决定落账     |
| `tenant-account-owner-scope` | 投影落到具体账套主体，不停在租户根              | 禁止跨主体金额归属和对账 |

首当其冲的候选缺口是收入侧 R3、成本侧 C5/C6/C9/C10/C11 与净侧 N5，但门禁适用于所有金额、归属和责任写动作。三门必须同时成立；双面账设计完成不等于可上线，三门解开也不等于双面账已完成。门未开时仍允许文档设计、来源盘点和 brief 评审，但不得新增生产 schema 或写真实数据。

## §7.7 与其他 brief 的关系

- D1：提供已有动作、工作台身份和生产 / 确认时点来源。
- D2：提供成本、收入、触发、责任方和来源的逐动作分类。
- D3：提供 `charges` 三段闭环的现有事实与已定字段缺口。
- D4：提供 5-action 阶梯、22 个候选 trigger 与 `quasi_loss_realization_record` 的设计 overlay；只有写回正式权威后，才进入净面 N5/N6。
- D6：提供风险接受与 `cost_basis_justification` 候选 overlay；只有写回正式权威并解决对象范围后，才进入决策维。

## 共同纪律

1. D5 不新建 52 字段全集，不重写 schema，不重新定义既有“7 项”或单位经济口径。
2. 每个映射项都要有现有权威、所属维度、产生时点与写入 / 确认责任。
3. D4/D6 讨论稿内容不能冒充现有字段；未定案时从正式 4 维视图中隔离。
4. 找不到依据的字段不进入视图；要新增业务语义时走新开业务权威 / ADR 路径。
5. 页面、API 或 schema 字段存在不等于财务事实已闭环。
6. 本设计涉及金额、跨工作台事实和对账异常政策；进入实施前必须安排独立复审。

## 五面边界

| 面   | 本任务结论                                    |
| ---- | --------------------------------------------- |
| 岗位 | 不改变岗位责任，只显示谁何时写 / 确认已有事实 |
| 数据 | 视图、派生和缺口清单；不修改 schema           |
| 技术 | 不建设运行时投影或对账作业                    |
| 权限 | 不新增 capability；决策仍由授权人员确认       |
| 界面 | 不建设生产 UI                                 |

## 验证

- 三份文档产物齐全，且每项都能追溯到现有权威或明确标为候选。
- plan / commitment / projected / actual 缺口逐字段表达，未知不被填成 0。
- 对账规则保留原始金额、币种、版本和异常路径。
- 不出现“新增 52 字段”“D5 改 schema”或把 §5 当双面账投影的表述。
- `pnpm repo:check` 与 scoped Prettier 通过。

## 不做

- 不修改 schema、迁移、契约、代码或 UI。
- 不替 D3 重写 `charges` 三段闭环。
- 不替 D4/D6 把讨论稿新内容写成权威。
- 不把 4 维视图称为财务总账或完整财务系统。
