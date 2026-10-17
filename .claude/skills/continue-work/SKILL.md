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
2. 先消费 SessionStart 注入的 `logix-continuation/v1` 投影，但启动投影不是写入授权；它只提供待复核的 `action`、`safety`、target 和 `nextGate`。
3. 运行 `pnpm -w --silent tasks:list -- --current --json` 核对同一 tracked brief。投影缺失、查询 ambiguous/失败或两者不一致时，先完成常规只读核对，不得猜测目标。
4. 任何写入前必须重新观察当前 checkout 和全部 registered worktree safety：核对 workspace、分支、HEAD、`git status --short --branch`、实际 diff、writeScopes/locks、其他会话与 `git worktree list --porcelain`，重新判断目标范围重叠和所有权。
5. 保护现有 tracked/untracked 工作；不覆盖、不清理、不 stash、不另建重复 brief 或分支。
6. 若 `$ARGUMENTS` 指定任务，定位它的唯一 brief 和准确断点；若为空且查询给出唯一 current，直接继承；存在多个候选时只询问一次选择。
7. 重新观察后的 safety 为 `protect-read-only` 时只读调查并报告所有权；为 `block-target` 时处理或报告阻塞，不得开始写入。
8. 区分已完成、在途、真实阻塞和负责人待决。已定设计不重做，已通过验证不机械重跑。
9. 重新观察确认 `safety=clear` 且没有破坏性动作或负责人必决事项时，才从 `nextGate` 继续实现、验证、复审和集成，不等待“继续”。

首轮简短报告：路线图位置、workspace/分支/HEAD、现场归属、唯一写入者、继承决定、当前断点、下一动作、本轮不做、真实阻塞或负责人待决。
