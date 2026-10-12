---
status: coding
branch: feat/cross-worktree-calibration-v1
owner: main
writer: main
risk: high
dependsOn:
  - transparent-development-calibration-v1
writeScopes:
  - docs/planning/tasks/cross-worktree-calibration-v1.md
  - docs/planning/tasks/thin-agent-orchestrator-v1.md
  - docs/INDEX.md
  - docs/superpowers/specs/2026-10-12-cross-worktree-calibration-design.md
  - docs/superpowers/plans/2026-10-12-cross-worktree-calibration.md
  - scripts/worktree-calibration.mjs
  - scripts/worktree-calibration.test.mjs
  - package.json
  - docs/planning/progress-board.html
exclusiveLocks:
  - repository-governance
  - root-tooling
  - worktree-calibration
sharedIntegrationScopes: []
authorityRefs:
  - AGENTS.md
  - ENGINEERING_RULES.md
  - docs/planning/tasks/_template.md
  - docs/superpowers/specs/2026-10-12-cross-worktree-calibration-design.md
---

# 任务：跨 Worktree 只读校准 V1

> 本 brief 是当前单元唯一实施载体。设计权威为
> `docs/superpowers/specs/2026-10-12-cross-worktree-calibration-design.md`。
> 本任务只观察 Git 已注册 worktree；不建立第二套状态，不读取未跟踪内容，不创建、同步、清理或删除任何 worktree。

## 路线图位置与目标结果

- **位置**：透明开发治理主线；承接 current-checkout calibration，位于远端 PR/CI evidence、RAID/checklist 链接门禁和自动调度之前。
- **直接用户**：在开工、复审和集成前核对在途 checkout 的当前 Claude Code 主代理。
- **核心结果**：从 Git 注册表、tracked brief 与只读 Git 事实，重建 active/dormant/dirty/unreadable 现场，并稳定报告 writer、scope、lock、dependency 和 WIP 冲突。
- **优先减少的损失**：减少历史 worktree 被误判为活动任务、真实写现场静默冲突、未归属 tracked 改动被忽略、untracked 内容被越界读取，以及旧多代理角色模型被重新实现。

## 当前治理与历史方向

### 现行角色模型

- 当前 Claude Code 主代理是唯一写入者，负责 brief、实现、验证、finding 裁决和 Git/PR 集成。
- 高风险任务完成后由一份 fresh Claude Code 只读上下文做整体技术复审。
- 本任务不设 Codex 编排者、Cursor 实现者、进程 adapter 或自动 TASK/HANDOFF 链路。

### 已废止但保留记录的历史方向

原 `thin-agent-orchestrator-v1` 于 2026-10-01 设计时采用 Codex/Cursor/Claude 协作、临时 run spec、PID/超时/取消和 manual/process adapter。该方向已被 `AGENTS.md` 当前 Claude-only 治理替代，不进入当前实现。

保留历史决定：

| 决策 ID    | 当时已知事实与选项                                | 当时结论                                             | 当前处置                                       |
| ---------- | ------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------- |
| `ORCH-D01` | A 直接采用附件 Bash；B 重写薄编排器；C 维持全人工 | 采用 B：复用 brief/信封，避免未验证 CLI 和第三套状态 | `superseded`：只沿用“薄、只读、不复制状态”原则 |

历史日志：

| 日期       | 阶段   | 负责  | commit | 说明                                                             |
| ---------- | ------ | ----- | ------ | ---------------------------------------------------------------- |
| 2026-10-01 | design | Codex | —      | 负责人确认当时的薄编排器方向；因治理与代理入口未就绪保持 blocked |
| 2026-10-01 | design | Codex | —      | 当时调整为有界并行；该角色实现路径现已被 Claude-only 治理替代    |

## 已批准的 Dormant 风险政策

- clean 且 fully merged：`dormant-merged`，只展示事实；
- clean 且仍有未合入提交：`dormant-ahead`，warning；
- 无 active brief 且 tracked dirty：`unowned-dirty`，blocking；
- untracked 路径：warning，只报告路径和数量，绝不读取内容；
- active task 的 writer/scope/lock/dependency/WIP 冲突：blocking；
- warning 永远不构成自动清理、删除或丢弃提交的授权。

## 直接消费者与使用场景

本任务不是业务/UI 功能，不适用工作台五面和 WB-B01～WB-B10。

| 消费者                | 使用场景                                   | 本任务结果                                   |
| --------------------- | ------------------------------------------ | -------------------------------------------- |
| 主代理                | 新写任务开工前核对已有 checkout            | active/dormant 与跨任务冲突投影              |
| 主代理                | 高风险复审和 PR 集成前核对用户工作保护     | tracked dirty、untracked、ahead/merged 事实  |
| fresh Claude 只读复审 | 判断校准是否漏读、越界读取或误阻塞历史现场 | 稳定 finding、真实 dry-run 和 no-change 证据 |
| 后续 board/hook 设计  | 消费已验真的跨 worktree 投影               | 明确接口，不在本任务提前接入                 |

## 边界 / 不做

