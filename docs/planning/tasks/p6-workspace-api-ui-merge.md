---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/web test 36 文件 / 92 项通过；web typecheck 通过；变更文件 eslint 通过；repo:check 通过。未执行：完整 pnpm validate、视觉 E2E（像素基线未改，用例已改走 ?demo=1）、浏览器里默认 /tasks 点完成工单。
---

# 任务：作业 UI 与真实 API 合并

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

`/tasks`、`/containers` 成为唯一作业入口，默认消费真实 API。演示数据只在 `?demo=1` 出现，供视觉/流程回归。不编造 ETA、提单、轨道、监控队列或任务定义文案。

## 权威入口

- [UX_CONTAINER_WORKBENCH](../../product/UX_CONTAINER_WORKBENCH.md) §5.4
- [UI_SYSTEM.md](../../product/UI_SYSTEM.md) UI-D02 / UI-D05
- [QUERY_PROJECTION_CONTRACT_V1](../../product/domain/QUERY_PROJECTION_CONTRACT_V1.md)
- [TASK_WORK_ORDER_CONTRACT_V1](../../product/domain/TASK_WORK_ORDER_CONTRACT_V1.md)

## 边界 / 不做

- 不把演示规则迁成业务权威；缺字段显示空或「无投影」。
- 不改一柜一档演示页去假装真实轨道。
- 不执行补偿、不改旧迁移、不更新像素基线。
- 不做租户级 `GET /node-tasks` 新契约（本刀按货柜扇出，种子规模可接受）。

## 验收

- [x] 默认 `/tasks` 列出本租户节点任务，完成工单走真实 API 并显示三段回执。
- [x] 默认 `/containers` 用同一张动态表，只填 API 已有列；打开行进入 `/tasks?containerId=`。
- [x] `?demo=1` 仍是原演示仓库；E2E 视觉/任务流程改走该开关。
- [x] 侧栏不再出现「真实任务」「真实货柜」；旧路径重定向。
- [x] `pnpm --filter @logix/web test` 与 `pnpm repo:check` 通过。

## 方案

适配器把 `NodeTaskDetail` / `ContainerSummary` 映到现有 `TaskItem` / `ContainerProjection`。未知任务语言用 `live_node_task`，标题取节点中文名。可完成工单映射为完成动作；领取/输入/异常在真实路径为空操作。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                     |
| ---------- | ------ | ---- | ------ | ------------------------ |
| 2026-09-13 | coding | —    | —      | 开工：作业 UI 接真实 API |
| 2026-09-13 | done   | —    | —      | 默认 API，演示仅 ?demo=1 |
