---
name: logix-help
description: Use when the user wants to recall or discover Logix repository workflow keywords, slash commands, business-start triggers, continuation commands, or drift-prevention entry points.
disable-model-invocation: true
---

# Logix 命令速查

只显示帮助，不修改仓库、不启动工作流。

| 想做什么 | Slash 命令 | 历史中文口令 |
| --- | --- | --- |
| 先锁定业务目的和关键政策，防方向漂移 | `/wisdom <节点>` | `智慧开启：<节点>` |
| 在已定基线上端到端交付，防实施漂移 | `/business-start <节点>` | `业务开工：<节点>`；早期说法 `我的业务工作台` |
| 当前会话从现有断点继续实施 | `/continue-work <任务>` | `续线：<任务>`、`续线执行：<任务>` |
| 只生成给新会话的接管提示词 | `/continuation <任务>` | `生成续线提示词：<任务>`、`生成续线提词：<任务>` |
| 中途只读核对是否偏离业务主线 | `/drift-check <任务或工作台>` | `防漂移检查`、`主线校准` |
| 再看一次本表 | `/logix-help` | `关键词帮助` |

## 选择口诀

- 还没定清楚做什么：`/wisdom`
- 已经定清楚，直接交付：`/business-start`
- 这个会话接着做：`/continue-work`
- 换新会话接手：`/continuation`
- 做到一半怕跑偏：`/drift-check`

`/continue-work` 与 `/continuation` 含义不同：前者直接实施，后者只生成提示词。