- 不接入 `repo:check`、GitHub CI、progress board 跨-worktree区域或本地 hook；
- 不修改 `AGENTS.md` 或 task template；
- 不扫描目录发现未注册 worktree；
- 不调用 GitHub API；
- 不自动 fetch、pull、checkout、reset、clean、stash、rebase、merge、commit 或 push；
- 不创建、移动、锁定、解锁、repair、prune 或删除 worktree；
- 不读取 untracked 文件内容；
- 不建立 signals/reviews/run database；
- 不派发代理，不生成自动 TASK/HANDOFF，不调用外部进程 adapter；
- 不把绿色校准解释为 worktree 可删除、未合入提交可丢弃或任务已完成。

## 执行切片

### CWC1：治理载体与纯投影

| 项目     | 内容                                                                           |
| -------- | ------------------------------------------------------------------------------ |
| 基线     | `fe37c100` + 已批准 spec/plan 提交                                             |
| 执行角色 | 当前 Claude Code 主代理直接实现                                                |
| 写入范围 | 本 brief、docs index、纯 parser/classifier/projection/tests、现有 board ledger |
| 禁止范围 | Git adapter、CLI、真实用户 worktree 修改、board 跨-worktree UI                 |
| 验证命令 | 纯 fixture RED→GREEN、lint、format、repo/docs/board                            |
| 停止条件 | active/dormant 状态矩阵和集合冲突 finding 由纯函数稳定定义                     |

### CWC2：只读 Git adapter 与 CLI

| 项目     | 内容                                                                      |
| -------- | ------------------------------------------------------------------------- |
| 基线     | CWC1 验收后的当前 SHA                                                     |
| 执行角色 | 当前 Claude Code 主代理直接实现                                           |
| 写入范围 | worktree calibration 模块/tests、package script                           |
| 禁止范围 | Git 写命令、自动 fetch、用户 worktree 内容修改、repo/CI/board 接入        |
| 验证命令 | adapter spy、tracked-only read、临时真实 repo/worktree、CLI exit/no-write |
| 停止条件 | 只读命令白名单、错误关闭、text/JSON 与临时真实 Git 测试通过               |

### CWC3：真实现场验收与集成

| 项目     | 内容                                                                               |
| -------- | ---------------------------------------------------------------------------------- |
| 基线     | CWC2 验收后的当前 SHA                                                              |
| 执行角色 | 当前 Claude Code 主代理；完成后 fresh Claude 整体只读复审                          |
| 写入范围 | 本 brief 与现有 board ledger 证据                                                  |
| 禁止范围 | 清理/同步/删除 worktree、远端 evidence 投影、自动调度                              |
| 验证命令 | 当前 main primary dry-run、before/after no-change、相关完整门禁、PR required CI    |
| 停止条件 | 历史 clean worktree 不误阻塞；active/dirty/conflict fixture 能阻断；finding 已裁决 |

## 验收

- [ ] 不存在第二套 worktree registry、任务状态或长期运行目录
- [ ] 只观察 `git worktree list` 已注册 worktree
- [ ] tracked brief 经 `git ls-files` 确认后才读取；untracked poison 内容读取次数为 0
- [ ] primary / active / dormant-merged / dormant-ahead / unowned-dirty / unreadable 分类稳定
- [ ] dormant-merged 不告警，dormant-ahead warning-only，unowned tracked dirty blocking
- [ ] writer/scope/lock/dependency/WIP 冲突稳定阻断，review 不参与写冲突
- [ ] primary main catalog 是依赖状态权威，陈旧 worktree 副本不能覆盖
- [ ] Windows 路径、空格、中文、detached、locked、prunable 与 rename 路径测试通过
- [ ] CLI text/JSON、退出码 0/1/2、路径显示上限和 no-write 行为稳定
- [ ] 临时真实 Git/worktree 集成测试只清理自身系统临时目录
- [ ] 当前注册现场 dry-run 已记录 exact counts/finding/no-change evidence
- [ ] 相关 lint/format/test/repo/docs/board 和任务级最终门禁通过或如实记录已知外部阻塞
- [ ] fresh Claude 整体复审 finding 全部裁决
- [ ] 单一实现 PR required CI 通过并合入 main；closeout 证据可追溯

## 负责人决策记录

| 决策 ID | 已知事实与未知                                                               | 选项、成本/收益/风险/可逆性                                                                     | 推荐与理由                                          | 负责人结论 | 权威落点 / 状态          |
| ------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------- | ------------------------ |
| CWC-D01 | 8 个历史 worktree 均 tracked clean；5 个 ahead、3 个 merged；无 active brief | A 分级；B ahead 全阻断；C 新增生命周期 registry。A 保护现场且不永久红灯；B 过严；C 建第二套状态 | A：merged 信息、ahead warning、dirty/conflict block | 批准 A     | 本 brief/spec / approved |

## 进度 log

| 日期       | 阶段   | 负责        | commit   | 说明                                                                   |
| ---------- | ------ | ----------- | -------- | ---------------------------------------------------------------------- |
| 2026-10-01 | design | Codex       | —        | 历史 thin orchestrator 方向，现已 superseded                           |
| 2026-10-12 | design | Claude Code | 980495f1 | 建立跨 worktree 只读校准 spec                                          |
| 2026-10-12 | coding | Claude Code | b16527cb | 负责人选择 Native；在隔离 worktree 启动 CWC1，Dormant 采用分级校准策略 |
