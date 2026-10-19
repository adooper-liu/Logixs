---
status: blocked
branch: docs/p6-workbench-action-index-v1
owner: main
writer: main
risk: low
dependsOn: []
writeScopes:
  - docs/planning/tasks/p6-workbench-action-index-v1.md
exclusiveLocks: []
sharedIntegrationScopes:
  - .claude/discussion/2026-10-19-利润-成本-工作台映射-讨论意见稿.md
authorityRefs:
  - AGENTS.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - doc/cross-border-supply-chain/wisdom-baseline/README.md
  - doc/cross-border-supply-chain/wisdom-baseline/全局.md
  - doc/cross-border-supply-chain/wisdom-baseline/*（24 份）
---

# 任务：23 工作台已有动作索引视图（D1）

> 当前为候选设计稿全集的一部分，未触发 `业务开工`，因此保持 `blocked`；负责人选择本线开工后，D1 应先恢复为 `design`，完成来源审计后再供 D2～D6 消费。

## 已有 vs 补强（定位先行）

| 项目                        | 现状             | 本 brief 归类 | 依据与边界                                          |
| --------------------------- | ---------------- | ------------- | --------------------------------------------------- |
| 23 个工作台及岗位结果       | 已有             | 正式来源      | `08-role-workbenches.md` 第三节                     |
| 正式 `doc/` 中的允许动作    | 已有或待逐台复审 | 正式动作来源  | `08-role-workbenches.md`、寻源/补货等正式工作台权威 |
| wisdom-baseline 原文措辞    | 必读基线         | 候选输入      | 不是业务权威；无法证实负责人原话时不得标为已定动作  |
| 工作台 × 动作索引与稳定编号 | 尚未集中         | **视图**      | 只索引和编号已有动作，不增加、不改名、不合并动作    |
| 动作数量、密度与覆盖统计    | 尚未集中         | 派生视图      | 只能从索引机械计数，不作为业务政策                  |

**本任务不是新开动作体系。** 它只把 23 工作台的正式动作与智慧基线候选措辞分轨整理为可追溯索引；没有新动作、新字段、新状态或新权限。

## 目标

产出一份“工作台 → 已有动作”的索引视图，作为 D2～D6 的唯一动作来源。每个索引项保留原文措辞、来源位置和权威状态，避免后续 brief 从讨论稿或技术实现反向发明动作。

## 来源顺序

1. `08-role-workbenches.md` 第三节：确认 23 个工作台、stable code、岗位结果与类型。
2. `08-role-workbenches.md` 逐台规格、`03-sourcing-and-replenishment-workbenches.md` 等正式 `doc/`：提取已经进入业务权威的允许动作。
3. `wisdom-baseline/README.md`、`全局.md` 与对应工作台原文：作为必读基线逐条标注沿用 / 补强 / 修正 / 存疑 / 与权威冲突；无法证实负责人原话时只进入 `baseline_candidate` 轨。
4. 正式权威与智慧基线冲突时记录冲突，不自行裁决，也不从实现反推答案。
5. 讨论稿给出的“约 172 个动作 / 平均 7～9 个动作”保留为 `discussion_derived` 盘点目标，不是正式权威计数；最终数量由逐行来源审计决定。

## 讨论稿盘点目标：约 172 个动作

负责人本轮要求保留“接收 / 评审 / 落账 / 交接”四时相与约 172 个动作的概念骨架。D1 的职责是逐行核验这个派生清单：

- `172` 是讨论稿展开后的目标盘点数，最终数以逐行来源审计为准；
- 每行同时标 `source_tier`，正式权威动作与 baseline / discussion 候选不得混算；
- `booking`、`export_customs`、`compliance_operations` 的 17 个动作只能标 `planned`，不计入当前生产动作；
- 四时相是检查动作链是否完整的派生分类，不是强迫每台机械拥有四种动作；
- 缺接收、评审、落账或交接依据时标为缺口，不由 D1 补造动作。

## 产出结构

| 字段                     | 说明                                                                 |
| ------------------------ | -------------------------------------------------------------------- |
| `workbench_code`         | 第三节稳定 code                                                      |
| `workbench_name`         | 第三节正式名称                                                       |
| `action_code`            | 本视图稳定编号；编号不改变动作语义                                   |
| `action_name`            | 原文动作措辞，不重命名                                               |
| `source_tier`            | formal_authority / baseline_candidate / discussion_derived           |
| `source_ref`             | 文件 + 节/段落指针                                                   |
| `authority_state`        | 已定 / 候选 / 未知 / 与权威冲突；只有 formal_authority 可标已定动作  |
| `phase`                  | 接收 / 判断 / 执行 / 落账 / 交接；仅在原文可证明时填写               |
| `handoff_relation`       | 与 `08-role-workbenches.md` 第十七节交接要素的关系；不适用时明确说明 |
| `production_write_state` | 已有 / 无生产写动作 / 未知；不由页面或 API 存在性推导                |

一个工作台没有正式动作时，只记录工作台级覆盖元数据，不伪造“无生产写动作”为动作行。`booking`、`export_customs`、`compliance_operations` 按 `08-role-workbenches.md` 第三节后的批准边界标注为无生产写动作。

## 执行切片 `produce-existing-action-index-v1`

- 逐台读取对应智慧基线，不复制或改写原文。
- 为每个原文动作分配稳定 `action_code`，并填写来源与权威状态。
- 建立 23 工作台覆盖检查；覆盖检查不要求每台存在生产写动作。
- 从最终索引机械派生统计，统计不得成为新权威。

## 共同纪律

1. 正式动作必须有正式业务权威来源；智慧基线措辞只能进入 `baseline_candidate` 轨。
2. 候选、未知和冲突保持原状态，不静默补全。
3. 不以当前代码、schema、页面、API、测试或讨论稿倒推动作。
4. 不写回或覆盖 `wisdom-baseline/` 原文。
5. 后续 D2～D6 引用正式动作时必须使用本索引的 `action_code`，不得另建动作全集。

## 五面边界

| 面   | 本任务结论                          |
| ---- | ----------------------------------- |
| 岗位 | 不改变岗位责任，只索引原文动作      |
| 数据 | 不新增字段或 schema，只产出文档视图 |
| 技术 | 无运行时变更                        |
| 权限 | 不新增 capability 或角色政策        |
| 界面 | 不建设生产 UI                       |

## 验证

- 覆盖 `08-role-workbenches.md` 第三节全部 23 个 stable code。
- 每个正式动作行都有正式权威来源；每个基线候选都有基线来源和 `baseline_candidate` 标识。
- 无来源动作数为 0；被标成“已有”的讨论稿动作数为 0。
- 不硬编码“22 trigger”或“172 动作”为验收数量。
- `pnpm repo:check` 与 scoped Prettier 通过。

## 不做

- 不增加、重命名、合并或删除业务动作。
- 不改业务权威、schema、契约、代码或 UI。
- 不把索引完成称为任一工作台闭环或成熟度提升。
