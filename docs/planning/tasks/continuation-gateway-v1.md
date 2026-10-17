---
status: coding
branch: feat/continuation-gateway-v1
verification: "CG1 pure projection 32/32 and CG1/CG2 combined regressions passed after all Standards/Spec findings were closed. CG2 SessionStart Hook 18/18 and combined 94/94 passed; live 12-worktree runs completed in 1682-1872ms without fallback, with raw Git no-write proven. CG3 tasks:list/Skills implementation and historical compatibility regressions passed. Text advisories, fresh-transcript startup handling, source-aware recovery fallback, shared status trust across parser/resolver/query/repo/worktree, canonical worktree blockers, authority-aware stale retirement, exact status-token attribution, and trusted dependency completion all passed scoped two-axis review with no remaining finding. A true independent fresh Claude startup returned resume/clear for this brief with nextGate=run-slice-verification and the correct authority reminder. Security review found no high-confidence vulnerability. Final board generation/check, docs/repo/calibration, explicit task-file formatting, lint, typecheck, unit tests, contracts, dictionary, Prisma generation, and production build passed. Full validate did not exit 0: root format:check hit the known apps/ai-service/.pytest_cache EPERM although all task-owned files passed explicit Prettier; the unchanged full-chain domain-adapter integration test reproducibly failed 3/6 (HTTP 400/time-out) outside this task's API/DB/fixture diff; E2E was not run because the session permission classifier denied connected-service execution. PR CI remains the merge authority; commit, PR CI, and merge remain pending."
owner: main
writer: codex
risk: high
dependsOn:
  - transparent-development-calibration-v1
  - cross-worktree-calibration-v1
writeScopes:
  - docs/planning/tasks/continuation-gateway-v1.md
  - docs/superpowers/specs/2026-10-16-continuation-gateway-design.md
  - scripts/continuation-gateway.mjs
  - scripts/continuation-gateway.test.mjs
  - scripts/task-brief-state.mjs
  - scripts/task-brief-state.test.mjs
  - scripts/check-repository.mjs
  - scripts/check-repository.test.mjs
  - scripts/worktree-calibration.mjs
  - scripts/worktree-calibration.test.mjs
  - package.json
  - .claude/settings.json
  - .claude/hooks/continuation-gateway.mjs
  - .claude/hooks/continuation-gateway.test.mjs
  - .claude/skills/continuation/SKILL.md
  - .claude/skills/continue-work/SKILL.md
  - .claude/skills/drift-check/SKILL.md
  - .claude/skills/logix-help/SKILL.md
  - docs/planning/progress-board.html
exclusiveLocks:
  - repository-governance
  - root-tooling
  - task-brief-contract
  - worktree-calibration
  - continuation-gateway
sharedIntegrationScopes:
  - package.json
  - .claude/settings.json
  - docs/planning/progress-board.html
authorityRefs:
  - AGENTS.md
  - ENGINEERING_RULES.md
  - docs/planning/tasks/_template.md
  - docs/planning/tasks/transparent-development-calibration-v1.md
  - docs/planning/tasks/cross-worktree-calibration-v1.md
---

# 任务：跨对话只读续线门 V1

## 目标

把现有 task brief、当前 checkout 校准、跨 worktree 校准和续线 Skills 收口成一个无状态、只读、目标相关的续线投影，并在 `SessionStart(startup|resume|clear|compact)` 自动注入紧凑事实。新会话能在不依赖旧聊天的前提下识别当前任务、工作区、保护边界和下一门禁；普通 clean main/no-task 会话保持静默。

## 批判求真结论

1. 不建立 continuation 数据库、状态文件、缓存、运行目录或第二套任务字段；不新增 `currentSlice/nextActor/nextAction/lastVerifiedHead`。
2. 不直接复用 `calibration:check` / `worktrees:check` 的全局退出码作为启动门禁：no-task 是合法 idle，非重叠 dirty worktree 只告警，blocked brief 是可重评候选。
3. 目标解析顺序固定为：显式 `brief#slice` → 当前分支唯一活动 brief → 明确续线意图下列候选并询问一次；不按时间、文件顺序或状态猜任务。
4. 两轴输出：`action = idle|resume|review-handoff|select`；`safety = clear|protect-read-only|block-target`。无续线意图且 no-task 时 `idle/clear`，不向用户显示错误。
5. `SessionStart` 是唯一自动注入事件，matcher 为 `startup|resume|clear|compact`。不使用 `PostCompact` 或 `CwdChanged` 注入；不假设 Hook 可阻止 session 生命周期。
6. Hook 使用 stdin 的 `cwd` 识别实际 checkout；不硬编码 `${CLAUDE_PROJECT_DIR}` 为当前 worktree。
7. Hook 只调用 Node 和本地只读 Git，5 秒超时、无网络、无 `gh`、无 `pnpm`、失败开放；stdout 只输出合法 SessionStart `additionalContext` JSON，诊断写 stderr。
8. 自动注入只含 2–4KB 紧凑事实；完整 brief、所有 worktree、PR/CI、diff 和续线提示词仍按需读取。
9. Codex HANDOFF 只有在当前用户消息或恢复 transcript 中保留完整 header 时才进入 `review-handoff`；不能从 Git 猜“待 review 的 HANDOFF”。
10. dirty worktree 只在 tracked/untracked 路径名与目标 `writeScopes` 重叠时进入 `protect-read-only`；不读取 untracked 内容，不自动清理或覆盖。

