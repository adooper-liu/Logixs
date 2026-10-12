# Cross-Worktree Calibration V1 · Design

> 状态：**负责人已批准会话设计，待书面 spec 审核** · 2026-10-12
>
> 一句话：**从 Git 注册 worktree 与现有 task brief 重建一份只读跨 checkout 校准投影，区分 active/dormant 并阻断真实写冲突，同时不读取或处置用户未跟踪工作。**
>
> 治理权威：[AGENTS](../../../AGENTS.md)
>
> 工程规则：[ENGINEERING_RULES](../../../ENGINEERING_RULES.md)
>
> 前置能力：[透明开发校准 V1](../../planning/tasks/transparent-development-calibration-v1.md)

## 1. 目的与成功判据

当前 checkout 已能从唯一 task brief 与 Git 现场计算声明、实际差异、冲突和下一门禁，但仓库治理仍依赖主代理人工盘点其他注册 worktree。历史 worktree、未合入提交、活动任务、写域和锁冲突混在同一列表中，容易出现两类损失：

1. 把历史 clean worktree 误判为活动任务，让仓库长期阻塞；
2. 漏掉真实 active/dirty checkout 的 writer、scope、lock、dependency 或 WIP 冲突，让多个写现场静默碰撞。

本设计的成功问题是：

> 主代理能否只从 Git 注册表、各 checkout 的 tracked brief 与只读 Git 事实，稳定判断哪些 worktree 正在承担任务、哪些只是历史现场、哪些会与新写任务冲突，并在不读取未跟踪内容、不自动修改任何 checkout 的前提下给出统一 finding？

成功必须同时满足：

- 不建立第二套任务状态或 worktree registry；
- 不复活旧 Codex/Cursor/Claude 实现协作模型；
- 只观察 `git worktree list` 已注册 checkout；
- active/dormant/dirty/unreadable 分轨；
- 复用 current-checkout parser、scope 与 rename-aware Git 观察；
- active task 的 writer/scope/lock/dependency/WIP 冲突稳定阻断；
- dormant 历史现场按风险分级，不让 clean 历史 worktree 永久阻塞；
- untracked 只观察路径和数量，绝不读取内容；
- 命令只读，不创建、同步、清理、删除、提交或合并 worktree。

## 2. 已证实现场与治理迁移

### 2.1 当前注册现场

设计时 Git 注册表包含主 checkout 和 8 个非 primary worktree：

- 所有 worktree 的 tracked working tree 均为 clean；
- 没有 worktree 分支唯一匹配 `design/coding/fix/review` brief；
- 5 个非 primary 分支相对 `origin/main` 保留 1–3 个未合入提交；
- 3 个非 primary 分支已经完全合入 `origin/main`；
- 3 个 checkout 存在 untracked 路径，但本设计不读取其内容；
- main checkout 只存在 `.tmp/` 与 `apps/api/.tmp/` 等未归属路径现场。

这些数字是本次 dry-run 的预期，不是永久业务规则。实现必须从 Git 事实重建，不得硬编码。

### 2.2 旧 brief 处置

现有 `docs/planning/tasks/thin-agent-orchestrator-v1.md` 的历史方向包含：

- Codex 生成 run spec 与做主编排；
- Cursor 写实现；
- Claude 默认只读；
- 临时运行目录、PID、超时、取消与进程 adapter；
- 自动 TASK/HANDOFF 下发与外部代理入口探测。

该角色模型与当前 `AGENTS.md` 的 Claude-only 主代理直接实现、fresh Claude 最终只读复审冲突，不能直接复活。

实施时对旧 brief 执行 Git rename：

```text
docs/planning/tasks/thin-agent-orchestrator-v1.md
→ docs/planning/tasks/cross-worktree-calibration-v1.md
```

保留 `ORCH-D01` 和历史进度作为历史记录，并明确标记为被当前角色治理替代。新 brief 只承载已注册 worktree 的只读校准，不包含自动编排、进程控制或代理 adapter。

## 3. 设计边界

### 3.1 唯一事实链

