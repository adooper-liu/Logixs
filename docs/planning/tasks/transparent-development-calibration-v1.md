---
status: done
branch: docs/transparent-development-calibration-v1
owner: main
writer: main
risk: high
verification: >
  PR #168; CI run 38145897529 quality success;
  merge commit 7fdeb1f4e59306074143aa5fe2efc840bd21926d
dependsOn:
  - universal-workbench-layout-standard-v1
writeScopes:
  - docs/planning/tasks/transparent-development-calibration-v1.md
  - docs/planning/tasks/universal-workbench-layout-standard-v1.md
  - docs/superpowers/specs/2026-10-11-transparent-development-calibration-design.md
  - docs/superpowers/plans/2026-10-11-transparent-development-calibration.md
  - docs/superpowers/plans/2026-10-11-transparent-progress-board-slice.md
  - docs/superpowers/plans/2026-10-11-transparent-static-ci-gate.md
  - scripts/task-brief-state.mjs
  - scripts/task-brief-state.test.mjs
  - scripts/check-repository.mjs
  - scripts/check-repository.test.mjs
  - scripts/check-ui-structure-gate.mjs
  - scripts/check-ui-structure-gate.test.mjs
  - scripts/build-progress-board.mjs
  - scripts/build-progress-board.test.mjs
  - scripts/check-ci-workflow.test.mjs
  - scripts/progress-board.template.html
  - docs/planning/progress-board.html
  - package.json
  - .github/workflows/ci.yml
exclusiveLocks:
  - repository-governance
  - root-tooling
  - task-brief-contract
  - progress-board
sharedIntegrationScopes: []
authorityRefs:
  - AGENTS.md
  - ENGINEERING_RULES.md
  - docs/planning/tasks/_template.md
  - docs/planning/RAID.md
  - docs/planning/PROJECT_BOOTSTRAP_CHECKLIST.md
  - docs/planning/DOMAIN_VERTICAL_DELIVERY_PLAN.md
---

# 任务：透明开发校准 V1

> 本 brief 是当前单元唯一的实施载体。设计权威为
> `docs/superpowers/specs/2026-10-11-transparent-development-calibration-design.md`。
> progress board、校准投影和 CI 输出均为派生事实，不建立第二套需求、状态或任务数据库。

## 路线图位置与目标结果

- **位置**：仓库治理基础设施；承接 UI 单元合并后的“透明校准 → 可视化纵向薄片 → brief 全链对账 → 自动门禁”主线。
- **目标用户**：维护唯一 task brief、控制范围、组织复审和完成 Git/CI/PR 集成的主代理，以及核对当前交付现场的评审者。
- **核心结果**：同一个只读投影同时回答“brief 声明了什么、当前 checkout 实际发生了什么、两者哪里冲突、下一道门禁是什么”，并驱动 progress board 与 CI static gate。
- **优先减少的损失**：减少错误分支写入、diff 越过 `writeScopes`、缺失权威引用、未完成依赖、重复 parser 漂移、看板与门禁口径不一致，以及视觉完成感掩盖真实缺口。
- **主线关系**：本片只校准当前 checkout；跨 worktree、远端 PR/CI 对账和自动调度留待后续独立切片。

## 已证实事实

1. `AGENTS.md` 已定义唯一需求事实链、task brief 调度字段、WIP/锁/依赖规则、UI 强制结构和交付集成顺序。
2. `scripts/check-repository.mjs` 能校验当前 checkout 可见 brief 的状态、写域、锁、依赖与 UI 元数据，但不对账实际 Git diff 或其他 worktree。
3. `scripts/check-ui-structure-gate.mjs` 与 `scripts/build-progress-board.mjs` 各自维护能力不同的 frontmatter parser，已经形成同一 brief 的三种解释。
4. `scripts/build-progress-board.mjs` 生成并提交 `docs/planning/progress-board.html`，但没有稳定 `--check`，只读取 `status / branch / verification`，且混有手工维护判断。
5. 当前无 task brief JSON Schema、无归一化 task-state 模型、无当前分支/merge-base/changed-path 对账、无 progress board 校准投影。
6. 仓库已有成熟的 deterministic manifest/check/receipt 先例，但它们服务业务样本与 Demo 数据，不是开发任务状态权威。
7. 本分支在建立本 brief 前已完成 UI brief 合并事实收口；`docs/planning/tasks/universal-workbench-layout-standard-v1.md` 因而显式列入本任务写域和 branch diff 解释范围。

