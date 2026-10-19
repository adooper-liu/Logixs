---
status: design
branch: docs/p6-abc-field-mapping-v1
owner: main
writer: main
risk: low
dependsOn:
  - p6-workbench-action-index-v1
writeScopes:
  - docs/planning/tasks/p6-abc-field-mapping-v1.md
exclusiveLocks: []
sharedIntegrationScopes:
  - .claude/discussion/2026-10-19-利润-成本-工作台映射-讨论意见稿.md
authorityRefs:
  - AGENTS.md
  - doc/adr/ADR-006-separate-state-event-date-task.md
  - doc/adr/ADR-008-plan-does-not-overwrite-actual.md
  - docs/architecture/decisions/ADR-010-bounded-context-modules.md
  - doc/adr/ADR-014-plan-versioning-and-ai-authority.md
  - doc/cross-border-supply-chain/01-authoritative-business-chain.md
  - doc/cross-border-supply-chain/02-upstream-core-business-objects.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - doc/cross-border-supply-chain/wisdom-baseline/README.md
  - doc/cross-border-supply-chain/wisdom-baseline/全局.md
  - doc/cross-border-supply-chain/wisdom-baseline/业务工作台持续打磨受阻原因.md
  - .claude/discussion/2026-10-19-利润-成本-工作台映射-讨论意见稿.md（讨论稿非权威）
---

# 任务：已有动作的 7 字段 ABC 映射视图（D2）

## 已有 vs 补强（定位先行）

| 项目                                 | 现状       | 本 brief 归类   | 依据与边界                                             |
| ------------------------------------ | ---------- | --------------- | ------------------------------------------------------ |
| D1 的 23 工作台已有动作              | 已有       | 输入            | D1 索引；不得新增动作                                  |
| 状态 / 事件 / 日期 / 任务分离        | 已有       | 映射规则        | ADR-006                                                |
| plan / projected / actual 不互相覆盖 | 已有约束   | 映射规则        | ADR-006/008 约束相关日期事实，不定义通用状态枚举       |
| 模块事实所有权与公开协作边界         | 已有       | 映射规则        | ADR-010                                                |
| AI 只建议、授权人员决定              | 已有       | 映射规则        | ADR-014                                                |
| 金额定点、币种、原始费用与交接要素   | 已有       | 映射规则        | AGENTS.md 金额纪律 + `08-role-workbenches.md` 金额规则 |
| 7 个列名与逐动作表                   | 讨论稿输入 | **视图 + 派生** | 讨论稿 §4 的映射词汇；不是 ADR 已定义字段              |

**本任务不是新建 ABC 数据模型。** 7 个列名来自讨论稿 §4 的映射词汇；ADR 与业务权威只约束各列可以填写的值，不能被表述为已经定义这 7 个字段。

## 目标

把 D1 中每个正式动作映射到 7 个分析列：归因对象、计量基准、触发、责任方、收入对象、状态属性、数据来源。每列允许 `unknown`、`not_applicable` 或 `candidate` 并附理由；不得为了填满矩阵而编造事实。映射用于后续 D3～D6 对照已有动作与财务事实，不替代业务权威或运行时契约。

## 共同账目语言

负责人本轮确认用 `利润 = 收入 − 成本` 作为 23 工作台共同的账目语言，而不是某一工作台的口号。D2 只建立归因视图：每个收入或成本数字必须能追到工作台、动作、时点、责任方和数据来源。

讨论稿的“4 台收入 / 13 台成本 / 4 台归功守门”保留为候选分类视图，但不是互斥分区：例如 `master_data` 同时提供收入对象身份与归功边界。最终验证要求是 23 个工作台全部被覆盖，允许一台多标签；纯权限、审计、法务解释等既不产生数字也不承担归功的治理动作标为 `not_applicable`。

## 候选输入矩阵与逐格证据

负责人本轮提供的“约 172 个候选动作 × 7 列 ABC”作为 D2 的候选输入矩阵。每个 D1 `action_code` 都必须补一层：归因对象 / 计量基准 / 触发 / 责任方 / 收入视角 / 状态属性 / 数据来源，并遵守：

