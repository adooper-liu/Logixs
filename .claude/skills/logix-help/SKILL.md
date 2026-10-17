---
name: logix-help
description: Use when the user wants Chinese help for Logix workflow commands, current slash commands, available skills, command purposes, usage examples, historical keywords, or drift-prevention entry points.
argument-hint: "[关键词、命令名、all 或 全部]"
disable-model-invocation: true
---

# Logix 中文命令帮助

只提供帮助，不修改仓库、不改设置、不启动或执行被介绍的命令。

将 `$ARGUMENTS` 去掉外层空白；若以 `/` 开头，去掉该 `/` 后再作为查询词。匹配命令名、中文用途、适用场景和历史别名时，忽略大小写与空白。

## 无参数：显示常用导航

先显示以下 **Logix 固定工作流入口**。这是仓库工作流导航，不声称是本会话全部命令。

| 想做什么 | Slash 命令 | 历史中文口令 | 是否执行工作流 |
| --- | --- | --- | --- |
| 先锁定业务目的和关键政策，防方向漂移 | `/wisdom <节点>` | `智慧开启：<节点>` | 只读决策对话 |
| 在已定基线上端到端交付，防实施漂移 | `/business-start <节点>` | `业务开工：<节点>`；早期说法 `我的业务工作台` | 会进入交付流程 |
| 当前会话从现有断点继续实施 | `/continue-work <任务>` | `续线：<任务>`、`续线执行：<任务>` | 会直接续做 |
| 只生成给新会话的接管提示词 | `/continuation <任务>` | `生成续线提示词：<任务>`、`生成续线提词：<任务>` | 只生成提示词 |
| 中途只读核对是否偏离业务主线 | `/drift-check <任务或工作台>` | `防漂移检查`、`主线校准` | 只读校准 |
| 查看本中文帮助 | `/logix-help [关键词]` | `关键词帮助`、`命令帮助` | 只显示帮助 |

再固定显示：

- **本会话当前实际可用的全部 Slash 命令**：在交互终端输入 `/help`，或直接输入 `/` 打开并筛选命令菜单。
- **当前可用 Skills 及来源**：输入 `/skills`，可按名称、description 或 source 过滤。
- **任务查询**：`pnpm -w tasks:list` 显示 current 与状态汇总；`pnpm -w tasks:list -- --current` 查询当前分支唯一活动任务；`pnpm -w tasks:list -- --status coding|review|fix|blocked|design|done` 按 tracked brief 状态筛选。机器读取使用 `pnpm -w --silent tasks:list -- --current --json`，避免 pnpm banner 污染 JSON。
- 本帮助不能读取完整运行时命令注册表；插件、MCP、个人/企业 Skills、同步 Skills、目录作用域和平台能力会动态变化，故不维护静态“全部命令”副本。

## 有参数：中文搜索与解释

每个可靠匹配结果，无论是 Logix 固定入口还是其他当前可见 Skill，都使用同一结构：

```text
/命令 <参数提示>
用途：什么时候用、解决什么问题
用法：一条可复制示例
效果：只读 / 只生成提示词 / 直接操作或实施
不要用于：最容易混淆的相邻命令；没有可靠相邻项时写“无可靠相邻项”
来源：仅在可确认时标注项目、目录作用域、插件/同步或用户
```

不得为了填满字段编造相邻命令、参数、效果或来源。

### 查询 Logix 固定入口

若查询词匹配上表任一命令或历史别名，只返回最相关的 1～3 个结果，并使用上述通用结构。

必须明确：

- `/continue-work` 直接恢复当前任务；`/continuation` 只生成新会话提示词。
- `/wisdom` 负责未定业务目的与政策；`/business-start` 负责在已定基线上交付。
- `/drift-check` 只读校准，不实施纠偏。

### 查询其他命令或 Skills

基于本会话中模型**当前可见**的 Skill 名称和 description，给出可靠匹配的中文解释，使用上述通用结果结构，并仅在可确认时标注来源类别：项目、目录作用域、插件/同步或用户。不要根据名字猜来源，也不要声称该列表完整。

若查询词是 `all`、`全部`、`所有`、`内置`、`可用命令`，或用户明确要求完整清单：

1. 不输出静态长表；
2. 说明 `/help` 或输入 `/` 才是当前会话全部命令的运行时权威；
3. 说明 `/skills` 用于查看 Skills 及来源；
4. 给出如何继续键入查询词过滤的中文操作说明。

若没有可靠匹配：

- 不回答“命令不存在”；
- 写明“Skill 内无法可靠枚举本会话完整注册表”；
- 建议在交互终端输入 `/` 后继续键入查询词；Skill 查询使用 `/skills`；
- 最多给 1～3 个语义相近的 Logix 固定入口。

## 选择口诀

- 还没定清楚做什么：`/wisdom`
- 已经定清楚，直接交付：`/business-start`
- 这个会话接着做：`/continue-work`
- 换新会话接手：`/continuation`
- 做到一半怕跑偏：`/drift-check`