## 直接消费者

| 消费者              | 场景                                   | 结果                                       |
| ------------------- | -------------------------------------- | ------------------------------------------ |
| `SessionStart` Hook | 新会话、resume、clear、compact         | 自动注入紧凑且可丢弃的本地事实快照         |
| `/continue-work`    | 当前会话直接恢复                       | 先消费续线投影，再输出较完整接管回执并继续 |
| `/continuation`     | 生成新会话提示词                       | 以同一投影生成指针，不实施                 |
| `/drift-check`      | 中途只读校准                           | 以同一投影选择目标，再展开完整对照         |
| 普通会话            | clean main / 无活动 brief / 无续线意图 | 静默，不制造“找不到任务”错误               |

## 协议

```ts
interface ContinuationProjection {
  protocol: "logix-continuation/v1";
  action: "idle" | "resume" | "review-handoff" | "select";
  safety: "clear" | "protect-read-only" | "block-target";
  workspace: {
    path: string;
    branch: string;
    head: string;
    mainRef: string | null;
  };
  target: null | {
    brief: string;
    title: string;
    status: string;
    writer: string;
    slice: string | null;
    nextGate: string;
  };
  relevantConflicts: Array<{
    code: string;
    worktree: string;
    paths: string[];
    remedy: string;
  }>;
  advisories: Array<{ code: string; subject: string }>;
  remoteEvidence: { state: "not-observed"; reason: string };
}
```

Hook 只在 `action !== idle` 或 `safety !== clear` 时注入。注入文字必须标明它是本地派生快照，不是权威；Claude 写入前仍须读取 `AGENTS.md`、唯一 brief 和真实 diff。

## 边界 / 不做

- 不修改业务权威、产品代码、Schema、迁移、公共契约或 UI。
- 不自动创建 brief/分支/worktree，不切分支，不 stash/reset/clean/commit/push/merge。
- 不调用网络、GitHub、Claude/MCP、包安装或外部服务。
- 不写本地日志、状态缓存、pending handoff 文件或接管 ACK 文件。
- 不把 progress board 作为权威。
- 不修改显式 `calibration:check` 与 `worktrees:check` 的既有严格语义；续线层只复用其纯观察/分类能力并采用目标相关策略。
- 不让 Hook 自动执行 `/continue-work` 或开始实施。

## 执行切片

### `CG1-pure-projection`

| 项目     | 内容                                                                                               |
| -------- | -------------------------------------------------------------------------------------------------- |
| 基线     | `08f147ed`                                                                                         |
| 范围     | 本 brief/spec；`continuation-gateway.mjs` 与测试；必要时仅导出既有纯函数，不改变其行为             |
| TDD      | 先覆盖六类 UX 场景和 no-write，再写最小投影                                                        |
| 停止条件 | no-task 静默；唯一分支任务可恢复；blocked 可候选；dirty overlap 目标相关；HANDOFF 优先；无第二状态 |

### `CG2-session-start-hook`

| 项目     | 内容                                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 范围     | `.claude/settings.json`、Hook 适配入口、Hook 测试、package test 入口                                                                  |
| 要求     | matcher 覆盖 `startup`、`resume`、`clear`、`compact`；`command: node` exec form；5 秒；stdin cwd；合法 `additionalContext`；fail-open |
| 停止条件 | clean main/no-task 无注入；compact 可重注入；stdout 无日志污染；Windows 路径通过                                                      |

### `CG3-skills-task-query-and-live-rehearsal`

