---
status: blocked
branch: docs/p6-charges-three-segment-fields-v1
owner: main
writer: main
risk: medium
dependsOn: []
writeScopes:
  - docs/planning/tasks/p6-charges-three-segment-fields-v1.md
exclusiveLocks:
  - charges-workbench-fields
sharedIntegrationScopes:
  - database/schema.prisma
  - apps/api/src/modules/charges/**
  - .claude/discussion/2026-10-19-利润-成本-工作台映射-讨论意见稿.md
authorityRefs:
  - AGENTS.md
  - docs/architecture/decisions/ADR-010-bounded-context-modules.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - doc/cross-border-supply-chain/wisdom-baseline/README.md
  - doc/cross-border-supply-chain/wisdom-baseline/全局.md
  - doc/cross-border-supply-chain/wisdom-baseline/费用.md
  - docs/planning/tasks/p6-overdue-accrual.md
  - database/schema.prisma
  - docs/product/domain/COST_SETTLEMENT_BUSINESS_SAMPLE_013.md
---

# 任务：`charges` 工作台三段闭环字段补强（D3）

> 当前为候选设计稿全集的一部分，未触发 `业务开工：charges`，因此保持 `blocked`；正文可引用 D1/D2 的未来产物，但当前不登记未完成硬依赖。

## 已有 vs 补强

| 三段                    | 已有                                            | 补强（必须有依据）                                                                                                                                                                                                                           |
| ----------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 段 1 事前减损           | `schema.prisma:3318,3342` 超期标准 + 阶梯       | 下列精确字段名均为讨论稿 `candidate_shape`：`projection_id` / `service_window_*` / `fee_type` / `fee_basis`、`near_threshold_alert.*`、`dispute_window_tracker.*`；业务缺口依据费用三段闭环，字段形态仍须后续定案                            |
| 段 2 账单核定           | 无（`p6-overdue-accrual.md:25` 明示该薄片不写） | `bill_identification.*` / `fact_matching.*` / `line_level_verification.*` / `duplicate_detection.*` / `accrual_vs_bill_diff.*` / `approved_amount.*` / `dispute_initiation.*` 均为讨论稿 `candidate_shape`；业务能力依据账单核定段           |
| 段 3 分摊付款交接与关账 | 无（`p6-overdue-accrual.md:25` 明示该薄片不写） | `allocation.*` / `fx_conversion.*` / `payment_handover.*` / `payment_result_receipt.*` / `period_closing.*` / `post_closing_adjustment.*` 均为讨论稿 `candidate_shape`；原始费用保留和跨币种来源 / 日期来自 `08-role-workbenches.md:519-520` |

**定位：D3 已经是“补强 + 视图”，不是新开费用域，也不是双面账投影。** 本轮只把共同纪律要求的对照表前置，并修正漂移的 schema / ADR 引用与计数；三段闭环和补强字段口径不重写。

## 目标

按 `wisdom-baseline/费用.md` 已记录的三段方向（事前减损 / 账单核定 / 分摊付款交接与关账）并对照正式 `08-role-workbenches.md` 第十五节，补强 `charges` 工作台字段视图。动作总数仍以逐行来源审计为准，不再用相互矛盾的“14 / 16 / 14+1”作为验收前提。每项逐字段列“已有 vs 补强”；补强能力须有正式业务依据，精确字段名若仅来自讨论稿则标 `candidate_shape`。**不**把 D4 的 `quasi_loss_realization_record` 纳入 D3。

## 边界 / 不做

- 不替 `wisdom-baseline/费用.md` 原文改写（按 AGENTS.md §1.2.1 第 13 条）
- 不增加新 ADR（除非明确需要新 ADR）
- 不直接改 `database/schema.prisma` — 本 brief 是设计稿，落库需另起 task brief + `业务开工：charges`
- 不在 `charges` 内加跨工作台写权限；`authz-default-deny`、`web-oidc-session`、`tenant-account-owner-scope` 三门未同时验真前，只允许设计 / 评审，不得新增生产金额 schema 或写真实数据
- 不做准损失阶梯字段（D4 brief 处理）
- 不替 `exceptions` 工作台设计字段（D6 brief 处理）

## 智慧开启基线

| 现有文档                                      | 已有底子                                                      |
| --------------------------------------------- | ------------------------------------------------------------- |
| `wisdom-baseline/费用.md` 三段决策            | 事前减损 / 账单核定/争议 / 分摊付款交接与关账                 |
| `schema.prisma:3318,3342`                     | 超期费用标准 + 费率阶梯（已有）                               |
| `p6-overdue-accrual.md:25`                    | "不写账单、审核、支付"（明示缺口）                            |
| `COST_SETTLEMENT_BUSINESS_SAMPLE_013.md:3,59` | 加拿大进口单柜 7 类费用粒度样本（多数审核/请款/付款字段为空） |
| `ADR-010:24`                                  | 费用域拥有账单与对账，且不得以费用状态推进物流主流程          |
| `08-role-workbenches.md:519-520`              | 金额定点+币种+跨币种汇率+原始费用保留                         |
| `08-role-workbenches.md` §十五                | 费用结算工作台岗位目标与权威事实段                            |

## 三道安全门禁（实施停止条件）

三道门相互独立，必须同时通过：

- `authz-default-deny`：服务端明确允许当前能力写对应金额事实；
- `web-oidc-session`：责任人来自当前真实登录会话；
- `tenant-account-owner-scope`：金额落到具体账套主体，不停在租户根。

门未开时允许继续设计、字段来源盘点和 brief 评审，但不得新增生产金额 schema 或写真实数据。三门全开也不等于三段闭环已经实现。

## 执行切片

### 切片 `produce-charges-field-list-v1`

| 项目       | 内容                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| 基线       | 当前 HEAD                                                                                                |
| 执行角色   | main                                                                                                     |
| 主代理审查 | main 自审                                                                                                |
| 独立复审   | 三段金额、公共事实与安全门禁在进入实施前必须独立复审                                                     |
| 写入范围   | 本 brief 末尾"产出"章节                                                                                  |
| 禁止范围   | 不得修改 `database/schema.prisma`、任何 `apps/api/src/modules/charges/**`、ADR、`08-role-workbenches.md` |
| 验证命令   | `pnpm repo:check`                                                                                        |
| 停止条件   | 三段业务能力逐项列出；每项有 current_physical / approved_gap / candidate_shape 分轨；无依据字段为 0      |

### 切片完成后输出（写在 brief 末尾“产出”章节）

三段字段 / 关系清单；每项三件事：

1. 当前物理事实或候选字段 / 关系形态；
2. 正式业务依据、基线候选或讨论稿 `candidate_shape`；
3. 与 `charges` 三段闭环的对应关系。

**补强项的业务依据与字段形态来源必须分列。** 无业务依据的能力不进 brief；只有业务依据、没有字段依据时保留为 `candidate_shape`，不得冒充已定 schema。

## 缺口

- `p6-overdue-accrual.md:25` 只界定已完成预计 / 应计薄片“不写账单、审核、支付”；它不是禁止后续三段补强的长期政策，无需回写或“解除”历史 brief
- 三道安全门禁 `blocked` — 段 2/3 段写入需先解开（不在本 brief 范围）
- 跨币种 FX 治理（汇率源 / dated_at / 快照频率）— 候选，需负责人定案
- 财务系统集成（`payment_handover.finance_system_ref`）— 候选，需负责人定案
- 段 1 `dispute_window_tracker` 的法域候选全集（除 46 CFR Part 541 外）— 候选

## 五面（精简版）

| 面   | 结论                                                                                        |
| ---- | ------------------------------------------------------------------------------------------- |
| 岗位 | `charges` 工作台岗位责任不变（`08-role-workbenches.md` §十五）；本 brief 仅列字段不新增责任 |
| 数据 | 14 段字段补强；不在 `charges` 域内加跨工作台引用                                            |
| 技术 | 不涉及运行时；schema 落库需另起 task brief + `业务开工：charges`                            |
| 权限 | 段 2/3 段写入受三道门禁影响；本 brief 仅列字段不写权限设计                                  |
| 界面 | 不涉及 UI；纯字段列表                                                                       |

## 验证

- 三段业务能力逐项列出，动作行数以来源审计结果为准；D4 的 `quasi_loss_realization_record` 不计入 D3
- 每项 current_physical / approved_gap / candidate_shape 分轨齐全
- 正式补强能力 100% 有正式业务依据；讨论稿精确字段名全部标 `candidate_shape`
- `p6-overdue-accrual.md:25` 的薄片边界在 brief 中显式标注，不把它误作长期业务禁止
- `pnpm repo:check` 通过

## 不做

- 不改 `database/schema.prisma`
- 不进入 `operational` 成熟度
- 不替 `exceptions` 工作台 / 准损失阶梯写字段
- 不回写或“解除”已完成 `p6-overdue-accrual.md` 的历史薄片边界

## 待负责人定案

- 三段内各业务能力对应的最终字段 / 关系形态（当前精确字段名仅为 `candidate_shape`）
- 跨币种 FX 治理（汇率源 / dated_at / 快照频率）
- 法域候选全集（除 46 CFR Part 541 外）
- `original_fee_preserved = true` 是否进入 schema 强制约束（DB 层或应用层）
- 财务系统集成（`finance_system_ref`）的设计