## 已批准设计

负责人于 2026-10-11 选择方案 A：

- 建立一个共享、只读、确定性的 task brief parser 与 calibration projection；
- task brief 继续是唯一实施载体，不新增可编辑 JSON/YAML、数据库或运行状态目录；
- 当前 checkout 的分支、base、committed/staged/unstaged/untracked 路径与 brief 声明分轨对账；
- progress board 新增“当前交付薄片”派生视图，并与自动门禁消费同一投影；
- CI static job 运行非写入校准检查；
- 第一片明确延期跨 worktree、GitHub PR/CI API、RAID 迁移、自动代理调度和生产 Web dashboard。

## 本片不做

- 不扫描或修改其他注册 worktree；
- 不调用 GitHub API 证明 PR/CI/merge 状态；
- 不把 RAID 或 bootstrap checklist 迁移成新 schema；
- 不新增每个 slice 的可写状态文件；
- 不自动创建分支/worktree、派发代理、提交、推送或合并；
- 不追溯修复所有历史 brief 的 checkbox、旧模型名或旧字段；
- 不建立 `apps/web` 生产页面；
- 不把绿色看板解释为业务闭环、部署完成或负责人验收。

## 直接消费者与使用场景

本任务不是业务/UI 功能，不适用工作台五面和 WB-B01～WB-B10。直接消费者如下：

| 消费者                             | 使用场景                           | 本片结果                                            |
| ---------------------------------- | ---------------------------------- | --------------------------------------------------- |
| 主代理                             | 开始、复审、集成前核对当前任务现场 | 一份声明/观察/冲突/下一门禁投影                     |
| `repo:check` / `calibration:check` | 本地和 CI fail-closed 门禁         | 稳定 finding ID、退出码和证据路径                   |
| UI 写入 hook                       | Vue 写入前识别唯一活动 owner       | 与 repository gate 共用同一 parser                  |
| progress board                     | 人工查看当前纵向薄片               | 明确标记为派生视图，不可编辑                        |
| 独立复审者                         | 核对范围、证据与未知项             | 可追溯 base/head、scope、authority、dependency 事实 |

## 执行切片

### 切片 `TDC1-shared-parser-and-projection`

| 项目     | 内容                                                                        |
| -------- | --------------------------------------------------------------------------- |
| 基线     | `9811780c`                                                                  |
| 执行角色 | 当前 Claude Code 主代理直接实现；实际模型按 `AGENTS.md` §1.2 第 4 条登记    |
| 复审     | 共享解析契约、Git 差异归属和 fail-closed 行为进入最终 fresh Claude 整体复审 |
| 写入范围 | 本 brief/spec；`task-brief-state`；repository/UI gate parser 迁移；对应测试 |
| 禁止范围 | progress board 视觉实现、CI、跨 worktree、远端 API、历史 brief 批改         |
| 验证命令 | parser/reconciler RED→GREEN；repository/UI gate 回归；lint/format           |
| 停止条件 | 三个消费者共用一个 parser；现有校验语义不回退；投影可注入 Git 观察 fixture  |

### 切片 `TDC2-current-checkout-gate`

| 项目     | 内容                                                                                                        |
| -------- | ----------------------------------------------------------------------------------------------------------- |
| 基线     | `TDC1` 验收后的当前 SHA                                                                                     |
| 执行角色 | 当前 Claude Code 主代理直接实现                                                                             |
| 复审     | 主代理验收；最终整体复审覆盖 fail-closed 和用户工作保护                                                     |
| 写入范围 | `task-brief-state`、CLI/tests、`check-repository`、`package.json`                                           |
| 禁止范围 | board、CI workflow、其他 worktree、GitHub API                                                               |
| 验证命令 | branch/base/diff/scope/authority/dependency/unknown-path fixtures；真实本分支 dry-run                       |
| 停止条件 | `calibration:check` 不写文件；稳定区分 task-owned、blocking foreign tracked、non-blocking unowned untracked |

### 切片 `TDC3-visual-vertical-slice`

| 项目     | 内容                                                                                |
| -------- | ----------------------------------------------------------------------------------- |
| 基线     | `TDC2` 验收后的当前 SHA                                                             |
| 执行角色 | 当前 Claude Code 主代理直接实现                                                     |
| 复审     | 主代理检查桌面/手机、亮/暗主题和信息真实性；最终整体复审核对派生边界                |
| 写入范围 | progress board builder/template/test/generated HTML                                 |
| 禁止范围 | `apps/web`、第二套状态、手工复制 finding、修改业务工作台                            |
| 验证命令 | deterministic projection/render tests；`board:build`；`board:check`；浏览器人工核对 |
| 停止条件 | 看板显示声明→现场→门禁链；computed/editorial/unknown 三类信息分轨；无横向溢出       |

