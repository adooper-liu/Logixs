---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/api test -- src/modules/lifecycle-control 41 文件 / 210 项通过；相关 web 测试 6 项通过；web typecheck 通过；变更文件 eslint 通过；repo:check 通过；prisma migrate deploy 已应用 20260913143000_add_canonical_event_list_index。HTTP：本租户空页 200（pageSize=50）；跨租户/缺失货柜 404 RESOURCE_NOT_FOUND。Playwright desktop-chromium「container record remains readable」通过。未执行：完整 pnpm validate、有真实事件行的非空列表与翻页。
---

# 任务：按货柜列规范事件

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

`GET /api/containers/:containerId/lifecycle-events` 游标分页返回该柜已落账 `CanonicalEvent`。本租户可读；货柜不存在或跨租户 → `RESOURCE_NOT_FOUND`。一柜一档只展示这些实际事件，不编造计划/预计/轨道。

## 权威入口

- [QUERY_PROJECTION_CONTRACT_V1](../../product/domain/QUERY_PROJECTION_CONTRACT_V1.md) §5 / §9
- [EVENT_CODES](../../product/domain/EVENT_CODES.md)
- [p6-get-container](./p6-get-container.md)

## 边界 / 不做

- 不返回 `idempotencyKey`，不拼 `ContainerOperationalViewV1`，不推导节点轨道。
- 不编造 planned/estimated；无 `eventSequence` 时稳定尾键用 `id`。
- 不改已入共享环境的旧迁移。

## 验收

- [x] 货柜同租户可列；默认 50，最大 200；排序 `occurredAt desc, id desc`。
- [x] cursor 绑定 `tenantId` + `containerId`；损坏或不匹配直接失败。
- [x] 列表项不含幂等键。
- [x] `/container/:id` 有事件则展示时间轴，无事件保持空态。
- [x] `pnpm --filter @logix/api test -- src/modules/lifecycle-control` 与相关 web 测试通过。

## 方案

先用 `findContainerBase` 断言租户，再按柜列事件。为 `(container_id, occurred_at, id)` 补索引。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                 |
| ---------- | ------ | ---- | ------ | -------------------- |
| 2026-09-13 | coding | —    | —      | 开工：列规范事件     |
| 2026-09-13 | done   | —    | —      | 一柜一档接事件时间轴 |
