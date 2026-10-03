---
status: design # design | coding | review | fix | blocked | done（机器可校验）
branch: # git 初始化后填：feat/<任务名>
verification: # 仅 status: done 时必填：CI/测试运行 URL 或受版本控制的验证记录路径
owner: main # 端到端主代理；design/coding/fix 必填
writer: codex # 当前唯一写入者的工具编码，按 AGENTS.md §1.2 第 4 条映射填写；design/coding/fix 必填，独立复审默认只读
risk: medium # low | medium | high；design/coding/fix 必填
dependsOn: [] # task brief 文件名（不含 .md）；依赖未 done 时不得写
writeScopes: # design/coding/fix 必填；精确文件，或目录/**；不得使用其它 glob
  - docs/planning/tasks/<任务名>.md
exclusiveLocks: [] # 例如 database-schema / authz-control-plane / business-policy:<id>
sharedIntegrationScopes: [] # 可并行开发、最终必须串行同步的文件
authorityRefs: # 当前任务引用的既有权威；不得在此复制正文
  - AGENTS.md
---

# 任务：<简短标题>

> 复制本文件为 `docs/planning/tasks/<任务名>.md`，作为执行、评审与交接的**唯一载体**。
> 状态以文件顶部 frontmatter 的 `status` / `branch` 为准，改状态就改 frontmatter，不要在正文另写自由文本状态。
>
> 调度规则统一见 `AGENTS.md` §1.2 第 17～23 条：`design` 不占两个 `coding/fix` 名额，但与 `coding/fix`
> 一样声明调度元数据并参与 writer、依赖、写范围和独占锁冲突检查；主代理排定任务与业务优先级，并负责最终技术集成与合并。`done` 必须在 frontmatter 的
> `verification` 填写验证证据地址，未验证不得标 `done`。聊天只传任务文件名、分支名与起点命令，不互贴长状态。
> `authorityRefs` 只表示读取；修改权威时还须把路径放入 `writeScopes` 并加对应锁。`repo:check` 只验证当前
> checkout 的 brief，不核对其他 worktree 或实际 diff；主代理下发、复审和集成前核对在途任务、声明范围与实际差异，后续由薄编排器自动化。

## 目标

（要达成的行为，1–3 句）

## 边界 / 不做

（引用权威来源：`ENGINEERING_RULES` / `AGENTS` / 架构文档 / 数据模型；明确不越界的范围）

> 授权任务须分别写明：本次不可关闭的安全不变量、需要实现的可演进政策、仍由业务模块承担的前置条件、
> 当前已确认角色/范围，以及明确延期且只阻塞相关动作的未来政策。不得把“覆盖所有未来角色”写成完成门槛；
> 已证实的跨租户绕过也不得包装成可配置项延期。

## 执行切片与代理交接（多代理或跨会话任务必填）

> 详细规则见 `AGENTS.md` §1.3。以下信封用于代理消息或 PR 描述，不在仓库另建 handoff 文件。
> 需求、规则和验收只写在本 brief；消息只传本文件、切片 ID、准确 SHA 和工作区/PR 指针。
>
> 同一 brief 的连续切片默认共用一个任务集成分支和一个最终 PR；切片可以形成可回滚提交，但不是默认 PR
> 边界。下表的验证命令是切片定向检查；完整门禁、适用的独立复审和 PR 由主代理在任务级收口执行。只有独立发布、
> 独立回滚、长期并行或风险隔离有证据时才拆 PR，并在本 brief 记录理由。外部环境迁移或人工验收单列为
> deployment/done gate，只阻止生产部署与 `done`，不无故阻止代码开发、提交、PR 审查与合并。

### 切片 `<slice-id>`

| 项目     | 内容                                                                                |
| -------- | ----------------------------------------------------------------------------------- |
| 基线     | `<commit-sha>`                                                                      |
| 执行角色 | 角色、工具与实际模型，按 `AGENTS.md` §1.2 第 4 条映射填写（经转发的工具填实际模型） |
| 复审     | `不适用` 或 独立复审：工具与实际模型，须符合 `AGENTS.md` §1.2 第 4 条的模型家族要求 |
| 写入范围 | 精确文件或目录                                                                      |
| 禁止范围 | 不得顺带修改的模块、契约、状态或入口                                                |
| 验证命令 | 切片最近测试、模块 lint/typecheck、专项门禁及预期非零结果                           |
| 停止条件 | `ready-for-review` 后停手；是否允许提交；哪些情况返回 `blocked`                     |

主代理下发任务：

```text
TASK docs/planning/tasks/<task>.md#<slice-id> base=<commit-sha> role=<implementer|reviewer> [workspace=<worktree-path|pr-url>] [mode=<review-mode>]
```

实现执行器交回实现：