| 项目     | 内容                                                                                                                                     |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 范围     | continuation/continue-work/drift-check/logix-help Skills；基于 tracked brief 的 `tasks:list` 只读查询；真实仓库演练；progress board      |
| 查询入口 | `pnpm tasks:list`、`pnpm tasks:list -- --status <status>`、`pnpm tasks:list -- --current`；复用现有 parser，不改文件名、不建立第二套状态 |
| 验证     | 当前会话续线、新空白会话、compact、目标 worktree、dirty overlap、HANDOFF 六场景；任务查询 current/status/无匹配/非法参数与 no-write      |
| 停止条件 | Skills 与 tasks:list 消费同一 tracked brief 事实；新会话能准确接管；查询无写副作用；fresh Claude 只读整体复审和 PR CI 通过               |

### `CG3-fresh-transcript-enoent-fix`

| 项目     | 内容                                                                                                                                                                                               |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 失败事实 | Claude Code 2.1.300 的真实 `SessionStart:startup` 会传入尚未创建的 `transcript_path`；当前 `readRecoveryPrompt` 直接读取并抛 `ENOENT`，Hook 因而错误输出 fallback，而不是当前分支的 `resume/clear` |
| 范围     | `.claude/hooks/continuation-gateway.mjs`、`.claude/hooks/continuation-gateway.test.mjs`                                                                                                            |
| TDD      | 先用绝对但不存在的 fresh-session transcript 路径复现 fallback；再让仅该缺失路径等价于无恢复 prompt，并保留已有 transcript、HANDOFF、其他读取失败与 fail-open 回归                                  |
| 禁止范围 | 不提高 timeout，不吞掉非 `ENOENT` 读取错误，不改变 transcript 消息选择、HANDOFF 优先级、projection、Git/worktree 观察、JSON 形状或退出码                                                           |
| 验证     | Hook focused tests；CG1/CG2/CG3 组合回归；ESLint/Prettier；真实不存在 transcript 路径输出 `resume/clear`；Git HEAD/status/worktree registry 前后不变                                               |
| 停止条件 | RED 不是由 `ENOENT` fallback 触发；修复需要改变协议或既定 fail-open 边界；出现未归属改动                                                                                                           |

### `CG3-status-ambiguity-fail-close`

| 项目     | 内容                                                                                                                                                                                                                                                     |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 失败事实 | tracked brief 若含 `status: done` 后再重复 `status: coding`，parser 保留第一个值并记录 `TASK_PARSE_INVALID`；tasks:list 仅按保留值判定历史兼容，导致 `--current --json` exit 0、current=null，隐藏活动任务                                               |
| 范围     | `scripts/task-brief-state.mjs`、`scripts/task-brief-state.test.mjs`、`scripts/continuation-gateway.mjs`、`scripts/continuation-gateway.test.mjs`、`scripts/check-repository.mjs`、`scripts/check-repository.test.mjs`、必要的既有 worktree consumer 回归 |
| TDD      | 建立 normalized task 的唯一 status trust verdict；覆盖 duplicate/array/list/nested/unsupported/missing/whitespace-colon/status-like 畸形，并跨 tasks:list、resolver、continuation target、repo validator、worktree observer 证明同一判据                 |
| 禁止范围 | 不取消历史 done/blocked 非 status carve-out，不把普通 no-task 变成错误，不改变文件名/frontmatter 权威/JSON 文本协议/Hook 生命周期/Skills/既有 blocked nextGate；不在各消费者复制新 status switch                                                         |
| 验证     | parser/query focused tests；全部 continuation 组合回归；真实重复 status 查询；lint/format；docs/repo/calibration/diff；board 在最终状态稳定后单独生成                                                                                                    |
| 停止条件 | 无法从 parser error 可靠区分 status 歧义；需要追溯失败所有历史 brief；出现未归属改动                                                                                                                                                                     |

## TDD 验收

