---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：相关 web 测试 10 项通过；web typecheck 通过；变更文件 eslint/prettier 通过；repo:check 通过。Playwright desktop-chromium「container-list remains readable」与「container table supports data operations」通过（表头有「待办」，无「任务状态」「同步状态」）。未执行：完整 pnpm validate、像素基线。
---

# 任务：干活表展示已落库待办

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

干活表增加「待办」列：来自租户级 `GET /node-tasks` 里未完成的节点任务。没有未完成任务时写「没有待办」，不铺同步/ETA，不把 `idle` 显示成「无投影」。

## 权威入口

- [QUERY_PROJECTION_CONTRACT_V1](../../product/domain/QUERY_PROJECTION_CONTRACT_V1.md) §3
- [p6-list-node-tasks-by-tenant](./p6-list-node-tasks-by-tenant.md)
- [WORKSPACE_UI_INVENTORY](../../product/WORKSPACE_UI_INVENTORY.md) §4.3

## 边界 / 不做

- 不恢复同步状态、预计/实际到港、风险列和快筛。
- 不编造领取人或截止时间；一柜多条未完成任务取列表中最早一条。
- 不改旧迁移，不更新像素基线，不 commit。

## 验收

- [x] 干活表有「待办」列；有未完成任务显示节点人名话 + 状态；没有则「没有待办」。
- [x] 不出现「无投影」「任务状态」「同步状态」列。
- [x] 任务接口失败时不把空待办假装成查过。
- [x] 相关 web 测试通过。

## 方案

`useLiveCatalog` 并行拉货柜与租户任务；`attachOpenTasks` 只改有未完成任务的行。看档共用同一份 catalog，有待办才在三态里露出任务。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明             |
| ---------- | ------ | ---- | ------ | ---------------- |
| 2026-09-13 | coding | —    | —      | 开工：干活表待办 |
| 2026-09-13 | done   | —    | —      | 待办列已接通     |