```text
Git worktree 注册表
+ primary main checkout 的 tracked task catalog
+ 各 worktree 的 branch / HEAD / tracked diff / untracked path list
→ 跨 worktree 派生投影
→ 本地 CLI finding / exit code
```

投影和 CLI 输出都是派生事实，不可人工编辑后反向改变 brief 或 worktree 状态。

### 3.2 本片明确不做

- 不接入 `repo:check`；
- 不接入 GitHub CI；
- 不接入 progress board；
- 不修改 `AGENTS.md` 或 task template；
- 不扫描任意目录发现 worktree；
- 不调用 GitHub API；
- 不自动 fetch、pull、checkout、reset、clean、stash、rebase、merge、commit 或 push；
- 不创建、移动、锁定、解锁、repair、prune 或删除 worktree；
- 不读取 untracked 文件内容；
- 不建立 `.agent/signals`、`.agent/reviews`、run database 或长期运行态目录；
- 不派发代理，不生成 TASK/HANDOFF，不调用外部进程 adapter。

## 4. 架构与文件职责

### 4.1 新模块

新增 `scripts/worktree-calibration.mjs`，职责仅包括：

- 解析 `git worktree list --porcelain -z`；
- 观察已注册 worktree 的只读 Git 事实；
- 加载 primary 的 tracked task catalog；
- 解析每个 worktree 唯一分支匹配的 active task；
- 分类 worktree；
- 聚合跨 active task 冲突；
- 格式化文本/JSON 报告；
- 实现 `pnpm worktrees:check` CLI。

新增 `scripts/worktree-calibration.test.mjs`，覆盖纯投影、Git adapter、真实临时仓库和 CLI。

### 4.2 复用边界

继续复用 `scripts/task-brief-state.mjs`：

- `ACTIVE_TASK_STATUSES`
- `loadTrackedTaskRecords`
- `normalizeTaskRecords`
- `parseWriteScope`
- `scopeOwnsPath`
- `writeScopesOverlap`
- `resolveCurrentTask`
- `observeCheckout`
- `buildCalibrationProjection`

不得在新模块复制 frontmatter parser、scope matcher、rename parser 或单 checkout finding 逻辑。

### 4.3 导出接口

新模块导出：

```js
export function parseWorktreePorcelain(source) {}
export function classifyWorktree(input) {}
export function buildWorktreeCalibrationProjection(input) {}
export function worktreeCalibrationFindings(projection) {}
export function observeRegisteredWorktrees(options) {}
export function formatWorktreeCalibrationReport(projection) {}
export async function runWorktreeCalibrationCli(argv, dependencies) {}
```

核心投影结构：

```js
{
  primary: {
    path,
    branch,
    headSha,
    mainRef,
    trackedDirtyPaths,
    untrackedPaths
  },
  worktrees: [
    {
      path,
      branch,
      headSha,
      detached,
      locked,
      prunable,
      readable,
      state,
      ahead,
      behind,
      fullyMerged,
      trackedDirtyPaths,
      untrackedPaths,
      activeTask,
      checkoutProjection
    }
  ],
  activeTasks,
  conflicts: {
    writers,
    scopes,
    locks,
    dependencies,
    wip
  },
  findings,
  nextGate
}
```

所有数组标准化、去重并稳定排序。输出路径保持 Git 报告的 spelling，比较大小写不敏感。

## 5. Worktree 生命周期分类

固定状态：

```text
primary
active
dormant-merged
dormant-ahead
unowned-dirty
unreadable
```

### 5.1 `primary`

命令运行所在的本地 `main` / `master` checkout。它提供 canonical tracked task catalog 和 main reference。

### 5.2 `active`

worktree 分支唯一匹配一个状态为 `design/coding/fix/review` 的 tracked brief。

active task 记录来自该 worktree 自身 HEAD/checkout 可见的 tracked brief，但依赖状态与跨任务索引以 primary main checkout 的 tracked task catalog 为权威。陈旧 worktree 不得覆盖 main 上的 task 状态。

### 5.3 `dormant-merged`

无 active brief、tracked clean、分支 HEAD 已是 main ref 的 ancestor。只作为信息展示，不产生 warning。

### 5.4 `dormant-ahead`