- [x] clean main、无任务、无续线意图：`idle/clear`，Hook 不注入文本
- [x] feature branch 唯一活动 brief：`resume/clear`，目标和 next gate 正确
- [x] 显式 `brief#slice` 优先于当前消息/恢复 transcript 中的 HANDOFF，再优先于分支推断
- [x] 多候选或目标不匹配：`select`，不猜任务
- [x] blocked brief 仅作为 `select/protect-read-only` 的只读重评候选，不进入可写 `resume/clear`
- [x] valid HANDOFF header 必须含 task/slice/base/role/workspace/commit 且 role=main；缺字段或错误 role 精确阻断
- [x] HANDOFF identity 必须携带只读 Git adapter 的观察结论：base/commit 可解析、base 是 HEAD 祖先、diff 可复现；commit 为 SHA 时必须等于观察 HEAD，`none` 表示未提交 diff
- [x] HANDOFF 的 base 是可复现 diff 的 review baseline；祖先 base + commit/HEAD 可验证时不得因 `base !== HEAD` 阻断
- [x] 其他 dirty worktree 非重叠：advisory，不阻断目标
- [x] 其他 dirty worktree 路径重叠：`protect-read-only`
- [x] 当前 checkout 的 out-of-scope tracked 继续 `block-target`；unowned untracked 非重叠只 advisory，重叠才 `protect-read-only`
- [x] malformed task writeScopes 失败关闭为 `block-target`
- [x] untracked 只读路径名，内容读取为 0
- [x] 直接消费现有 calibration projection 的 `derived` 和 worktree observation 的 `registration` 形状，不发明平行扁平契约
- [x] next gate 复用现有 calibration projection 的 `derived.nextGate`，不复制状态 switch
- [x] remote PR/CI 固定 `not-observed`，不阻止本地续线
- [x] feature checkout 不因不是 primary main 而错误阻断
- [x] SessionStart startup/resume/clear/compact 注入行为正确
- [x] Hook 超时/读取失败输出简短 fallback 且 exit 0
- [x] CwdChanged/PostCompact 未注册为续线上下文注入
- [x] Windows、中文、空格路径通过
- [x] 命令和 Hook 执行前后 Git HEAD/status/worktree registry 无变化
- [x] `/continue-work`、`/continuation`、`/drift-check` 使用同一投影边界
- [x] `tasks:list` 只读取 Git tracked brief 并复用现有 parser；默认显示 CURRENT + 状态摘要，`--current` 和 `--status coding|review|fix|blocked|design|done` 结果准确
- [x] `tasks:list` 不修改文件/Git，不把文件名当状态，不读取 untracked brief 内容；无 current 时明确 `none` 但退出成功，非法状态/参数稳定失败
- [x] 全新 Claude 会话真实接管演练通过

## CG2 复审裁决

```yaml
protocol: logix-disposition/v1
slice: CG2-session-start-hook
decisions:
  - finding: CG2-SCOPE-DECLARATION
    status: accepted
    reason: 两个 Hook 文件未列入 writeScopes，主代理已在 CG2 审查前修正；现有测试锁定该声明。
    writeback: brief frontmatter + hook test
  - finding: CG2-GIT-NO-WRITE
    status: rejected
    reason: 当前修复版已全局设置 GIT_OPTIONAL_LOCKS=0，并把无 revision diff 改为 diff-index/diff-files；raw index/refs/HEAD bytes+mtime 回归和 live HEAD/status 均证明 no-write，旧 finding 不再适用。
    writeback: none
  - finding: CG2-INTERNAL-DEADLINE
    status: accepted
    reason: 内部 4 秒 fallback 已实现，但当前真实 12-worktree 仓库 observer 约 6 秒，导致正常启动永远 fallback，核心自动续线不可用；必须收窄启动观察，在 4 秒内得到目标相关快照。
    writeback: hook implementation and performance regressions
  - finding: CG2-TRANSCRIPT-HANDOFF
    status: accepted
    reason: 需确保 tool_result 不覆盖最近真实用户 HANDOFF；当前修复需定向复核并保留回归。
    writeback: hook implementation and tests
  - finding: CG2-NESTED-CWD
    status: accepted
    reason: 需以 git rev-parse --show-toplevel 将 stdin 子目录 cwd 定位到 worktree 根；当前修复需保留回归。
    writeback: hook implementation and tests
  - finding: CG2-UNCOMMITTED-DIFF
    status: accepted
    reason: commit=none 必须存在 staged/unstaged diff；当前修复需保留 clean/dirty 两类回归。
    writeback: hook implementation and tests
  - finding: CG2-BLOCKED-PROJECTION
    status: accepted
    reason: blocked 显式目标必须构造 calibration projection并输出 revalidate-blocker；当前修复需保留回归。
    writeback: hook implementation and tests
  - finding: CG2-ROOT-TEST-WIRING
    status: accepted
    reason: continuation CG1/CG2 测试必须进入 pnpm test；当前 package 变更和测试已补齐。
    writeback: package.json + hook test
  - finding: CG2-SIBLING-ACTIVE-TASKS
    status: accepted
    reason: 其他 worktree 的 tracked brief 和 writer/scope/lock 冲突必须来自既有 worktree observer/projection；当前修复正确性需保留，性能切片不得回退为当前 catalog 猜测。
    writeback: hook implementation and tests
  - finding: CG2-UNREADABLE-WORKTREE
    status: accepted
    reason: 注册 sibling 无法读取时，重叠、dirty 和 active brief 均未知；不得丢弃 WORKTREE_READ_FAILED 后返回 clear。按已批准 fail-open 边界，整个 Hook 输出 fallback additionalContext 并 exit 0，不猜测精确冲突。
    writeback: hook implementation and tests
next: fix
```

