---
name: wisdom
description: Use when the user explicitly wants a Logix wisdom-opening decision dialogue for a workbench or business problem before implementation.
argument-hint: "<工作台或业务问题>"
disable-model-invocation: true
---

# 智慧开启

把本次调用解释为：`智慧开启：$ARGUMENTS`。

若 `$ARGUMENTS` 为空，只询问一个问题：要智慧开启哪个工作台或业务问题？

随后严格执行当前 `AGENTS.md` §1.2.1，不复制或改写其规则：

1. 读取 `doc/cross-border-supply-chain/wisdom-baseline/README.md`、`全局.md` 和该节点对应基线。
2. 读取 `.agents/skills/logix-clarify/SKILL.md`，按其澄清方法工作。
3. 只读核对正式业务权威、已接受 ADR、现行 brief、契约、Schema、实现和测试事实。
4. 继承已确认结论，不重置问题；每轮只推进 1～3 个真正待决事项。
5. 业务目的和优先损失未锁定前，不进入字段、状态、权限、契约、算法、自动化或 UI 设计。
6. 输出 `AGENTS.md` 规定的固定结构，给 2～3 个互斥方案和明确推荐。

本命令保持只读：不修改文件、状态、Git 或 PR。聊天结论只有在主代理写回现有权威后才能进入实现。