### 切片 `TDC4-static-ci-gate`

| 项目     | 内容                                                                                |
| -------- | ----------------------------------------------------------------------------------- |
| 基线     | `TDC3` 验收后的当前 SHA                                                             |
| 执行角色 | 当前 Claude Code 主代理直接实现                                                     |
| 复审     | 高风险任务完成后由 fresh Claude Code 只读会话做一次整体复审                         |
| 写入范围 | `package.json`、`.github/workflows/ci.yml`、brief 验证证据                          |
| 禁止范围 | 新 CI service、integration/security job 扩建、部署或 GitHub 设置                    |
| 验证命令 | YAML/脚本测试；本地 static 等价命令；最终 PR CI                                     |
| 停止条件 | CI static 始终执行 read-only calibration/board checks；finding 已裁决；完整门禁通过 |

## 负责人决策记录

| 决策 ID | 已知事实与未知                                                                   | 选项、成本/收益/风险/可逆性                                                                                              | 推荐与理由                                      | 负责人结论 | 权威落点 / 状态                    |
| ------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | ---------- | ---------------------------------- |
| TDC-D01 | 现有治理完整但 parser、diff 对账、board 与 gate 分裂；跨 worktree/远端状态未接通 | A 共享只读投影；B 只做 board；C 直接跨 worktree 编排。A 中等改动、立即贯通四项能力；B 无阻断；C 范围过厚且旧角色模型冲突 | A：保留唯一 brief，同时形成第一条可回滚纵向薄片 | 批准方案 A | 本 brief 与 design spec / approved |

## 验收

- [x] `task-brief-state` 是 repository gate、UI hook、progress board 唯一 parser/normalizer
- [x] parser 对当前受支持 frontmatter 子集给出稳定值和带路径/行号的错误，不静默吞掉畸形字段
- [x] 显式 `--brief` 可校准指定任务；无显式参数时按实际 branch 唯一匹配活动 brief
- [x] 本地使用 merge-base，CI 使用传入 base SHA；投影显示 base 来源且不静默猜 stacked branch
- [x] committed/staged/unstaged tracked 越出 `writeScopes` 会阻断
- [x] `writeScopes` 内 untracked 计入 task-owned；范围外 untracked 只列为 unowned，不归责、不删除
- [x] `authorityRefs` 缺失、未完成依赖、branch mismatch、done 无 verification 保持 fail-closed
- [x] 修改的 authority ref 若不在 `writeScopes`，形成稳定阻断 finding
- [x] 历史 `done/blocked` brief 不因新 parser 被无差别追溯失败
- [x] progress board 以同一投影显示当前 task、authority、diff、dependency、checks、review/integration unknown 和下一 gate
- [x] board 明确区分 computed fact、editorial judgment、unknown/not-observed
- [x] `calibration:check` / `board:check` 都是只读命令，生成命令才允许写 HTML
- [x] CI static job 运行只读 checks，失败输出稳定 finding 与修复入口
- [x] 当前分支的既有 `.claude/worktrees/`、`.tmp/`、`apps/api/.tmp/` 只作为 unowned/untracked 现场报告，不进入当前任务提交
- [x] 定向测试、repository tests、格式、lint、typecheck、board 视觉核对和最终 CI 通过
- [x] fresh Claude 整体复审 finding 全部裁决

## 第一薄片验证（2026-10-11）

- 共享 parser/scope authority：`scripts/task-brief-state.mjs`；repository gate 与 UI hook 已删除私有 parser/scope matcher，progress board 迁移明确留给 `TDC3`。
- 自动化：`task-brief-state` + repository + UI gate 合计 `99/99` tests 通过；根 `lint`、`typecheck`、`repo:check`、`docs:check` 通过。
- 格式：本片全部 tracked 路径 scoped Prettier 通过；根 `format:check` 仅因非本任务 `apps/ai-service/.pytest_cache` 的 `EPERM scandir` 退出 `2`，未修改该目录。
- 真实校准：显式 base `5deb703b`，观察 head `dcc105c6`；task-owned tracked `8`、tracked 越界 `0`、task-owned untracked `0`、unowned untracked `143`。
- 未归属现场：`.claude/worktrees/`、`.tmp/`、`apps/api/.tmp/` 仅产生 `TASK_UNOWNED_UNTRACKED_PRESENT` warning；报告最多显示 50 条并保留总数，不读取内容，不影响退出码。
- fail-closed：active malformed frontmatter、branch/base、四轨路径、authority 缺失/越界写、dependency、done verification、仓库外 authority、Git observation failure 均有稳定测试；历史 `done/blocked` 不追溯失败。
- 本片不创建 PR、不执行最终 fresh 整体复审、不标记本 brief `done`。下一步单独规划 `TDC3` progress-board 可视化纵向薄片与 `board:check`。