无 active brief、tracked clean、分支存在 main 未包含的提交。产生 warning，但不阻断其他任务。

### 5.5 `unowned-dirty`

无 active brief且存在 tracked working-tree 改动。产生 blocking finding。校准不得自动归责、恢复或删除这些改动。

### 5.6 `unreadable`

Git 注册路径、branch/HEAD、tracked task catalog 或必要 Git diff 无法可靠读取。产生 blocking finding，不伪装为 clean/dormant。

### 5.7 Detached / locked / prunable

- detached 是单独 Git 事实和 warning，不替代上述状态；
- locked/prunable 只展示注册事实；
- 不自动 unlock、repair 或 prune；
- detached + tracked dirty + 无 active task 仍按 `unowned-dirty` 阻断。

## 6. Dormant 风险政策

负责人选择分级校准：

- clean + fully merged：informational；
- clean + ahead：warning；
- tracked dirty 且无 active brief：blocking；
- untracked：warning，只报告路径/数量；
- active task 集合冲突：blocking。

该政策避免历史 worktree 永久阻断，同时保护仍有未合入提交或未归属 tracked 工作的现场。Warning 永远不构成自动清理授权。

## 7. 跨 active task 冲突

只对有写入能力的 `design/coding/fix` task 计算 writer/scope/lock/WIP 冲突。`review` 可观察，但不作为写入者进入这四类冲突。

### 7.1 Writer

两个 active write task 声明相同非空 writer，产生 blocking。当前 Claude-only 默认 writer 为 `main`，因此正常情况下写任务必须串行。

### 7.2 Scope

使用共享 `parseWriteScope` / `writeScopesOverlap`。精确路径、父子目录和大小写漂移按现有规则判冲突；非法 scope 由已有 task parser/policy finding 处理。

### 7.3 Lock

两个 active write task 的 `exclusiveLocks` 有交集，产生 blocking。锁字符串按模板现行规则比较，不新增通配符。

### 7.4 Dependency

active task 的 `dependsOn`：

- primary task catalog 找不到：blocking；
- primary 中依赖状态非 `done`：blocking；
- worktree 中陈旧副本显示 `done` 但 primary 非 `done`：仍 blocking；
- 不建立新依赖图状态文件。

### 7.5 WIP

active `coding/fix` write task 超过 2 个，产生 blocking。`design` 和 `review` 不计入该数量，但 design 仍参与 writer/scope/lock 冲突。

## 8. Finding 契约

沿用 calibration finding 结构：

```js
{
  code,
  severity: "blocking" | "warning",
  subject,
  evidence,
  remedy,
  worktreePath?,
  taskPath?
}
```

### 8.1 Blocking

| Code                                 | 条件                                          |
| ------------------------------------ | --------------------------------------------- |
| `WORKTREE_PRIMARY_INVALID`           | 当前 checkout 非 main/master 或 primary dirty |
| `WORKTREE_READ_FAILED`               | 注册 worktree 或必要 Git 事实不可读           |
| `WORKTREE_ACTIVE_TASK_AMBIGUOUS`     | 分支匹配多个 active brief                     |
| `WORKTREE_TRACKED_DIRTY_UNOWNED`     | 无 active brief 但存在 tracked 改动           |
| `WORKTREE_ACTIVE_WRITER_CONFLICT`    | active write task writer 相同                 |
| `WORKTREE_ACTIVE_SCOPE_CONFLICT`     | active write task writeScopes 重叠            |
| `WORKTREE_ACTIVE_LOCK_CONFLICT`      | active write task exclusiveLocks 重叠         |
| `WORKTREE_ACTIVE_DEPENDENCY_BLOCKED` | 依赖缺失或 primary 中非 done                  |
| `WORKTREE_WRITE_WIP_EXCEEDED`        | active coding/fix write task 超过 2           |

active worktree 的单 checkout blocking `TASK_*` finding 保留原 code，并附 worktree/task 定位。

### 8.2 Warning

