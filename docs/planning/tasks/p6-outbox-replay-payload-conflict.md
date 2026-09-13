---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/api test -- src/modules/lifecycle-control 76 项通过；typecheck / lint / repo:check 通过；已 pnpm db:generate。未执行：完整 pnpm validate、迁移应用到本机库、对象存储、HTTP 冒烟、前端、正式授权。
---

# 任务：死信重放同键异载荷与修正载荷

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

重放命令写入 requestHash。同幂等键同哈希返回原结果；同键异哈希明确冲突。可选修正 `payloadRef`/`payloadHash` 仍生成新 eventId，`causationId` 指向原死信，不改原消息。

## 权威入口

- [SYNC_RELIABILITY_CONTRACT_V1](../../product/domain/SYNC_RELIABILITY_CONTRACT_V1.md) §3 / §8（GC-009）
- [p6-outbox-dead-letter-replay](./p6-outbox-dead-letter-replay.md)

## 边界 / 不做

- 不接收原始载荷正文，只接受受控引用与 sha256。
- 不做对象存储、告警、自动发布、正式授权。
- 不把原 dead_letter 改回 pending。

## 验收

- [x] 同键同哈希 `applied=false`；同键异哈希 `IDEMPOTENCY_CONFLICT`。
- [x] 同时提供合法 `payloadRef` + `payloadHash` 时，新行使用修正载荷，eventId 仍不同。
- [x] 只给其中一个、或 hash 非法 → `VALIDATION_FORMAT`。
- [x] `pnpm --filter @logix/api test -- src/modules/lifecycle-control` 与 `pnpm repo:check` 通过。

## 方案

requestHash 覆盖 reasonCode、targetConsumerVersion 与解析后的载荷引用。Repository 持久化 requestHash。先读原死信再比幂等。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                                  |
| ---------- | ------ | ---- | ------ | ------------------------------------- |
| 2026-09-13 | coding | —    | —      | 开工：同键异载荷与修正载荷            |
| 2026-09-13 | done   | —    | —      | 76 项单测通过；requestHash 与修正载荷 |
