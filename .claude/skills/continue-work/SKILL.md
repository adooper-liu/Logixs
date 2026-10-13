---
name: continue-work
description: Use when the user explicitly wants the current Claude Code session to resume an existing Logix task, branch, brief, worktree, or uncommitted implementation from its exact repository checkpoint.
argument-hint: "<任务、brief 或业务主线>"
disable-model-invocation: true
---

# 当前会话续线

把本次调用解释为：`续线：$ARGUMENTS`。

本命令是**直接恢复实施**，不是生成续线提示词。不要输出一段供新会话复制的提示词。

1. 读取 `CLAUDE.md`、`AGENTS.md`、适用嵌套规则和 `ENGINEERING_RULES.md`。
2. 核对当前 workspace 路径、分支、HEAD、`git status --short --branch`、最近提交、活动 brief、writeScopes/locks、其他会话与全部 worktree。
3. 保护现有 tracked/untracked 工作；不覆盖、不清理、不 stash、不另建重复 brief 或分支。
4. 若 `$ARGUMENTS` 指定任务，定位它的唯一 brief 和准确断点；若为空且只有一个可证明的活动任务，直接继承；存在多个候选时只询问一次选择。
5. 区分已完成、在途、真实阻塞和负责人待决。已定设计不重做，已通过验证不机械重跑。
6. 没有写入冲突、破坏性动作或负责人必决事项时，立即从断点继续实现、验证、复审和集成，不等待“继续”。

首轮简短报告：路线图位置、workspace/分支/HEAD、现场归属、唯一写入者、继承决定、当前断点、下一动作、本轮不做、真实阻塞或负责人待决。