## TDC3 可视化薄片验证（2026-10-11）

- 生成/检查边界：`build-progress-board.mjs` 已改为 import-safe 的 load/render/check 函数；`pnpm board:build` 是唯一写入口，`pnpm board:check` 只在内存重渲染并对比已提交 HTML，提交后 `293cde92` 再次执行仍为 `current`。
- 自动化：board + task-state + repository + UI gate 合计 `111/111` tests 通过；覆盖 deterministic render、零写 check、稳定 drift、严格 volatile marker、HTML escaping、55 路径截断、not-observed fallback、事实类型和响应式结构。
- 真实校准：显式 base `7c7f084b`，观察 head `c844f6de`；task-owned tracked `7`、tracked 越界 `0`、task-owned untracked `0`、unowned untracked `143`，唯一 finding 为非阻断 `TASK_UNOWNED_UNTRACKED_PRESENT`。
- 视觉证据：Playwright 内存渲染 `1440×900` / `390×844` 的 light/dark 四视口；桌面三列、手机单列，body scroll width 分别等于 viewport `1440` / `390`，路径在自身容器内换行/滚动，`declared/computed/unknown/editorial` 与 `blocking/warning` 均有独立文本/边框语义。
- 静态门禁：`board:check`、`repo:check`、`docs:check`、根 `lint`、根 `typecheck`、任务 scoped Prettier 和 `git diff --check` 通过。根 `format:check` 仍仅因非本任务 `apps/ai-service/.pytest_cache` 的 `EPERM scandir` 退出 `2`，未读取或修改该目录。
- 复核：四路 cleanup 复核未发现可复用 helper；已合并重复 fact 状态、未知集成渲染和状态计数。结构化稳定投影替代 HTML marker 属于后续演进，本片按批准 plan 保留精确 `META/CALIBRATION/COMMIT` marker，并用测试证明 task title、finding code、module/gap 等稳定语义漂移仍会阻断。
- 本 brief 保持 `coding`；下一步为 `TDC4` CI static read-only wiring、完整门禁、fresh Claude 整体复审和最终集成。

## TDC4 本地集成验证（2026-10-11）

- CI static：`3c9c0307` 已按 `repo:check → calibration:check → board:check → format:check` 接线；PR 显式传 base/head/head branch，manual dispatch 使用全历史 checkout + merge-base，schedule 继续跳过 static；源码契约测试 `2/2` 通过。
- Synthetic checkout：board loader 接受与 calibration CLI 相同的 `BASE_SHA/HEAD_SHA/HEAD_BRANCH`；本地 dirty checkout 与显式 PR identity 的 `board:check` 均为 `current`。只有 `TASK_UNOWNED_UNTRACKED_PRESENT` 进入 checkout volatile 区，blocking finding、task title、module/gap 仍参与 drift check。
- 全量自动化：`pnpm test` 重跑通过（full-chain `59/59`、root governance `188/188`、business-worker `5/5`、web `747/747`、api `1529/1529`）；`test:integration` `30 files / 204 tests` 通过；`build` 三个 workspace 通过。
- E2E：首次整套在 `mobile drawer preserves entry order and closes after navigation` 出现一次 locator 在视口外的 `30s` 超时；该用例单独重跑 `1/1` 通过，随后整套重跑 `234 passed / 26 skipped`，未改 UI 或 E2E 测试。
- 完整门禁事实：`pnpm validate` 运行至 `format:check` 前的 repo、workbench purpose、contract schema/drift、data dictionary、Prisma generate、lint 均通过；根格式仍因非本任务 `apps/ai-service/.pytest_cache` 的 `EPERM scandir` 退出 `2`，因此不声明 `validate` 整体通过。任务从 `5deb703b` 起的全部 tracked 路径 scoped Prettier 通过，后续 typecheck/test/integration/E2E/build 已逐项通过。
- 最终校准：显式 base `5deb703b`、head `3c9c0307`；local/CI 两种模式均 pass，task-owned tracked `16`、tracked 越界 `0`、task-owned untracked `0`、unowned untracked `143`；`board:check`、`repo:check`、`docs:check` 与 branch `git diff --check` 通过。
- 当前状态移到 `review`。remote PR/CI 与 fresh Claude 整体复审仍为 `not-observed`，不得据本地门禁标记 task `done`。

