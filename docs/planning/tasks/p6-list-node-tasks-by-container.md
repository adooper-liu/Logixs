---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-12）：pnpm --filter @logix/api test -- src/modules/work-execution src/modules/lifecycle-control 48 项通过；typecheck / lint / repo:check 通过。未执行：完整 pnpm validate、迁移应用到本机库、HTTP 冒烟、数据库集成测试、前端。
---

# 任务：按货柜列节点任务

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

提供 `GET /api/node-tasks?containerId=`，返回该货柜已有节点任务及工单，使用 GC-010 游标分页。调用方不再只能靠任务 id 逐条查询。

## 权威入口

- [QUERY_PROJECTION_CONTRACT_V1](../../product/domain/QUERY_PROJECTION_CONTRACT_V1.md) §9
- [TASK_WORK_ORDER_CONTRACT_V1](../../product/domain/TASK_WORK_ORDER_CONTRACT_V1.md) §13
- [MODULE_DEPENDENCIES](../../architecture/MODULE_DEPENDENCIES.md)

## 边界 / 不做

- 只读 `work-execution` 已落库任务；不拼 `ContainerOperationalView`，不调 lifecycle / shipment-registry。
- 不实现租户绑定过期 cursor、权限裁剪、allowedActions、前端。
- 不新发规范事件，不做 `SetNodeApplicability`、Outbox。
- 缺 `containerId`、非法 `pageSize`、损坏或过滤条件不匹配的 cursor 明确失败，不退回第一页。

## 验收

- [x] 按 `containerId` 返回任务页；默认 `pageSize=50`，最大 200。
- [x] 稳定排序 `createdAt asc, id asc`；`hasNextPage` 与 `nextCursor` 正确。
- [x] cursor 与 `containerId` 不一致时拒绝。
- [x] `pnpm --filter @logix/api test -- src/modules/work-execution src/modules/lifecycle-control` 与 `pnpm repo:check` 通过。

## 方案

Application 解析分页；Repository 按货柜查询；Controller 映射已有任务详情 DTO。为 `(container_id, created_at, id)` 补索引。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                    |
| ---------- | ------ | ---- | ------ | ----------------------- |
| 2026-09-12 | coding | —    | —      | 开工：按货柜列节点任务  |
| 2026-09-12 | done   | —    | —      | 48 项单测通过；游标分页 |