```text
HANDOFF docs/planning/tasks/<task>.md#<slice-id> base=<current-review-base-sha> role=main workspace=<worktree-path|pr-url> commit=<sha|none>
```

> `HANDOFF` 必须是 `ready-for-review` 交回消息第一行；`base` 使用可复现当前差异的真实审核基线，不能沿用已经
> 快进、变基或合并前的初始 `TASK` SHA。单行指令后附以下状态信封，不复制 brief 或长篇 diff。

```yaml
protocol: logix-handoff/v1
slice: <slice-id>
state: ready-for-review # ready-for-review | blocked
base: <commit-sha>
worktree: <absolute-path>
changed:
  - <file-or-summary>
checks:
  - command: <exact-command>
    result: pass | fail | expected-fail | not-run
    detail: <count-or-reason>
exceptions: []
commit: none # 默认未提交；已获授权时填 SHA
```

独立复审交回技术评审：

```yaml
protocol: logix-review/v1
slice: <slice-id>
baseline: <commit-sha>
reviewed: <worktree-diff|base...head|pr-url>
verdict: findings # no-findings | findings | blocked
findings:
  - id: <slice-id>-<domain>-01
    severity: blocking | high | medium | low
    type: confirmed | risk | verification-gap | policy-decision
    evidence: <file:line-or-contract-clause>
    impact: <concrete-failure-scenario>
    acceptanceProbe: <test-or-counterexample>
    suggestedDisposition: accepted | rejected | pending-owner
unknowns: []
verificationGaps: []
writes: none # 独立复审固定只读；提交、PR 和 CI 证据由主代理在集成阶段记录
```

主代理裁决评审：

```yaml
protocol: logix-disposition/v1
slice: <slice-id>
decisions:
  - finding: <finding-id>
    status: accepted | rejected | pending-owner
    reason: <evidence-based-reason>
    writeback: <existing-brief-contract-adr-path|none>
next: fix | pr | owner-decision
```

## 负责人决策记录（业务、工作台、架构或公共契约任务必填）

> 只记录会改变业务政策、公共契约、安全边界、不可逆成本或用户结果的决定。主代理先核对事实，
> 每轮向负责人提供 2～3 个互斥选项和明确推荐；每项写清理由、成本、收益、风险、可逆性和证据状态。
> 未定事项标为 `pending`，只阻塞受影响范围。负责人结论必须写回 `doc/` 或 ADR；brief 不成为第三套业务权威。

| 决策 ID | 已知事实与未知 | 选项、成本/收益/风险/可逆性 | 推荐与理由 | 负责人结论 | 权威落点 / 状态 |
| ------- | -------------- | --------------------------- | ---------- | ---------- | --------------- |
| D-01    |                | A / B / C                   |            |            | `pending`       |

## 验收

- [ ] 目标岗位能按真实操作顺序完成约定业务结果，而不只是看到数据或调用成功
- [ ] 每个业务步骤的岗位任务、相关数据事实、技术保障、权限边界和界面承接均有状态与证据；缺少任一面时未宣称工作台闭环完成
- [ ] 关键路径覆盖判断、允许动作、结果反馈，以及适用的阻塞/拒绝/恢复场景
- [ ] 非关键缺失允许部分保存并进入持久待补；刷新或重新进入后可继续处理
- [ ] 正常对象可批量处理，异常对象可逐条恢复；若不适用须在方案中说明
- [ ] 相关质量门禁全绿（写出实际命令：`pnpm validate` / `pytest` / `npm run validate` 等）
- [ ] 完整门禁在最终 PR 候选上执行；后续未改变相关风险面时不重复运行
- [ ] 外部环境/迁移/人工验收若适用，已单列 deployment/done gate，不与代码门禁混用
- [ ] 授权任务已分清固定安全不变量、可演进政策和领域业务前置；本任务影响面内已知跨租户绕过清零，范围外已证实绕过有独立负责人及合并/发布阻断，未来角色未被穷举为当前完成条件
- [ ] 任务特有验收项

## 业务步骤五面映射（业务功能或 UI 必填）

> 工作台固定按“岗位任务 + 相关数据事实子集 + 技术保障 + 权限边界 + 界面承接”同步推进；每一行必须对应同一个业务步骤，
> 并分别记录状态和证据。非业务/UI 底层任务必须说明直接消费者、使用场景和后续承接切片，不得留空。

| 业务步骤与岗位结果 | 岗位任务来源/状态 | 相关数据事实子集 | 技术保障 | 权限边界 | 界面承接 | 验收证据/状态 |
| ------------------ | ----------------- | ---------------- | -------- | -------- | -------- | ------------- |
|                    |                   |                  |          |          |          |               |