## CG3 复审裁决

```yaml
protocol: logix-disposition/v1
slice: CG3-skills-task-query
decisions:
  - finding: CG3-CURRENT-AMBIGUITY
    status: accepted
    reason: resolveCurrentTask 的 ambiguous finding 被压成 none/exit0，必须保留 candidates 并 exit1，区别于合法 no-current。
    writeback: tasks:list implementation and tests
  - finding: CG3-MALFORMED-BRIEF
    status: accepted
    reason: normalizeTaskRecords 保留 parseErrors，但查询未 fail-closed，畸形 tracked brief 被展示为有效事实；任何 parseErrors 必须稳定 exit2 并列路径/code。
    writeback: tasks:list implementation and tests
  - finding: CG3-VERIFICATION-STATE
    status: accepted
    reason: 查询投影遗漏 verification，done 缺证据与合法完成不可区分；输出必须标明 verification present/missing 与 validCompletion，不能静默认证。
    writeback: tasks:list implementation and tests
  - finding: CG3-PNPM-JSON-BANNER
    status: accepted
    reason: pnpm lifecycle banner 污染 stdout；Skills 的机器 JSON 调用必须使用 pnpm --silent 或直接 node，测试真实管道可解析。
    writeback: continuation/continue-work/drift-check Skills and tests
  - finding: CG3-HOOK-AUTHORITY
    status: accepted
    reason: continue-work 不能依据启动时 snapshot 直接决定写入；必须明确投影非权威，并在续做时重新观察 checkout/worktree safety 后才行动。
    writeback: continue-work Skill and tests
  - finding: CG3-NESTED-CWD-QUERY
    status: accepted
    reason: Skills 使用裸 pnpm tasks:list 时，从 apps/web 等子目录无法调用根 script；统一改为 pnpm -w，机器 JSON 再加 --silent，并用 nested cwd 真管道验证。
    writeback: continuation/continue-work/drift-check/logix-help Skills and tests
  - finding: CG3-HISTORICAL-PARSE-COMPATIBILITY
    status: accepted
    reason: 全局 parseErrors 门禁让一个 legacy done brief 阻断 current/default/全部状态浏览，违反历史 done/blocked 不无差别追溯失败的既有规则。活动 malformed 必须 fail-closed；历史 done/blocked 保留 best-effort 展示并显式标 parseValidity=invalid、advisory 与 validCompletion=false。审查建议让 `--status done|blocked` 整体 exit2 的部分不采纳，因为会使一个旧格式文件锁死全部历史浏览入口。
    writeback: tasks:list implementation and tests
  - finding: CG3-TEXT-ADVISORIES
    status: accepted
    reason: JSON 已带 historical parse advisories，但默认/current 文本静默省略，人类入口会误报无异常；文本须追加稳定 advisory 行，不改变 exit code 或状态语义。
    writeback: tasks:list text formatter and tests
  - finding: CG3-FRESH-TRANSCRIPT-ENOENT
    status: accepted
    reason: 真实新会话在 SessionStart 时传入尚未创建的 transcript_path；Hook 无当前 prompt 时直接 readFileSync 并把 ENOENT 当观察失败，稳定输出 fallback。startup 的缺失 transcript 应等价于没有恢复提示词；已存在 transcript 的读取/解析边界和其他读取错误继续保持 fail-open。
    writeback: Hook recovery prompt handling and regression test
  - finding: CG3-TRANSCRIPT-SOURCE-BOUNDARY
    status: accepted
    reason: 首次修复把所有 SessionStart source 的 ENOENT 都压成空 prompt；真实 `source=resume` + 不存在 transcript 因而错误返回 branch-inferred `resume/clear`，静默丢失可能存在的恢复 HANDOFF。仅 startup 可把缺失 transcript 视为新会话尚未落盘；resume/clear/compact 缺失 transcript 必须继续 controlled fallback。
    writeback: Hook source-aware recovery boundary and regression tests
  - finding: CG-WHOLE-TASKS-HISTORICAL-STATUS-01
    status: accepted
    reason: 历史兼容当前只看 parser 保留的第一个 status；tracked brief 若先写 `status: done|blocked`、再重复写活动 status，会携带 TASK_PARSE_INVALID 却被降级为 historical advisory，current 查询 exit 0 并隐藏真实活动任务。前两次局部修复只收紧 tasks:list；整体复审继续证明 `resolveCurrentTask`、continuation target、worktree observer 与 repo validator 仍各自信任保留 status，且 whitespace-colon、missing status 等边界仍可产生消费者分裂。必须在 normalized task authority 形成唯一 status trust verdict，所有消费者复用；无歧义历史 done/blocked 的非 status 错误仍保留 carve-out。
    writeback: shared task status authority, all consumers and cross-consumer regressions
  - finding: CG3-STATUS-AUTHORITY-03
    status: accepted
    reason: `TASK_STATUSES` 已作为共享目录导出，但 check-repository 仍复制六值 allowedTaskStatuses，违反公共状态单一权威；repo validator 应导入共享目录，只保留真正语义更窄的 write/review 子集。
    writeback: check-repository status validation and tests
  - finding: CG3-WORKTREE-STATUS-INVALID-LOSS
    status: accepted
    reason: 共享 status trust 已进入 resolver 与 checkout projection，但 worktree projection 只从 state=active 聚合 checkout findings；primary 固定为 primary 而被排除，fully merged status-invalid sibling 又在 stale retirement 中被改写为 TASK_CURRENT_NOT_FOUND 并清空 checkout projection，导致 TASK_STATUS_INVALID 消失。status-invalid 必须保留为 blocking finding，但不得进入 active write conflict/WIP 计算。
    writeback: worktree projection and primary/fully-merged regressions
  - finding: CG3-WORKTREE-STATUS-INVALID-MULTIPLE-LOSS
    status: accepted
    reason: 首次 worktree 修复优先逐条复制 checkout TASK_STATUS_INVALID；一个 brief 有多条 status parse error 时，最终产生多个同根 blocker，并丢失 resolver 已聚合的完整 evidence/remedy。worktree 层应以 activeResolution 的单一 TASK_STATUS_INVALID 为 canonical finding，保留全部 status error evidence，并补 worktreePath/taskPath。
    writeback: worktree canonical status finding and multiple-error regression
  - finding: CG3-WORKTREE-UNTRUSTED-RETIREMENT
    status: accepted
    reason: stale retirement 只检查 local resolver 是否 status-invalid，却直接信任 primary catalog 同 ID record 的保留 status；当 primary record status-invalid、local sibling status-valid 且 fully merged 时，sibling 被改写为 TASK_CURRENT_NOT_FOUND，最终 findings 为空并错误返回 continue-with-current-task。primary authority 不可信时不得执行 trusted retirement，必须保留共享 canonical blocker，且不得进入 active conflict/WIP。
    writeback: primary-authority-aware retirement and regression
  - finding: CG3-WORKTREE-MULTI-TASK-LOCATION-LOSS
    status: rejected
    reason: 同分支多个 status-invalid brief 时 resolver 有意返回 branch-level 单一 blocker而不选 task；当前 evidence 精确列出每个 brief，worktreePath 存在且 nextGate 阻断。强制单一 taskPath 会伪造归属，不构成安全放行；逐 task 展示只作非阻塞可观测性候选。
    writeback: none
  - finding: CG-STATUS-LIKE-SYNTAX-ESCAPES-AUTHORITY
    status: accepted
    reason: `status: done` 后出现首 token 为 `status` 但缺冒号的 `status coding` 时，parser 只产生无 key 的普通错误，normalized status 仍 valid=done，resolver 返回 not-found 且 tasks:list 仅 historical advisory。仅把首 token 精确为 status 的 malformed 声明归因到 status；不对其他未知文本做模糊字段猜测。
    writeback: parser status-like attribution and cross-consumer regression
  - finding: CG-FINAL-REPO-DEPENDENCY-STATUS-TRUST
    status: accepted
    reason: repo dependency pass 仍读取 raw `dependency.metadata.status`；依赖 brief status-invalid 但首值为 done 时，虽然自身错误阻断仓库，consumer 仍被错误视为依赖完成。依赖完成必须同时要求共享 status trust 有效且 normalized status=done。
    writeback: repository dependency validation and focused regression
next: fix
```

