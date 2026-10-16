---
status: fix
branch: docs/claude-codex-review-loop-v1
verification: "G1 local checks passed; PR #181 CI run 38867810774 static job 116864641807 failed because the progress board was stale; G2 generated the board and passed local board/docs/repo/Prettier/diff checks; main-agent review reopened the brief to fix governance metadata and final CI remains pending"
owner: main
writer: codex
risk: medium
dependsOn: []
writeScopes:
  - docs/planning/tasks/claude-codex-review-loop-v1.md
  - docs/planning/progress-board.html
  - AGENTS.md
  - docs/planning/tasks/_template.md
  - .claude/skills/business-start/SKILL.md
exclusiveLocks:
  - repository-governance
sharedIntegrationScopes:
  - AGENTS.md
  - docs/planning/tasks/_template.md
authorityRefs:
  - AGENTS.md
  - ENGINEERING_RULES.md
  - docs/planning/tasks/agent-role-mapping-v1.md
---

# 任务：Claude 澄清审查与 Codex 实施闭环 V1

## 目标

落实负责人 2026-10-16 的协作调整：Claude Code 主代理只负责澄清、唯一 task brief、实施指令、逐次审查、finding 裁决和 Git/CI/PR 集成，不编写产品实现代码；Codex Code 实现执行器负责代码、测试和实施验证，并以标准 `HANDOFF` 交回后等待 Claude Code 审查与下一指令。

## 边界 / 不做

- 本任务只修改仓库协作治理、任务模板和业务开工入口，不修改产品代码、测试、迁移或运行配置。G2 唯一例外是通过仓库生成器刷新 `docs/planning/progress-board.html`，不得手工编辑生成 HTML。
- 不建立第二套需求、handoff 文档或聊天状态源；唯一活动 task brief 仍是实施权威载体。
- 不追溯改写历史 brief、计划、提交和署名；2026-10-11 Claude-only 决定保留为历史事实，但由本次决定覆盖当前默认协作链。
- 不把负责人变成工程裁决者；负责人只原样复制 Claude Code 输出的 `TASK` 和 Codex Code 返回的 `HANDOFF`。
- 不假定 Codex Code 的具体模型；每次由 `HANDOFF.model` 如实登记，未知时写 `unknown`。

## 负责人决策记录

| 日期       | 决定         | 结论                                                                                                                                                             | 权威落点                           |
| ---------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 2026-10-16 | 默认协作链   | 覆盖 2026-10-11 Claude-only 方案，改为 `Claude 澄清/下发 -> 负责人复制 -> Codex 实施 -> 负责人复制 HANDOFF -> Claude 审查/下一指令`                              | `AGENTS.md` §1.2、§1.3             |
| 2026-10-16 | Claude 边界  | Claude Code 可写业务权威、ADR、brief、评审裁决和集成记录，但不得写或修复产品实现代码、测试、迁移、运行配置和生成物                                               | `AGENTS.md` §1.2 第 2～6 条        |
| 2026-10-16 | Codex 边界   | Codex Code 是产品实现唯一写入者，只按当前切片 `TASK` 与 `writeScopes` 实施，测试先行并返回包含实际模型、diff 范围、检查结果、异常和下一建议的 `logix-handoff/v1` | `AGENTS.md` §1.2 第 3～6 条、§1.3  |
| 2026-10-16 | 连续推进方式 | Claude 每次审查实际 diff 与验证证据；有 finding 就给精确修复指令，无 finding 就直接给下一切片或集成指令，不要求负责人重复批准“继续”                              | `AGENTS.md` §1.2 第 6、24 条、§1.3 |

## 执行切片

### 切片 `G1-governance-switch`

| 项目     | 内容                                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------------- |
| 基线     | `3a046e4d`（`main`）                                                                                  |
| 执行角色 | Claude Code 主代理仅修改治理权威、模板和入口；这是治理任务，不属于产品实现代码                        |
| 写入范围 | 见 frontmatter `writeScopes`                                                                          |
| 禁止范围 | 产品代码、测试、迁移、运行配置、生成物、历史 brief 正文                                               |
| 验证命令 | `pnpm exec prettier --write <四文件>`；`pnpm docs:check`；`pnpm repo:check`；`git diff --check`       |
| 停止条件 | 当前规则和模板不再要求 Claude 直接实现；默认每片均有 TASK/HANDOFF；Codex 模型不被猜测；无第二套需求源 |

### 切片 `G2-progress-board-closeout`