权限边界逐动作填写：最低 capability、租户范围、账套主体范围、对象范围、拒绝原因与审计证据；
“有权执行”和“业务条件允许执行”必须分列验证，不得以角色名、前端隐藏按钮或领域状态代替授权；
只覆盖当前已定动作和已知消费者，不以预定义全部未来角色为完成条件。

### 相关数据事实子集（三轨，工作台任务必填）

> 只列本台当前业务步骤实际消费的数据事实，不以全库字段字典完成为前置。三轨不得混写：`current_physical`
> 只陈述可验证现状；`approved_gap` 必须引用 `doc/` 或 `doc/adr/`；`industry_candidate` 只作候选。行业候选的
> 业务适用性未经负责人定案并写回 `doc/` 或 `doc/adr/`，不得进入实现；技术 ADR 只能承接定案后的架构选择，
> 不能替代业务定案。承载方式只能填写字段、关系、历史记录、不可变快照、事件、约束、派生投影、操作规则或
> `undecided`；为 `undecided` 时只阻塞依赖该事实的实现，不得默认新增数据库列。

| 轨道                 | 字段/事实 | 对应业务步骤与消费者 | 当前证据/来源 | 适用理由 | 收益 | 实施与维护成本 | 不采用风险 | 可逆性/退出方案 | 建议承载方式 | 决策 ID | 决策与实现状态                         |
| -------------------- | --------- | -------------------- | ------------- | -------- | ---- | -------------- | ---------- | --------------- | ------------ | ------- | -------------------------------------- |
| `current_physical`   |           |                      |               |          |      |                |            |                 |              |         | structure-confirmed / semantic-pending |
| `approved_gap`       |           |                      |               |          |      |                |            |                 | `undecided`  |         | approved / blocked-on-carrier          |
| `industry_candidate` |           |                      |               |          |      |                |            |                 | `undecided`  |         | pending                                |

## 20 台共同最低可用线（工作台任务必填）

> 含义唯一引用 `doc/cross-border-supply-chain/08-role-workbenches.md` 的 `WB-B01`～`WB-B10`。
> 每项填写本台适用性、当前证据、本切片承接和最终验收证据；单个切片可部分完成，但不得据此宣称整台通过。

| 基线                                      | 本台适用性与业务理由 | 当前事实 / 缺口 | 本切片承接 | 验收证据 / 状态 |
| ----------------------------------------- | -------------------- | --------------- | ---------- | --------------- |
| `WB-B01` 岗位结果、主选择源、主动作       |                      |                 |            |                 |
| `WB-B02` 上游交接、本岗新建、批量导入     |                      |                 |            |                 |
| `WB-B03` 回退/重开、作废/归档、受限删除   |                      |                 |            |                 |
| `WB-B04` 当前/下一责任、截止、等待原因    |                      |                 |            |                 |
| `WB-B05` 事实、缺口、异常、观测、同步分轨 |                      |                 |            |                 |
| `WB-B06` 正常批量、异常逐条恢复           |                      |                 |            |                 |
| `WB-B07` 不可变交接快照与版本             |                      |                 |            |                 |
| `WB-B08` 结果与流动效率指标               |                      |                 |            |                 |
| `WB-B09` AI 辅助边界                      |                      |                 |            |                 |
| `WB-B10` 六类真实路径验收                 |                      |                 |            |                 |

## 工作台避坑检查（业务功能或 UI 必填）

- [ ] 首屏按业务原因和紧迫度组织，不按数据库表、接口资源或技术状态组织
- [ ] 已明确哪些内容由系统产生，哪些必须由人员选择、录入或承担责任确认
- [ ] 已有权威事实自动带入；界面不要求填写内部 ID、归组键或重复录入已有数据
- [ ] 每个缺口显示当前值、来源值、候选值、责任人、影响动作和一个直接处理入口
- [ ] 已区分“待补”和“阻断”，并说明每项缺失真正限制的动作
- [ ] 页面只有一个当前对象主选择源和一个随阶段变化的主动作
- [ ] 生命周期、资料完整度、异常/阻断和外部观测没有混成一个综合状态
- [ ] 待办、待补和结果来自服务端事实或可重建投影，刷新、退出和重进后不丢失
- [ ] 正常项默认收拢或批量处理，逐条操作只服务于冲突、例外和高风险确认
- [ ] 操作后重新读取服务端结果，并区分成功、等待、业务拒绝、技术失败和并发冲突

## 方案（design 阶段填写）

（决策、涉及文件清单、步骤；必要时先改文档再改代码）

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先，每条对应文件/行号或 commit）

## 进度 log（谁改谁 append，一行一条）

| 日期       | 阶段   | 负责 | commit | 说明 |
| ---------- | ------ | ---- | ------ | ---- |
| YYYY-MM-DD | design | —    | —      | 初稿 |