## 负责人决策记录

| 决策 ID | 决定                                                                         | 依据                                                                             |
| ------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| CG-D01  | 建设独立、薄、只读续线门；不混入 UI 产品分支                                 | 负责人 2026-10-16 明确指令                                                       |
| CG-D02  | 只聚合现有事实，不建立第二套状态                                             | AGENTS 唯一事实链与批判求真结果                                                  |
| CG-D03  | 自动注入只用 SessionStart startup/resume/clear/compact                       | 当前 Claude Code 官方 Hook 语义；PostCompact/CwdChanged 不保证 additionalContext |
| CG-D04  | dirty worktree 采用目标相关保护，不把全仓无关现场变成全局阻塞                | 现有 dormant/untracked 保护政策与 live 旧 UI WIP                                 |
| CG-D05  | 当前消息显式 `brief#slice` 优先于历史 HANDOFF；完整 HANDOFF 再优先于分支推断 | 用户新指令不能被旧 transcript 劫持；HANDOFF 仍须优先进入真实 diff 审查           |
| CG-D06  | 保持 task 文件名稳定，在 CG3 提供 tracked brief 驱动的 `tasks:list` 查询     | 避免状态进入文件名形成第二套权威，同时让当前/评审/阻塞/完成任务一眼可查          |

## CG1 复审裁决