- 每个单元格同时记录 `source_tier` 与 `source_ref`；
- `source_tier` 只允许 formal_authority / baseline_candidate / discussion_derived；
- 未锁定处使用“候选 / 待定 / 缺 / 不适用”，不得强填；
- `reasoning_service`、`self`、`*_owner` 等只有在正式身份 / 岗位权威可证明时才能成为责任方，否则标候选；
- planned 三台的动作保持 planned，不计入当前生产动作；
- D4 的 `risk_exposure` / `quasi_loss_cashable` 只作为候选 overlay，不进入 D2 的正式状态映射层。

## 7 字段及来源

| 映射列           | 含义                                                                     | 现有依据                                                                                     |
| ---------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `cost_object`    | 动作影响或归因的稳定业务对象                                             | `01-authoritative-business-chain.md`、`02-upstream-core-business-objects.md`、工作台岗位结果 |
| `cost_basis`     | 金额、币种、数量、期间或其他可核验计量基础                               | `08-role-workbenches.md` 金额规则；ADR-010 只约束事实所有权，不单独证明金额语义              |
| `cost_trigger`   | 动作何时因什么既有事实进入处理                                           | ADR-006 与工作台原文                                                                         |
| `cost_owner`     | 对判断或交接负责的已有岗位 / 责任主体；与身份、capability、对象范围分轨  | 工作台责任与交接规则；ADR-014 禁止 AI 代替决定                                               |
| `revenue_object` | 与该动作对应的收入、销售或经营对象；不适用时写明                         | 权威业务链与核心对象关系                                                                     |
| `state_attr`     | state / event / date / task 分类；相关日期再标 plan / projected / actual | ADR-006、ADR-008；不是通用五态枚举                                                           |
| `data_source`    | 权威事实、证据、版本或不可变交接来源                                     | ADR-006、ADR-010、工作台交接规则                                                             |

## 产出结构

| `action_code` | `cost_object`    | `cost_basis`       | `cost_trigger` | `cost_owner`     | `revenue_object`     | `state_attr` | `data_source` | `source_refs` |
| ------------- | ---------------- | ------------------ | -------------- | ---------------- | -------------------- | ------------ | ------------- | ------------- |
| D1 编号       | 现有对象或不适用 | 现有计量基础或未知 | 现有触发或未知 | 现有责任方或未知 | 现有收入对象或不适用 | 已有分类     | 已有来源      | 每列权威指针  |

未知必须写“未知”；业务上不适用必须写“不适用 + 理由”。不得用猜测值填满表格。

## 执行切片 `map-existing-actions-to-abc-v1`

- 逐行消费 D1 `action_code`，不接受 D1 外动作。
- 按字段定义填写现有事实，并为每个非空值附权威指针。
- 对无法证明的值标记未知；不为追求完整率新增字段或业务规则。
- 生成按工作台、对象和状态属性的派生视图，派生结果不写回业务权威。

## 共同纪律

1. 所有映射值必须能追溯到现有 ADR、业务权威或 D1 原文动作。
2. 7 列是视图，不是数据库列清单。
3. 不引入 5 阶准损失、`quasi_loss_cashable`、`risk_exposure` 或 `cost_basis_justification`；这些属于 D4/D6 的讨论稿候选。
4. 找不到依据的内容保持未知；若要成为业务要求，另行走新开业务权威 / ADR 路径。
5. 不从代码字段名推断业务语义。

## 五面边界

| 面   | 本任务结论                     |
| ---- | ------------------------------ |
| 岗位 | 不增加责任，只显示已有责任关系 |
| 数据 | 不新增 schema，只产出映射视图  |
| 技术 | 无运行时变更                   |
| 权限 | 不新增角色或 capability        |
| 界面 | 不建设生产 UI                  |

## 验证

- D1 每个 `action_code` 恰好出现一次。
- 7 个映射列命名稳定；每个非空值都有来源。
- 无“建议新增字段”或把讨论稿候选写成已有事实的行。
- 未知与不适用分开表达。
- `pnpm repo:check` 与 scoped Prettier 通过。

## 不做

- 不新增动作、字段、状态、权限或 schema。
- 不重写 ADR、工作台权威或 D1。
- 不把 ABC 映射称为业务闭环或财务账本。