## Fresh 整体复审与 disposition（2026-10-11）

`logix-review/v1`：baseline `e158290a`，reviewed `04e3fb82`，verdict `findings`，writes `none`。复审确认架构与主要门禁成立，但返回 4 个当前范围 Important finding；主代理逐项复现后全部接受：

```text
logix-disposition/v1
slice: transparent-development-calibration-v1
items:
  - id: TDC-REV-001
    disposition: accepted
    reason: loader 先 readdir/read task markdown，未跟踪 brief 内容可改变 current-task resolution，违反 unowned-untracked 只按路径 warning 且不读内容。
    authority: design §3.2 / §11；修复落点 task-brief-state + board loader/tests。
  - id: TDC-REV-002
    disposition: accepted
    reason: --name-only 对 R100 仅返回目标路径，out-of-scope 源路径可借 rename 绕过 writeScopes。
    authority: design §3.2 / §5；修复落点 checkout observer + committed/staged rename regressions。
  - id: TDC-REV-003
    disposition: accepted
    reason: board git fallback 吞掉 explicit head/base/diff 失败，可返回 observed 空 head 并被 volatile normalization 掩盖。
    authority: TDC4 Review Focus / shared projection contract；修复落点 strict calibration Git adapter + negative board tests。
  - id: TDC-REV-004
    disposition: accepted
    reason: quoted scalar/list 与尾注释组合被误解析，违反共享 parser 已声明的 quoted/comment 子集。
    authority: design §4.2 / §12.1；修复落点 comment tokenizer + parser regressions。
next: one TDD fix pass, affected/full governance suites, then PR/CI integration.
```

- 复审 unknown 保持：其他 worktree 与 remote PR/CI 未观察；不读其内容。
- 复审 verification gap 保持：根 `validate` 仍受 `.pytest_cache` EPERM 阻断；任务 scoped format 与其余分轨门禁为当前证据。
- 一次 fix pass 已提交为 `0a92ddea`：
  - `TDC-REV-001 fixed`：三消费者改用 `git ls-files -z -- docs/planning/tasks/*.md` 后再读内容；`loads only tracked task briefs and never reads untracked task contents` RED→GREEN。
  - `TDC-REV-002 fixed`：tracked diff 改为 `--name-status -z`，R/C 同时展开源/目标；`expands committed and staged rename sources for scope enforcement` RED→GREEN。
  - `TDC-REV-003 fixed`：board 装饰 Git 与 calibration strict Git 分层；invalid base/head/diff 分别变为稳定 not-observed，negative identity tests RED→GREEN。
  - `TDC-REV-004 fixed`：quote-aware comment/list tokenizer；`combines quoted values and trailing comments without losing internal hashes` RED→GREEN。
- fix 验证：affected governance suites `119/119`，root test fresh `59 + 192 + 5 + 747 + 1529` 全绿；lint/typecheck、repo/docs/board、task scoped Prettier、`git diff --check` 和提交后 CI calibration 通过。
- 当前状态恢复 `review`。按一次 fix pass 的执行约束不重复派发整分支复审；下一门禁是远端 PR required `quality` 与合并证据。

## PR / CI / merge 收口（2026-10-11）