| Code                                 | 条件                              |
| ------------------------------------ | --------------------------------- |
| `WORKTREE_DORMANT_AHEAD`             | dormant clean branch 有未合入提交 |
| `WORKTREE_BEHIND_MAIN`               | branch 落后 main ref              |
| `WORKTREE_DETACHED_HEAD`             | detached checkout                 |
| `WORKTREE_UNOWNED_UNTRACKED_PRESENT` | worktree 存在 untracked 路径      |

`dormant-merged` 不产生 warning。

### 8.3 退出码

- `0`：无 blocking；warning/informational 可存在；
- `1`：至少一个 blocking；
- `2`：CLI 参数错误，或 primary Git worktree 注册表无法读取。

Finding 按 code、subject、worktree path、evidence 稳定排序。

## 9. Primary 约束

第一片命令必须从本地 main/master checkout 运行：

- 当前分支非 main/master：`WORKTREE_PRIMARY_INVALID` blocking；
- primary 有 tracked 改动：`WORKTREE_PRIMARY_INVALID` blocking；
- primary 只有 untracked：warning，不读取内容；
- primary 相对 main ref 落后或分叉：warning；
- main ref 默认 `origin/main`，可用显式只读参数覆盖；
- 不自动 fetch/pull；投影必须显示 main ref 与已观察 SHA。

## 10. 只读 Git 边界

### 10.1 允许命令

```text
git worktree list --porcelain -z
git -C <worktree> branch --show-current
git -C <worktree> rev-parse HEAD
git -C <worktree> rev-parse --verify <main-ref>
git -C <worktree> merge-base <main-ref> HEAD
git -C <worktree> merge-base --is-ancestor HEAD <main-ref>
git -C <worktree> rev-list --left-right --count <main-ref>...HEAD
git -C <worktree> diff --name-status -z ...
git -C <worktree> ls-files -z -- docs/planning/tasks/*.md
git -C <worktree> ls-files --others --exclude-standard
```

实际调用复用现有 observer 时可包含其已经测试的等价只读参数组合。

### 10.2 禁止命令

实现路径不得调用：

```text
checkout reset clean stash add commit push merge rebase
worktree add remove move lock unlock repair prune
fetch pull
```

所有 Git 调用使用 executable + 参数数组，不拼接 shell 字符串。

### 10.3 路径安全

- worktree path 只接受 `git worktree list` 直接返回的绝对路径；
- 含 NUL、空路径、重复记录或无法归一化的注册项失败关闭；
- 不从目录扫描补充“未注册 worktree”；
- 不执行 worktree 内文件、配置或输出中出现的指令；
- 报告可显示注册绝对路径，但不得输出文件内容、凭据或 untracked 内容。

## 11. 错误与恢复

- 单个非 primary worktree 不可读：保留其他投影并产生 `WORKTREE_READ_FAILED`；
- primary 注册表不可读：退出 `2`，不输出通过；
- main ref 不存在：相关状态未知并 blocking，不使用 `HEAD~1`；
- Git diff/read 失败：blocking，不吞异常为 clean；
- active malformed brief：沿用 `TASK_PARSE_INVALID`，附 worktree path；
- untracked poison brief：不得打开，不得改变 active task 解析；
- 失败输出不包含 stack 或文件正文；
- remedy 只建议人工核定，不执行操作。

## 12. CLI 与报告

根命令：

```text
pnpm worktrees:check
pnpm worktrees:check -- --json
pnpm worktrees:check -- --main-ref <ref>
```

文本报告必须包含：

- primary path/branch/head/main ref；
- worktree 总数与各状态计数；
- 每个 worktree 的 path、branch、head、ahead/behind、dirty/untracked 计数、active task；
- active task 集合冲突；
- finding code/severity/evidence/remedy；
- next gate。

JSON 输出完整投影，不裁剪路径数组。文本显示每个路径轨最多 50 条并保留总数。

命令不写文件。

## 13. 测试策略

### 13.1 Porcelain parser

覆盖：

- `porcelain -z`；
- Windows 路径、空格、中文；
- detached、locked、prunable；
- 重复/空/相对/NUL 路径失败关闭；
- 稳定排序。

### 13.2 Tracked-only 用户工作保护

