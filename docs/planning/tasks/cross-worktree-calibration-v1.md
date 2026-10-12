---
status: review
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

- [x] 不存在第二套 worktree registry、任务状态或长期运行目录
- [x] 只观察 `git worktree list` 已注册 worktree
- [x] tracked brief 经 `git ls-files` 确认后才读取；untracked poison 内容读取次数为 0
- [x] primary / active / dormant-merged / dormant-ahead / unowned-dirty / unreadable 分类稳定
- [x] dormant-merged 不告警，dormant-ahead warning-only，unowned tracked dirty blocking
- [x] writer/scope/lock/dependency/WIP 冲突稳定阻断，review 不参与写冲突
- [x] primary main catalog 是依赖状态权威，陈旧 worktree 副本不能覆盖
- [x] Windows 路径、空格、中文、detached、locked、prunable 与 rename 路径测试通过
- [x] CLI text/JSON、退出码 0/1/2、路径显示上限和 no-write 行为稳定
- [x] 临时真实 Git/worktree 集成测试只清理自身系统临时目录
- [x] 当前注册现场 dry-run 已记录 exact counts/finding/no-change evidence
- [x] 相关 lint/format/test/repo/docs/board 和任务级最终门禁通过或如实记录已知外部阻塞
- [x] fresh Claude 整体复审 finding 全部裁决
- [ ] 单一实现 PR required CI 通过并合入 main；closeout 证据可追溯

## 负责人决策记录

| 决策 ID | 已知事实与未知                                                               | 选项、成本/收益/风险/可逆性                                                                     | 推荐与理由                                          | 负责人结论 | 权威落点 / 状态          |
| ------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------- | ------------------------ |
| CWC-D01 | 8 个历史 worktree 均 tracked clean；5 个 ahead、3 个 merged；无 active brief | A 分级；B ahead 全阻断；C 新增生命周期 registry。A 保护现场且不永久红灯；B 过严；C 建第二套状态 | A：merged 信息、ahead warning、dirty/conflict block | 批准 A     | 本 brief/spec / approved |

## CWC1–CWC3 本地证据（2026-10-12）

- 治理载体：旧 `thin-agent-orchestrator-v1` 已 Git rename 为本 brief；当前实现只保留 Claude-only 主代理 + fresh Claude 最终只读复审，Codex/Cursor 编排、运行态目录和外部 adapter 均未进入实现。
- 纯投影与 adapter：`worktree-calibration` + shared `task-brief-state` 合计 `40/40` tests 通过；覆盖 porcelain NUL、Windows/中文/空格、生命周期、writer/scope/lock/dependency/WIP、partial read failure、rename、detached、untracked poison、CLI 0/1/2 和 no-write。
- 真实临时仓库：系统临时目录内创建 primary + merged/ahead/dirty/active/detached worktrees，状态矩阵通过；测试只删除自身临时根目录。
- 初次现场探测正确阻断 primary：`D:/Logixs` 当时仍在设计分支，不满足 main/master primary。主代理确认 primary tracked clean、仅有既有 untracked 后切回同步 main，再执行正式 dry-run。
- 正式 dry-run：primary `D:/Logixs` / `main` / `fe37c100`；registered worktrees `10`（含 primary 与当前实现 worktree）；`active=1`、`dormant-ahead=5`、`dormant-merged=3`、`unowned-dirty=0`、`unreadable=0`，blocking `0`。
- Warning 汇总：`WORKTREE_BEHIND_MAIN=8`、`WORKTREE_DORMANT_AHEAD=5`、`WORKTREE_UNOWNED_UNTRACKED_PRESENT=3`。Untracked 只按路径/数量输出，文本每轨最多 50，内容读取次数为 0。
- 真实现场 finding：3 个 fully-merged 历史 worktree 的 local `review` brief 已在 primary catalog 标为 `done`，初版误判 active；新增 `primary catalog retires merged stale tasks but preserves new ahead tasks` 回归 RED→GREEN 后降为 `dormant-merged`。当前实现 task 在 primary 尚缺失且 branch ahead，保持唯一 active。
- No-write：以所有 registered worktree 当前 HEAD/status 为 before，执行真实 `worktrees:check`，再采 after，`NO_WRITE_CHANGED_COUNT=0`。更早的设计期 before 与实现期 after 唯一变化是当前实现 worktree 本身的开发 diff，不归因于校准命令。
- 当前未接入 `repo:check`、CI、progress board 跨-worktree区域或 hook；远端 PR/CI、自动调度与 worktree 清理仍未观察/未实现。

