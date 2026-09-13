---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/api test -- src/modules/lifecycle-control 39 文件 / 203 项通过；typecheck / lint / repo:check 通过。未执行：完整 pnpm validate；对运行中 API 的 HTTP 冒烟（nest watch 在本刀编译后 taskkill 失败退出，localhost:3000 已不可连）。
---

# 任务：按租户列 ClientOperation

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

`GET /api/client-operations` 按本租户游标分页列出三阶段操作。只读；不展示密钥。不做补偿执行。

## 权威入口

- [QUERY_PROJECTION_CONTRACT_V1](../../product/domain/QUERY_PROJECTION_CONTRACT_V1.md)（GC-010）
- [SYNC_RELIABILITY_CONTRACT_V1](../../product/domain/SYNC_RELIABILITY_CONTRACT_V1.md)
- [p6-list-compensations](./p6-list-compensations.md)

## 边界 / 不做

- 不做前端、OIDC、补偿执行器、按货柜过滤。
- 不改已入共享环境的旧迁移。

## 验收

- [x] 默认 50，最大 200；排序 `createdAt desc, id desc`。
- [x] cursor 绑定租户；损坏或不匹配直接失败，不退第一页。
- [x] 只返回 `X-Tenant-Id` 租户的行；缺身份 401（单测覆盖缺租户；HTTP 401 本刀未冒烟）。
- [x] `pnpm --filter @logix/api test -- src/modules/lifecycle-control` 与 `pnpm repo:check` 通过。

## 方案

复用 `client_operation_tenant_created_idx`。列表项比单条 GET 多 `createdAt` / `targetType` / `targetId`，便于定位后再读补偿。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                       |
| ---------- | ------ | ---- | ------ | -------------------------- |
| 2026-09-13 | coding | —    | —      | 开工：按租户列 ClientOperation |
| 2026-09-13 | done   | —    | —      | 列表已落地；HTTP 冒烟因 API 退出未跑 |
