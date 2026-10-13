---
name: drift-check
description: Use when the user explicitly wants a read-only Logix mainline calibration to detect business-purpose, scope, workspace, brief, implementation, or delivery drift during an active task.
argument-hint: "<任务、brief 或工作台>"
disable-model-invocation: true
---

# 主线防漂移检查

对 `$ARGUMENTS` 做只读校准。不得修改文件、状态、Git、PR 或外部系统。

## 先确认校准对象

1. 报告当前 workspace 绝对路径、是否 linked worktree、分支和 HEAD。
2. 核对 `git status --short --branch`、活动 brief、其他会话、全部 worktree、writeScopes/locks 和实际 diff。
3. 若 `$ARGUMENTS` 指向另一个 workspace，或当前 checkout 看不到其最新 brief，先用 `git worktree list`、跨会话状态和明确的目标 workspace 做只读核对；仍不可见时写“当前 workspace 无法判定”，不得把旧快照当最新事实。

## 对照链

按现行 `AGENTS.md` 和权威逐项核对：

`业务目的 → 优先损失 → 岗位决定/动作 → 责任交接 → 所需事实 → UI/允许动作 → 权限边界 → 技术保障 → 结果指标 → 当前 brief/实际 diff/下一动作`

同时检查：

- 是否从数据库、接口、组件或方便开发反推业务目的；
- 是否越过唯一 brief、writeScopes、locks 或依赖顺序；
- 是否把基础设施、数据落库、页面存在或测试通过冒充业务闭环；
- 是否顺手扩到未来平台、无消费者抽象、其他工作台或另一个 Brief；
- 是否遗失负责人已定政策、真实业务数据认定或上下游边界；
- 是否有未披露的外部阻塞、权限/安全风险或恢复缺口。

## 固定输出

1. **结论**：`对齐` / `有漂移风险` / `已漂移` / `当前 workspace 无法判定`
2. **路线图与岗位结果**
3. **已定权威与当前 brief**
4. **实际实现/差异正在做什么**
5. **偏离项**：每项给证据、业务影响、是否阻塞
6. **建议动作**：最小纠偏步骤；需要负责人决定时给 2～3 个选项和推荐
7. **本次未检查**

不重写需求，不新建 brief，不把一般优化升级为阻塞 finding。
