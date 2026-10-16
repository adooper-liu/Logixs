---
name: business-start
description: Use when the user explicitly starts end-to-end delivery for a Logix workbench or business node whose purpose and key policies already have an approved baseline.
argument-hint: "<工作台或业务节点> [；重点：<优先损失>]"
disable-model-invocation: true
---

# 业务开工

把本次调用解释为：`业务开工：$ARGUMENTS`。

若 `$ARGUMENTS` 为空，只询问一个问题：要开工哪个工作台或业务节点？

随后严格执行当前 `AGENTS.md` §1.2.2：

1. 先读取智慧基线、正式业务权威、现行 brief 和当前实现事实；不得从页面、数据库或 API 反推产品目的。
2. 读取 `.agents/skills/logix-task-bootstrap/SKILL.md` 与 `.agents/skills/logix-same-slice/SKILL.md`，用它们建立基线和同一步五面切片。
3. 第一轮按 `AGENTS.md` 固定格式报告路线图、岗位结果、优先损失、缺口、五面承接、边界、brief/分支和下一动作。
4. 没有现成智慧基线或出现负责人必决政策时，只对受影响事项转入 `/wisdom`；不要重谈整台工作台。
5. 若“需要负责人决定：无”，立即建立或恢复唯一 brief，输出可直接复制给 Codex Code 的当前切片 `TASK`；收到负责人贴回的 `HANDOFF` 后审查实际 diff 与验证证据，有 finding 时输出修复 `TASK`，无 finding 时输出下一切片或进入高风险 fresh Claude 复审、PR、CI 与集成；不要等待用户重复说“继续”。

保持 Claude Code 主代理澄清/下发/审查、Codex Code 唯一实现写入者、精确 writeScopes/locks、测试先行和未归属工作保护。Claude Code 不直接修改产品实现代码，不得把技术门禁通过冒充岗位业务闭环。