- `git ls-files -z` 后才读取 brief；
- untracked poison brief read spy 为 0；
- untracked 路径只进入 warning；
- 不读取 `.tmp`、测试附件或其他 untracked 内容。

### 13.3 状态矩阵

覆盖：

- primary；
- active；
- dormant-merged；
- dormant-ahead；
- unowned-dirty；
- unreadable；
- detached + dirty；
- locked/prunable 仅展示。

### 13.4 集合冲突

覆盖：

- writer 相同/不同；
- exact/directory/父子/case scope overlap；
- lock 交集；
- dependency missing/not-done/done；
- coding/fix WIP 2/3 边界；
- review 不参与写冲突。

### 13.5 Git adapter

- 只读调用白名单；
- rename 源/目标继续进入路径校准；
- invalid main ref、HEAD、diff 失败关闭；
- 任一失败不触发 Git 写命令；
- 不自动 fetch。

### 13.6 临时真实仓库

创建临时 Git repository 和多个真实 worktree，覆盖：

- clean fully merged；
- clean ahead；
- tracked dirty unowned；
- unique active brief；
- untracked poison brief；
- detached/locked；
- 路径含空格和中文。

测试清理只删除测试自己创建的临时目录，绝不操作用户注册 worktree。

### 13.7 CLI

- text / JSON；
- warning-only exit `0`；
- blocking exit `1`；
- 参数/primary registry failure exit `2`；
- no-write spy；
- output 不泄露 untracked 内容。

## 14. 当前仓库 Dry-Run 预期

基于设计时现场，排除 primary 后预期：

```text
active: 0
dormant-ahead: 5
dormant-merged: 3
unowned-dirty: 0
unreadable: 0
```

部分 checkout 有 untracked warning。真实实现若得到不同结果，应先核对现场是否变化，不修改测试去追逐旧数字。Dry-run 只记录事实，不清理 worktree。

## 15. 实施切片

### CWC1：治理载体与纯投影

- Git rename 旧 orchestrator brief；
- 按当前 Claude-only 角色模型重写 brief 与 `docs/INDEX.md`；
- 新增 porcelain parser、分类器、集合投影和 finding 纯函数；
- fixture 固定状态矩阵与冲突分级。

停止条件：纯数据测试稳定定义 active/dormant 与全部 blocking/warning finding。

### CWC2：只读 Git adapter 与 CLI

- 新增注册 worktree 观察器；
- tracked-only brief 读取；
- 复用 rename-aware checkout observer；
- 新增 text/JSON CLI 与 `pnpm worktrees:check`；
- 临时真实 Git 仓库集成测试。

停止条件：Git 写命令无法从实现路径触发；错误关闭、路径安全和 no-write 测试通过。

### CWC3：真实现场验收与证据

- 当前 main checkout dry-run；
- 核对 8 个非 primary worktree 分类与 warning/blocker；
- 记录 untracked 路径数量，不读内容；
- fresh Claude 整体只读复审；
- finding 裁决、相关完整门禁、单一 PR、required CI、合并与 brief closeout。

停止条件：历史 clean worktree 不被误归 active 或永久阻断；任一 fixture active/dirty/conflict 能稳定阻断。

## 16. 集成位置与后续

本任务只新增本地显式 `worktrees:check`。验真后再独立设计：

1. progress board 跨 worktree 区域；
2. 主代理开工/复审/集成 hook；
3. 远端 GitHub PR/CI evidence；
4. RAID/checklist 链接门禁；
5. 任何自动调度或 worktree 生命周期操作。

CI clean runner 不可观察本机其他 worktree，因此本命令不进入现有 CI static job。

## 17. 完成声明边界

本任务完成只表示：

- Git 注册 worktree 现场可重建；
- active/dormant、writer/scope/lock/dependency/WIP 风险可稳定判定；
- 未跟踪内容不被读取；
- blocker 与 warning 可通过只读 CLI 报告。

它不表示：

- dormant worktree 可删除；
- 未合入提交可丢弃；
- worktree 已同步、变基或合并；
- 自动调度已上线；
- 远端 PR/CI 已被观察；
- 其他工作台或业务流程完成。