- PR：[**#168 · feat(governance): add transparent delivery calibration**](https://github.com/adooper-liu/Logixs/pull/168)，base `e158290a`，最终 head `09c88a99`。
- 首轮 CI run `38145476972` 在 static calibration step 失败：Windows runner 将 package-runner separator `--` 原样传给 Node，CLI 返回 `unknown or incomplete argument '--'`。新增 `CLI accepts a standalone package-runner argument separator` 回归先 RED 后 GREEN，仅忽略独立 `--`，其他未知参数仍 fail-closed；提交 `09c88a99`。
- 最终 CI run [`38145897529`](https://github.com/adooper-liu/Logixs/actions/runs/38145897529)：`changes/static/unit/build/security/quality` 全部 success；`e2e/dictionary` 按变更分类规则 skipped。static 中 `repo:check → calibration:check → board:check → format:check` 在线逐步通过。
- Repository ruleset `protect-main` 的 required check `quality` 通过，PR merge state `CLEAN`；负责人明确授权本次合并。
- PR 于 `2026-10-11T14:12:01Z` 以 merge commit `7fdeb1f4e59306074143aa5fe2efc840bd21926d` 合入 `main`；本地 `main` 已 fast-forward 同步该提交。
- 完成边界：本任务只证明当前 checkout 透明校准、board 派生视图和 CI static gate 闭环；跨 worktree 校准、GitHub API 远端 evidence 投影、RAID/checklist 结构校验和自动调度仍是后续独立任务，不由本 brief 冒充完成。
- 根 `pnpm validate` 的 `.pytest_cache` EPERM 事实保持原记录；最终 required CI 已在 clean runner 通过 `format:check`，未修改本机受保护缓存目录。
- Closeout PR #169 首轮 run `38146474911` 证明纯 docs PR 不应要求活动 task calibration：repo check 通过后 calibration 对已完成原分支返回 `TASK_CURRENT_NOT_FOUND`。提交 `b5b03127` 将 static 分流收紧为 code PR 强制 calibration、workflow dispatch 强制 calibration、docs-only PR 跳过 calibration，同时仍运行 repo/board/format；workflow contract `2/2` RED→GREEN。该代码型修复在 #169 合并前暂将本 brief 恢复 `fix` 并绑定 closeout 分支。
- #169 第二轮 unit 暴露 board negative-identity test 依赖真实 brief 分支；提交 `3689245f` 为 loader 增加纯测试 `taskRecordSources` 注入点，使 fixture 自包含，root governance `193/193` 通过。
- #169 最终 run [`38147478986`](https://github.com/adooper-liu/Logixs/actions/runs/38147478986)：`quality/static/unit/build/changes` success，`e2e/dictionary/security` 按变更分类 skipped；PR 于 `2026-10-12T00:25:34Z` 以 merge commit `b6fca798577d6b5c56ce19b8fff651a9f457bd61` 合入 `main`。
- 本 finalization 恢复 `status: done` 并重建 main 上的 not-observed board；新 CI 规则将本纯 docs PR 继续执行 repo/board/format，但不再要求已完成任务的 active-branch calibration。

## 进度 log

| 日期       | 阶段   | 负责        | commit   | 说明                                                                                                             |
| ---------- | ------ | ----------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| 2026-10-11 | design | Claude Code | —        | 负责人批准方案 A；建立唯一 brief，第一片限定当前 checkout 的共享只读校准投影                                     |
| 2026-10-11 | coding | Claude Code | 5deb703b | 负责人批准 Native 执行；第一薄片从共享 parser 与 scope authority 开始，board/CI 留待后续计划                     |
| 2026-10-11 | coding | Claude Code | dcc105c6 | 第一薄片实现完成：parser、repository/UI gate、checkout projection/CLI；99 tests 与静态门禁通过，等待本片证据提交 |
| 2026-10-11 | coding | Claude Code | 293cde92 | TDC3 完成：看板消费同一投影、board check 提交后稳定、111 tests 与四视口人工核对通过；下一片接 CI static          |
| 2026-10-11 | review | Claude Code | 3c9c0307 | TDC4 本地完成：CI static 只读接线、全量门禁分轨通过；等待 fresh 整体复审与 PR CI                                 |
| 2026-10-11 | fix    | Claude Code | 04e3fb82 | fresh 整体复审返回 4 个 Important finding；全部 accepted，进入一次 TDD fix pass                                  |
| 2026-10-11 | review | Claude Code | 0a92ddea | 4 个 finding 全部 RED→GREEN 修复；root/affected suites 与静态门禁通过，进入 PR required quality                  |
| 2026-10-11 | done   | Claude Code | 7fdeb1f4 | PR #168 required quality 全绿并合入 main；本 closeout 回写真实 PR/CI/merge 证据                                  |
| 2026-10-11 | fix    | Claude Code | b5b03127 | PR #169 首轮暴露 docs-only calibration 路由缺口；规则与契约测试已修复，等待新 CI                                 |
| 2026-10-12 | done   | Claude Code | b6fca798 | PR #169 required quality 全绿并合入 main；最终纯 docs 分支恢复 done 与 main board                                |
