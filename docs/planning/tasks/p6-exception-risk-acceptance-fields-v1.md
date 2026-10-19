---
status: design
branch: docs/p6-exception-risk-acceptance-fields-v1
owner: main
writer: main
risk: medium
dependsOn:
  - p6-workbench-action-index-v1
  - p6-abc-field-mapping-v1
  - p6-quasi-loss-ladder-mapping-v1
writeScopes:
  - docs/planning/tasks/p6-exception-risk-acceptance-fields-v1.md
exclusiveLocks:
  - exception-risk-acceptance-fields
sharedIntegrationScopes:
  - .claude/discussion/2026-10-19-利润-成本-工作台映射-讨论意见稿.md
  - doc/cross-border-supply-chain/wisdom-baseline/异常中心.md
  - apps/api/src/modules/exception-management/**
authorityRefs:
  - AGENTS.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - doc/cross-border-supply-chain/wisdom-baseline/README.md
  - doc/cross-border-supply-chain/wisdom-baseline/全局.md
  - doc/cross-border-supply-chain/wisdom-baseline/异常中心.md
  - docs/architecture/decisions/ADR-010-bounded-context-modules.md
  - .claude/discussion/2026-10-19-利润-成本-工作台映射-讨论意见稿.md（讨论稿非权威）
---

# 任务：已有风险接受动作的字段补强候选（D6）

## 已有 vs 补强（定位先行）

| 项目                                               | 现状                | 本 brief 归类       | 权威状态                               |
| -------------------------------------------------- | ------------------- | ------------------- | -------------------------------------- |
| 异常中心取得专业处置或获批风险接受并归还原工作台   | 正式规则            | 业务底子            | `08-role-workbenches.md` 第十六节      |
| 专业事实仍归原业务域，异常中心只协调 / 升级 / 归还 | 正式规则            | 边界                | 第十六节、ADR-010                      |
| 接受人、时间、理由、证据、恢复条件等事实类别       | 部分已定 / 待盘点   | 字段视图            | 工作台共同规则；逐字段仍需物理事实核对 |
| `cost_basis_justification`                         | schema 中无已定字段 | **候选补强**        | 讨论稿新内容；尚未写回业务权威         |
| `cost_basis_justification` 与 5 阶的逐阶关系       | 负责人设计口径      | **候选视图 / 派生** | 依赖 D4 五阶写回正式权威后才能实施     |

**风险接受动作已有，但 `cost_basis_justification` 不是已有权威字段。** 本 brief 只在原有风险接受动作上描述候选补强，不把 D4 五阶或该字段静默升级为业务要求。

## 目标

先整理已有风险接受动作完成时必须可追溯的事实，再单独展示 `cost_basis_justification` 的候选价值、适用边界与新开决策门槛。只有后者经负责人定案并写回正式业务权威 / ADR 后，才能进入 schema 或实施 brief。

## 已有风险接受事实视图

| 事实类别                   | 现有依据                        | 业务作用                             |
| -------------------------- | ------------------------------- | ------------------------------------ |
| 异常对象与来源             | 异常中心智慧基线                | 知道哪个原业务域、对象和缺口进入异常 |
| 当前协调责任与专业责任     | R1/R2/R3 分层责任讨论及现有边界 | 协调责任不替代专业结论               |
| 风险接受决定人、时间、理由 | 最低保障与交接规则              | 防止匿名或 AI 自动接受风险           |
| 影响对象、期限和不处理后果 | 异常中心核心结果                | 说明为何需要接受或拒绝风险           |
| 专业事实 / EvidenceRef     | 专业域与证据边界                | 让决定可追溯，但不复制专业事实       |
| 恢复条件、归还目标与回执   | 异常中心唯一结果                | 确认原工作台可继续、重算或停止       |
| 更正 / 重开历史            | 工作台恢复规则                  | 新版本追加，不反写原决定             |

这些类别是视图，不等于当前 schema 已完整承载。物理字段缺口必须另行盘点，不能用本表伪造“已实现”。

## 5-action 成本论证候选映射

| 阶梯       | `cost_basis_justification` 候选最小内容              | 当前状态   |
| ---------- | ---------------------------------------------------- | ---------- |
| 1 清货     | `holding_cost_reduction`、清货变现金额、继续持有成本 | 讨论稿候选 |
| 2 暂停出运 | `cancellation_cost`、`next_voyage_delay_cost`        | 讨论稿候选 |
| 3 提价     | `unit_economic_variance`、销量影响与销售窗口         | 讨论稿候选 |
| 4 退市     | `delist_realized_loss`、处置成本、不可恢复日         | 讨论稿候选 |
| 5 暂缓 NPI | `npi_sunk_cost`、`opportunity_cost`                  | 讨论稿候选 |

数值示例只用于解释字段含义，不构成项目样本、阈值或统一公式。专业金额仍由原业务域 / charges 提供，exceptions 只保存决定所引用的论证和接受结果。

## 当前物理对象范围

当前 `OperationalExceptionCase` 物理模型仍要求 `containerRecordId`，Shipment 只是可选关联；它不能证明已能承接 NPI、选品、SKU × 市场或其他非货柜风险决定。因此 D6 的既有事实视图先覆盖当前可证明的 container / shipment 异常；若五阶需要跨对象风险接受，必须先由正式业务权威确认对象范围，再另行评审对象模型、迁移和兼容策略。

## `cost_basis_justification` 候选补强

候选目的：当风险接受会使可量化成本暴露继续存在时，要求决定人说明计量基础、替代方案成本和接受理由，而不是只写自由文本“接受风险”。

候选结构仅用于定案讨论：

| 候选组成           | 要回答的问题                   | 当前状态   |
| ------------------ | ------------------------------ | ---------- |
| `basis_type`       | 使用哪类成本 / 收益基础        | 讨论稿候选 |
| `amounts`          | 原始金额、币种、区间或未知表达 | 讨论稿候选 |
| `source_refs`      | 金额与假设来自哪里、版本是什么 | 讨论稿候选 |
| `alternatives`     | 不接受风险时的替代动作与成本   | 讨论稿候选 |
| `justification`    | 为什么在当前期限和证据下接受   | 讨论稿候选 |
| `review_condition` | 何时重判或失效                 | 讨论稿候选 |

在 D4 五阶未写回正式权威前，不把“所有五阶必须经 exceptions 风险接受”或“每一阶必须使用哪种 cost basis”表述成已上线政策，也不把候选结构转成数据库列。负责人本轮已收敛的设计稿要求是：五阶进入 `quasi_loss_cashable` 前必须经 exceptions 显式风险接受和成本论证；D6 负责保存这项候选字段设计与阻塞条件。

## 三道安全门禁（实施停止条件）

`authz-default-deny`、`web-oidc-session`、`tenant-account-owner-scope` 必须同时成立，才能把风险接受人、成本论证金额和账套主体安全落账。三门未同时验真前可以继续字段设计和评审，但不得把 `cost_basis_justification` 或相关责任 / 金额字段写入生产 schema、契约或真实数据。三门解开也不等于 D4/D6 业务政策已获批准。

## 执行切片 `separate-existing-risk-acceptance-from-candidate-fields-v1`

- 从异常中心智慧基线提取已有风险接受与结果归还事实。
- 对照当前 schema / 模块，区分“业务已定但物理未落”与“讨论稿新字段”。
- 将 `cost_basis_justification` 放入候选区，并列出采用前必须回答的业务问题。
- 不设计五阶内容，不建立跨表引用、FK、状态机或阈值。

## 共同纪律

1. 风险接受已有，不等于“风险接受是五阶前置”已经定案；二者关系仍是讨论稿候选。
2. `cost_basis_justification` 尚无正式权威，不能进入 schema、契约、API 或生产 UI。
3. 不新增 `risk_acceptance_id`、`escalation_threshold`、`tolerance_band_pct` 等无当前权威字段。
4. 异常中心不得拥有或重算清关、费用、生命周期等专业结论。
5. 找不到依据的字段走新开业务权威 / ADR 路径，不在本 brief 中用默认值补空。
6. 本设计涉及风险接受、金额与跨工作台控制面；负责人定案并写回权威后、进入实施前必须安排独立复审。

## 五面边界

| 面   | 本任务结论                                        |
| ---- | ------------------------------------------------- |
| 岗位 | 沿用异常中心协调、升级、风险决定与结果归还边界    |
| 数据 | 已有风险接受事实视图 + 一个明确隔离的候选字段集合 |
| 技术 | 不改 schema / API；不建立通用风险平台             |
| 权限 | 不新增 capability；风险接受仍须授权人员决定       |
| 界面 | 不建设生产 UI                                     |

## 验证

- 已有风险接受事实与讨论稿候选字段分表表达。
- `cost_basis_justification` 每次出现都标注“讨论稿新内容 / 未写回业务权威”。
- 未新增其他无依据字段、阈值或跨表引用。
- 专业事实所有权仍在原业务域。
- `pnpm repo:check` 与 scoped Prettier 通过。

## 待负责人定案 / 新开路径

- 是否把成本论证设为风险接受的业务必填项，以及适用哪些异常。
- 候选结构使用结构化金额、受控枚举、文本说明还是组合形式。
- 是否以及如何与 D4 五阶建立关系。
- 结论须先写回正式业务权威；涉及架构 / schema 取舍时另立 ADR，之后才能建立实施 brief。
