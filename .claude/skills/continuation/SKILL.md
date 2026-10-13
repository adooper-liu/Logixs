---
name: continuation
description: Use when the user explicitly asks to generate a repository-grounded continuation prompt for a new Claude Code session to take over a Logix task safely.
argument-hint: "<任务、brief 或业务主线>"
disable-model-invocation: true
---

# 生成续线提示词

把本次调用解释为：`生成续线提示词：$ARGUMENTS`。

本命令**只生成提示词**。不得开始实施，不修改仓库，不切分支，不提交、推送或创建 PR。

1. 只读核对 `CLAUDE.md`、`AGENTS.md`、适用嵌套规则、唯一 brief、业务权威、当前 workspace、分支、HEAD、tracked/untracked 现场、其他会话、worktree、writeScopes/locks、PR/CI 和测试证据。
2. 不依赖聊天摘要猜状态；仓库和远端事实优先。发现共享 checkout、并行写入或未归属改动时，在提示词中明确保护边界。
3. 区分：当前会话直接续线 `/continue-work`，与新会话交接 `/continuation`。不得把前者的实施动作带入本命令。
4. 输出一个可完整复制的代码块，至少包含：强制读取、准确断点、已定决策、允许/禁止范围、首轮报告、TDD/验证、复审、Git/PR 收口、停止条件。
5. 提示词要求接管现有工作，不重复设计、brief、分支或已完成任务；未归属文件不得读取、清理或暂存。
6. 若 `$ARGUMENTS` 为空，只询问要为哪个任务生成续线提示词。

报告外只保留一句必要说明；不要顺带执行提示词中的任何步骤。