```yaml
protocol: logix-disposition/v1
slice: CG1-pure-projection
decisions:
  - finding: CG1-REAL-SHAPES
    status: accepted
    reason: 当前实现围绕自造扁平 fixture，通过测试却不能直接消费既有 calibration/worktree 投影；必须使用 derived/registration 真实结构或显式 adapter。
    writeback: continuation gateway implementation and regression fixtures
  - finding: CG1-SCOPE-FAIL-OPEN
    status: accepted
    reason: malformed writeScopes 属于非法保护边界，必须 block-target，不能按不重叠放行。
    writeback: continuation gateway implementation and tests
  - finding: CG1-HANDOFF-PROTOCOL
    status: accepted
    reason: HANDOFF 必须校验 task/slice/base/role/workspace/commit 与 role=main；review base 是差异基线，不要求等于 HEAD。
    writeback: continuation gateway implementation and tests
  - finding: CG1-BLOCKED-WRITABLE
    status: accepted
    reason: blocked brief 只允许只读重评，不能返回 resume/clear 造成写入许可错觉。
    writeback: continuation gateway implementation and tests
  - finding: CG1-TARGET-PRIORITY
    status: accepted
    reason: 当前消息的显式 brief#slice 优先；不存在显式新目标时，完整 HANDOFF 才优先于分支推断。
    writeback: brief/spec and continuation gateway tests
  - finding: CG1-CHECKOUT-DIRT
    status: accepted-partial
    reason: out-of-scope tracked 继续阻断；unowned untracked 改为目标相关，非重叠 advisory、重叠 protect-read-only。
    writeback: continuation gateway implementation and tests
  - finding: CG1-NEXT-GATE-DUPLICATION
    status: accepted
    reason: 必须复用 calibration derived.nextGate，不复制状态 switch。
    writeback: continuation gateway implementation and tests
  - finding: CG1-UTF8-LIMIT
    status: accepted
    reason: 4KB 是 UTF-8 字节上限，必须以 Buffer.byteLength 校验并安全截断多字节输入。
    writeback: continuation gateway implementation and tests
  - finding: CG1-BLOCKED-NEXT-GATE
    status: accepted
    reason: blocked brief 已进入只读重评，但普通 calibration 对 blocked 返回 no-active-delivery-gate；应在 task-brief-state 的唯一 nextGate 规则中补 `blocked -> revalidate-blocker`，gateway 继续只消费 derived.nextGate，避免再次复制状态 switch。
    writeback: scripts/task-brief-state.mjs + task-brief-state.test.mjs + continuation-gateway.test.mjs
  - finding: CG1-HANDOFF-IDENTITY
    status: accepted
    reason: HANDOFF 字段存在不等于 review identity 可复现；CG1 必须 fail-closed 消费只读 Git adapter 提供的 base/commit/HEAD/diff 观察结论，避免陈旧或伪造 HANDOFF 进入 clear。
    writeback: scripts/continuation-gateway.mjs + scripts/continuation-gateway.test.mjs
  - finding: CG1-HANDOFF-SHA-FORMAT
    status: accepted
    reason: 当前 identity 只比较字符串与观察布尔值；非 none commit、observedHead 和 workspace.head 必须是 40 位十六进制 Git SHA，否则相同伪值也会错误进入 clear。
    writeback: scripts/continuation-gateway.mjs + scripts/continuation-gateway.test.mjs
next: fix
```

## 进度 log