| 项目     | 内容                                                                                                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 基线     | `646e7ae9`                                                                                                                                                                                                                      |
| CI 反证  | PR #181 的 CI run `38867810774`、static job `116864641807` 中，`pnpm board:check` 因 `progress board is stale; run pnpm board:build` 退出 1                                                                                     |
| 执行角色 | Codex Code 实现执行器只更新本治理 brief，并通过仓库生成入口确定性刷新 progress board                                                                                                                                            |
| 写入范围 | `docs/planning/tasks/claude-codex-review-loop-v1.md`；`docs/planning/progress-board.html`                                                                                                                                       |
| 禁止范围 | 不修改产品代码、测试、运行配置、业务权威、其他 task brief 或生成器逻辑；不手工编辑生成 HTML                                                                                                                                     |
| 验证命令 | 初始 `pnpm board:check` 预期退出 1；生成后依次执行 `pnpm board:check`、`pnpm docs:check`、`pnpm repo:check`、两文件 scoped Prettier check、`git diff --check`，并检查 `git status --short`、`git diff --stat` 与两文件实际 diff |
| 停止条件 | 初始 stale 反证不成立、生成越界、最终 board 检查不通过，或 docs/repo 检查要求扩大范围时停止并交回                                                                                                                               |

## 复审裁决（G2）

```yaml
protocol: logix-disposition/v1
slice: G2-progress-board-closeout
decisions:
  - finding: G2-GOV-01
    status: accepted
    reason: >
      G1 已标 done 后又进入 CI 修复，继续显示 done 会让进度板错误释放 writer/lock 并隐藏当前修复。
      主代理已将状态改为 fix，最终 CI 与合并完成前不得恢复 done。
    writeback: docs/planning/tasks/claude-codex-review-loop-v1.md frontmatter
  - finding: G2-GOV-02
    status: accepted
    reason: >
      G2 实际实现写入者是 Codex；frontmatter 必须登记 writer: codex，与单写入者和冲突检查一致。
    writeback: docs/planning/tasks/claude-codex-review-loop-v1.md frontmatter
  - finding: G2-GOV-03
    status: accepted
    reason: >
      任务总边界原先排除生成物，与 G2 刷新 progress board 冲突；已明确 G2 仅允许通过生成器刷新该单一生成物。
    writeback: docs/planning/tasks/claude-codex-review-loop-v1.md 边界 / 不做
  - finding: G2-GOV-04
    status: rejected
    reason: >
      finding 将责任错误归于执行器。原始 TASK 已由主代理精确授权治理 brief 与 progress board 两个文件，
      并明确要求把 progress board 加入 writeScopes，因此 Codex 没有自行扩域。真实缺陷是主代理下发 TASK 前
      未先把唯一 brief 的 scope 写回一致；主代理现已正式确认该精确 scope，后续必须先写回 brief 再下发 TASK。
    writeback: docs/planning/tasks/claude-codex-review-loop-v1.md frontmatter、G2 切片
next: fix
```

## 验证证据

| 阶段            | 证据                                                                                                                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1 先前本地检查 | 2026-10-16 scoped Prettier、`pnpm docs:check`、`pnpm repo:check`、`git diff --check` 已通过                                                                                                                             |
| PR CI 失败反证  | PR #181；CI run `38867810774`；static job `116864641807`；`pnpm board:check` 因 progress board stale 退出 1                                                                                                             |
| G2 本地收口检查 | 初始 `pnpm board:check` 复现 stale 并退出 1；`pnpm board:build` 后，`pnpm board:check`、`pnpm docs:check`、`pnpm repo:check`、两文件 scoped Prettier check 与 `git diff --check` 均通过；状态和 diff 仅含声明的两个文件 |

## 验收

- [x] `AGENTS.md` 角色表包含 Claude Code 主代理、Codex Code 实现执行器、fresh Claude 独立复审和决策顾问。
- [x] Claude Code 写入边界明确排除产品实现代码、测试、迁移、运行配置和生成物。
- [x] 每个实现/修复切片默认要求 `TASK` 与 `HANDOFF`，且负责人仅承担原样复制。
- [x] `HANDOFF` 必填实际模型、真实审核基线、改动、检查、异常、提交和下一建议。
- [x] Claude Code 必须审查实际 diff 与验证证据，不能采信摘要，也不能直接修复实现。
- [x] 高风险任务仍保留全部切片完成后的 fresh Claude Code 整体只读复审。
- [x] 模板默认产品实现 `writer: codex`，纯治理/业务权威任务按实际写入者登记。
- [x] `/business-start` 与现行角色链一致。
- [x] 定向文档、仓库和格式门禁通过。

## 进度 log

| 日期       | 阶段   | 负责  | commit | 说明                                                                                                           |
| ---------- | ------ | ----- | ------ | -------------------------------------------------------------------------------------------------------------- |
| 2026-10-16 | coding | main  | —      | 负责人重新定案默认协作链，建立治理 brief 并同步规则                                                            |
| 2026-10-16 | done   | main  | —      | scoped Prettier、`docs:check`、`repo:check`、`git diff --check` 通过；当前协作规则完成切换                     |
| 2026-10-16 | fix    | codex | —      | G2：PR #181 CI run `38867810774` 的 static job `116864641807` 暴露 progress board 漏生成；按确定性生成入口收口 |
| 2026-10-16 | done   | codex | —      | G2：重新生成 progress board；board/docs/repo/Prettier/diff 检查通过，实际差异仅含治理 brief 与生成 HTML        |
