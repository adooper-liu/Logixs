---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/api test -- src/modules/lifecycle-control 58 项通过；typecheck / lint / repo:check 通过；已 pnpm db:generate。未执行：完整 pnpm validate、迁移应用到本机库、真实 broker、人工重放、HTTP 冒烟、前端。
---

# 任务：Outbox 重试与死信第一刀

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

投递失败按版本化策略分类：暂时性技术失败进入 `retry_wait` 并写 `nextAttemptAt`；不可重试或次数/时限用尽进入 `dead_letter`，并保存失败分类与原消息受控引用。不改已落账的业务事实。

## 权威入口

- [SYNC_RELIABILITY_CONTRACT_V1](../../product/domain/SYNC_RELIABILITY_CONTRACT_V1.md) §7 / §8（GC-009）
- [p6-outbox-publisher-first-slice](./p6-outbox-publisher-first-slice.md)
- `packages/contracts/schemas/v1/client-operation.schema.json` `RetryPolicy` / `DeadLetterRecord`

## 边界 / 不做

- 不做人工重放、修正载荷新 ID、告警队列、Inbox、真实 broker。
- 本刀占位策略 `outbox_publish_first_slice` v1，抖动为 0，不把退避参数写入业务状态机。
- 丢失租约仍保持 `publishing`，不抢写他人持有的行。
- 不自动定时排空。

## 验收

- [x] 可重试失败 → `retry_wait` + `nextAttemptAt` + `lastErrorCode`。
- [x] 未知码 / 业务拒绝等不可重试，或达到最大次数/总时限 → `dead_letter`，含 `failureCategory` / `ownerQueue` / `deadLetteredAt`。
- [x] 已到 `nextAttemptAt` 的 `retry_wait` 可再次领取；未到期不可领。
- [x] `pnpm --filter @logix/api test -- src/modules/lifecycle-control` 与 `pnpm repo:check` 通过。

## 方案

领域函数分类错误并按策略裁决。Repository 仅更新仍由本人持有的 `publishing` 行并清租约。死信字段落在 `outbox_message`，不拆独立死信表。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                       |
| ---------- | ------ | ---- | ------ | -------------------------- |
| 2026-09-13 | coding | —    | —      | 开工：Outbox 重试与死信第一刀 |
| 2026-09-13 | done   | —    | —      | 58 项单测通过；retry_wait / dead_letter |
