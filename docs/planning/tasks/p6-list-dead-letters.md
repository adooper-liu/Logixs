---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/api test -- src/modules/lifecycle-control 85 项通过；typecheck / lint / repo:check 通过；已 pnpm db:generate。未执行：完整 pnpm validate、迁移应用到本机库、HTTP 冒烟、前端翻页、cursor 过期。
---

# 任务：按租户列死信

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

`GET /api/outbox/dead-letters` 按当前租户列出 `dead_letter`，GC-010 游标分页。只返回受控引用与失败摘要，不返回原始载荷或凭据。

## 权威入口

- [QUERY_PROJECTION_CONTRACT_V1](../../product/domain/QUERY_PROJECTION_CONTRACT_V1.md) §9（GC-010）
- [SYNC_RELIABILITY_CONTRACT_V1](../../product/domain/SYNC_RELIABILITY_CONTRACT_V1.md) §8（GC-009：死信界面不得展示凭据或不必要个人信息）
- [p6-outbox-dead-letter-replay](./p6-outbox-dead-letter-replay.md)

## 边界 / 不做

- 不实现 cursor 过期、正式授权、告警、自动发布、前端翻页。
- 本刀只列 `owner_module=lifecycle-control`。
- 不返回 payload 正文。

## 验收

- [x] 返回 `items` / `pageInfo` / `asOf` / `projectionVersion`；默认 `pageSize=50`，最大 200。
- [x] 排序 `deadLetteredAt desc, id desc`；非法或跨租户 cursor 拒绝，不退回第一页。
- [x] 只含本租户 `dead_letter`。
- [x] `pnpm --filter @logix/api test -- src/modules/lifecycle-control` 与 `pnpm repo:check` 通过。

## 方案

Application 解析分页；Repository 按租户 + 状态 + 游标查询。cursor 绑定 tenantId。补列表索引。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明             |
| ---------- | ------ | ---- | ------ | ---------------- |
| 2026-09-13 | coding | —    | —      | 开工：按租户列死信 |
| 2026-09-13 | done   | —    | —      | 85 项单测通过；死信游标列表 |
