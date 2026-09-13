---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/api test -- src/modules/work-execution 7 文件 / 47 项通过；相关 web 测试 6 项通过；api/web typecheck 通过；变更文件 eslint/prettier 通过；repo:check 通过。HTTP：本租户 GET /api/node-tasks?pageSize=50 200（跨柜任务，无 containerId）；他租户 200 空页。Playwright desktop-chromium「task workbench remains readable」与「does not fabricate an operation record」通过。未执行：完整 pnpm validate、任务翻页 UI、像素基线。
---

# 任务：按租户列节点任务

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

`GET /api/node-tasks` 在缺少 `containerId` 时按当前租户列已落库节点任务。现场「我的任务」不再先扫全部货柜再扇出。带 `containerId` 的行为保持不变。

## 权威入口

- [QUERY_PROJECTION_CONTRACT_V1](../../product/domain/QUERY_PROJECTION_CONTRACT_V1.md) §9
- [TASK_WORK_ORDER_CONTRACT_V1](../../product/domain/TASK_WORK_ORDER_CONTRACT_V1.md)
- [p6-list-node-tasks-by-container](./p6-list-node-tasks-by-container.md)
- [WORKSPACE_UI_INVENTORY](../../product/WORKSPACE_UI_INVENTORY.md) §4.5

## 边界 / 不做

- 不拼 `ContainerOperationalViewV1`，不返回 allowedActions，不做领取/指派。
- 不把 `containerId` 为空的任务算进租户页（无法定界）。
- 不改旧迁移，不更新像素基线，不 commit。

## 验收

- [x] 无 `containerId`：只返回本租户货柜上的任务；默认 50，最大 200；排序 `createdAt asc, id asc`。
- [x] 租户 cursor 绑定 `tenantId`；与租户或柜过滤不匹配直接失败。
- [x] 有 `containerId`：仍先断言租户再按柜列，旧 cursor 可用。
- [x] `/tasks` 未限定货柜时一次 `GET /node-tasks`，不再按柜扇出。
- [x] `pnpm --filter @logix/api test -- src/modules/work-execution` 与相关 web 测试通过。

## 方案

Repository 经 `container_record.tenant_id` 定界（只读身份，不写货柜）。Cursor 增加租户形态，与按柜 cursor 互斥。前端无 `containerId` 查询时走租户页。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                 |
| ---------- | ------ | ---- | ------ | -------------------- |
| 2026-09-13 | coding | —    | —      | 开工：租户级任务列表 |
| 2026-09-13 | done   | —    | —      | 任务台一次按租户拉取 |
