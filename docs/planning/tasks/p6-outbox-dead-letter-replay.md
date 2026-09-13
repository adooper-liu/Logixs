---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/api test -- src/modules/lifecycle-control 71 项通过；typecheck / lint / repo:check 通过；已 pnpm db:generate。未执行：完整 pnpm validate、迁移应用到本机库、同键异载荷、修正载荷、HTTP 冒烟、前端、正式授权。
---

# 任务：Outbox 死信人工重放第一刀

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

对 `dead_letter` 做授权人工重放：不改原消息、不用原 messageId。新 Outbox 行以新 eventId 进入 `pending`，`causationId` 指向原死信，并留下 ReplayRequest。

## 权威入口

- [SYNC_RELIABILITY_CONTRACT_V1](../../product/domain/SYNC_RELIABILITY_CONTRACT_V1.md) §8（GC-009）
- [p6-outbox-retry-dead-letter](./p6-outbox-retry-dead-letter.md)
- `packages/contracts/schemas/v1/client-operation.schema.json` `ReplayRequest`

## 边界 / 不做

- 不做修正载荷、新 payloadHash、告警、Inbox、真实 broker、自动发布。
- 同键返回原重放结果；同键异载荷冲突下一刀。
- 权限本刀仍用开发期 `X-Operator-Id`，正式授权模型下一刀。
- 不把原 dead_letter 改回 pending。

## 验收

- [x] `POST /api/outbox/dead-letters/:id/replay`：新 pending 行，eventId 不同，causationId=原 eventId。
- [x] 原死信行状态与载荷不变。
- [x] 非 dead_letter → `BUSINESS_STATE_VIOLATION`；跨租户拒绝；同幂等键返回原结果。
- [x] `pnpm --filter @logix/api test -- src/modules/lifecycle-control` 与 `pnpm repo:check` 通过。

## 方案

领域函数校验状态并构造新 pending 行。Repository 同事务插入 replay 记录与新 Outbox。`requestedBy` 取 `X-Operator-Id`。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                         |
| ---------- | ------ | ---- | ------ | ---------------------------- |
| 2026-09-13 | coding | —    | —      | 开工：死信人工重放第一刀     |
| 2026-09-13 | done   | —    | —      | 71 项单测通过；新 eventId + causationId |