## 任务级门禁（2026-10-12）

- `pnpm validate` 已通过 repo、workbench purposes、contract schema/drift、data dictionary、Prisma generate、lint、format、typecheck；在 root `pnpm test` 阶段首次退出 `1`，完整日志未稳定复现。
- Fresh root test 重跑退出 `0`：full-chain `59/59`、root governance `214/214`、business-worker `5/5`、web `747/747`、api `1529/1529`。
- `test:integration`：`30 files / 204 tests` 通过；`build` 三个 workspace 通过。
- `test:e2e` 未执行测试：5173 已存在另一个会话的 non-matching development server，global setup 按契约以 `E2E_DEV_SERVER_CONFLICT` fail-closed。未停止他人服务，也未改写端口契约；远端 CI 是最终 clean-runner 权威。
- 隔离 worktree 的 `pnpm infra:up` 因主 `logixs-postgres-1` 已健康占用 5433 而失败，创建了未启动的 `cross-worktree-calibration-v1-*` Compose 资源。平台拒绝删除；它们保持 Created/空卷/独立网络，主 `logixs-*` 服务未改动并被 integration 复用。
- 任务 scoped Prettier、`git diff --check`、repo/docs/board、worktree CLI lint 与 focused tests 通过。
- 当前状态保持 `review`；fresh Claude 整体复审、finding disposition 和 required PR CI 尚未完成。

## Fresh 整体复审与 disposition（2026-10-12）

`logix-review/v1`：baseline `fe37c100`，reviewed `fb77c545`，verdict `findings`，writes `none`。复审确认 registry-only、tracked-only、read-only Git、dormant policy、冲突投影与 no-write 边界成立，返回 1 个 Important finding：

```text
logix-disposition/v1
slice: cross-worktree-calibration-v1
decisions:
  - finding: CWC-REV-001
    status: accepted
    reason: primary catalog 已判依赖 done 后，carry-through 又带回 stale local TASK_DEPENDENCY_MISSING/NOT_DONE，违反 primary-authoritative 规则。
    writeback: scripts/worktree-calibration.mjs + regression tests
next: fix
```

- `CWC-REV-001 fixed`：新增 `primary done suppresses stale local dependency blockers only`，RED 观察 local dependency finding 被重新引入，GREEN 后只过滤由 primary 重算的两类 dependency finding，其他 blocking `TASK_*` 仍保留。
- Reviewer verification gap `--primary D:\\Logixs` 也纳入当前 fix：新增 native Windows path 与 registry `/` spelling 匹配回归，RED 为 `WORKTREE_PRIMARY_READ_FAILED`，GREEN 后统一路径比较；live `D:\\Logixs` / `D:/Logixs` 两种写法均 exit `0`。
- Fix suite：worktree + shared task-state `42/42`；lint/format/repo/docs/board 通过；real temporary Git 集成继续通过。
- Unknown 保持：required PR CI 尚未观察；E2E 本地仍被外部 5173 server fail-closed；本复审未重复完整真实 before/after，但已审阅记录证据。
- Declined/deferred：board/hook/CI 集成、远端 evidence、RAID/checklist、自动调度、worktree 生命周期操作与 inert Compose 清理均不进入本片。

## 进度 log

| 日期       | 阶段   | 负责        | commit   | 说明                                                                                         |
| ---------- | ------ | ----------- | -------- | -------------------------------------------------------------------------------------------- |
| 2026-10-01 | design | Codex       | —        | 历史 thin orchestrator 方向，现已 superseded                                                 |
| 2026-10-12 | design | Claude Code | 980495f1 | 建立跨 worktree 只读校准 spec                                                                |
| 2026-10-12 | coding | Claude Code | b16527cb | 负责人选择 Native；在隔离 worktree 启动 CWC1，Dormant 采用分级校准策略                       |
| 2026-10-12 | review | Claude Code | d792f67c | CWC1–3 实现与真实 dry-run 完成；40/40、blocking 0、no-write 0，进入完整门禁与 fresh review   |
| 2026-10-12 | review | Claude Code | 4ce3d346 | root/integration/build 与治理门禁通过；E2E 被外部 5173 server fail-closed，等待 fresh review |
| 2026-10-12 | review | Claude Code | fb77c545 | fresh review 1 Important 已 accepted 并 RED→GREEN；Windows path gap 同片修复，进入 PR CI     |