| 日期       | 阶段   | 负责  | commit | 说明                                                                                                                                                                       |
| ---------- | ------ | ----- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-16 | design | main  | —      | 从最新 main 建独立分支；并行核对现有机制、Hook 官方语义与 UX，收窄为无状态只读投影 + 单一 SessionStart Hook                                                                |
| 2026-10-17 | coding | codex | —      | CG1 纯投影完成；经多轮反例修复真实 producer 形状、scope、HANDOFF identity、blocked gate、target-relative dirt 与 UTF-8 限制                                                |
| 2026-10-17 | review | main  | —      | CG1 定向 32/32、组合 76/76，Standards/Spec 原审查上下文最终均无 finding；进入 CG2 SessionStart Hook                                                                        |
| 2026-10-17 | coding | codex | —      | CG2 Hook 完成并修复 no-write、deadline、transcript、nested cwd、HANDOFF diff、blocked projection、root tests 与 sibling 冲突                                               |
| 2026-10-17 | review | main  | —      | CG2 Hook 18/18、组合 94/94、pnpm test 通过；真实 12-worktree 三次 1682–1872ms 非 fallback；双轴定向复审无 finding，进入 CG3                                                |
| 2026-10-17 | coding | codex | —      | CG3 完成 tasks:list、四个 Skills 接线与 progress board；修复 ambiguity、malformed/verification、JSON banner、nested cwd 和历史兼容                                         |
| 2026-10-17 | review | main  | —      | CG3 文本 advisory 修复经双轴复审无 finding；focused 49/49、组合 111/111、lint/format/diff/calibration 与 live default/current/JSON 通过                                    |
| 2026-10-17 | coding | main  | —      | 本次真实 fresh session 收到 fail-open fallback；直接 Hook 10/10 在 1731–1806ms 返回 resume/clear，暂记验证缺口；恢复 coding 继续真实演练                                   |
| 2026-10-17 | coding | main  | —      | 真实重叠 worktree 下 deadline 包装 10/10 在 1764–1984ms 返回 protect-read-only；compact 与完整 HANDOFF 投影正确，临时现场已授权清理；仅独立 fresh Claude 接管待验收        |
| 2026-10-17 | fix    | main  | —      | 独立 fresh Claude 再现 fallback；transcript 证据定位为 startup 传入尚不存在的 transcript_path，Hook readFileSync 抛 ENOENT；接受 CG3-FRESH-TRANSCRIPT-ENOENT               |
| 2026-10-17 | fix    | main  | —      | 首次 ENOENT 修复审查发现 source 边界过宽；真实 resume + 缺失 transcript 错误返回 resume/clear；接受 CG3-TRANSCRIPT-SOURCE-BOUNDARY，要求仅 startup 例外                    |
| 2026-10-17 | review | main  | —      | startup-only ENOENT 边界双轴无 finding；focused 21/21、组合 114/114、lint/format/治理检查及真实四来源矩阵通过；恢复 coding 等待独立 fresh startup 验收                     |
| 2026-10-17 | review | main  | —      | 修复后独立全新 Claude 会话准确返回 resume/clear、本 brief、run-slice-verification 与 AGENTS/brief/real diff 权威提醒；进入高风险整体复审                                   |
| 2026-10-17 | fix    | main  | —      | 高风险整体复审复现 status 歧义绕过：done→coding 重复 key 被降为历史 advisory 且 current exit 0；接受 CG-WHOLE-TASKS-HISTORICAL-STATUS-01；board stale 留待最终生成         |
| 2026-10-17 | fix    | main  | —      | 首次 status 修复只覆盖重复 key；复审继续复现 status 数组无错误、缩进 status-like 声明仅 advisory，并缺 review→blocked 回归；保持同一 finding 继续修复                      |
| 2026-10-17 | fix    | main  | —      | 第二次 status 修复收紧 tasks:list 后，跨消费者复审证明 resolver/Hook/worktree/repo 仍信任保留值，且 whitespace-colon/missing status 未统一；改为共享 status trust 根因修复 |
| 2026-10-17 | fix    | main  | —      | 共享 trust 实现交回时发现 worktree 投影丢失 status-invalid：primary 未聚合，fully merged sibling 被 retirement 清空；确认原 writeScopes 已授权，接受 finding 继续修复      |
| 2026-10-17 | fix    | main  | —      | worktree blocker 保留修复后，多错误 brief 被复制为多个 TASK_STATUS_INVALID 且丢失 resolver 聚合 evidence；接受 canonical 单 finding 收口                                   |
| 2026-10-17 | fix    | main  | —      | canonical finding 修复后复现 primary catalog 同 ID status-invalid 仍错误退休 local valid sibling 并返回 continue；接受 authority-aware retirement；拒绝伪造单 taskPath     |
| 2026-10-17 | fix    | main  | —      | 最终增量复审代码主线无 finding；仅复现 `status coding` 未归因和 repo dependency 仍读 raw metadata 两个既有 trust 分裂，限定最小修复后直接收口                              |
| 2026-10-17 | review | main  | —      | 最后两个 trust 修复双轴无 finding；代码审查停止扩边界，恢复 coding 仅执行 progress board 生成、最终完整门禁与 Git/PR 集成                                                  |
| 2026-10-17 | review | main  | —      | board 与任务相关静态/unit/build 门禁通过；完整 validate 分轨记录既有 pytest-cache EPERM、未改 full-chain integration 失败及 E2E 权限拒绝；进入 PR CI 权威验证              |
