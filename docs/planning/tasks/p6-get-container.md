---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/api test -- src/modules/shipment-registry 18 项通过；web containers + MicroWorkbench 6 项通过；web typecheck 通过；变更文件 eslint 通过；repo:check 通过；curl GET /api/containers/:id 本租户 200、跨租户/缺失 404 RESOURCE_NOT_FOUND；Playwright desktop-chromium「container record remains readable」通过。未执行：完整 pnpm validate。
---

# 任务：按 id 读取货柜摘要

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

`GET /api/containers/:id` 返回与列表项同形的 `ContainerSummary`。本租户可读；不存在或跨租户一律 `RESOURCE_NOT_FOUND`，不泄露他租户存在性。一柜一档改走该接口，不再扫列表。

## 权威入口

- [QUERY_PROJECTION_CONTRACT_V1](../../product/domain/QUERY_PROJECTION_CONTRACT_V1.md)（GC-010）
- [PUBLIC_ERROR_CONTRACT_V1](../../product/domain/PUBLIC_ERROR_CONTRACT_V1.md)
- [p6-list-containers-page](./p6-list-containers-page.md)

## 边界 / 不做

- 不返回轨道、时间线、费用、RACI、allowedActions 或完整 `ContainerOperationalViewV1`。
- 不新发规范事件，不改旧迁移，不更新像素基线。

## 验收

- [x] 同租户返回列表同形摘要。
- [x] 缺少租户 → `AUTHORIZATION_SCOPE_DENIED`；不存在/跨租户 → `RESOURCE_NOT_FOUND`。
- [x] `/container/:id` 用该接口；404 显示未找到，成功显示摘要并链到任务台。
- [x] `pnpm --filter @logix/api test -- src/modules/shipment-registry` 与 `pnpm --filter @logix/web test` 通过。

## 方案

Repository `findById({ tenantId, id })`；Application 做租户与空 id 裁决；Controller `GET :id`。前端 `getContainer`，一柜一档按路由 id 拉取。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                 |
| ---------- | ------ | ---- | ------ | -------------------- |
| 2026-09-13 | coding | —    | —      | 开工：GET 单柜摘要   |
| 2026-09-13 | done   | —    | —      | 一柜一档按 id 读摘要 |
