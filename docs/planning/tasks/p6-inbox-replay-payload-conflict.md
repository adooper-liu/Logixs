---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/api test -- src/modules/lifecycle-control 30 文件 / 155 项通过；API typecheck / lint 通过；pnpm --filter @logix/web test 30 文件 / 79 项通过；web typecheck、repo:check 通过。HTTP 冒烟：只给 payloadRef → 400 VALIDATION_FORMAT；不存在死信 → 404 RESOURCE_NOT_FOUND。未执行：完整 pnpm validate、有真实修正源行的端到端重放、对象存储。
---

# 任务：Inbox 死信重放修正载荷

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

Inbox 人工重放可带受控 `payloadRef` + `payloadHash`。修正后仍生成新 messageId，`causationId` 指向原死信，不改原消息。载荷按 `inbox/{id}` 引用读取，不接收正文。

## 权威入口

- [SYNC_RELIABILITY_CONTRACT_V1](../../product/domain/SYNC_RELIABILITY_CONTRACT_V1.md) §3 / §8（GC-009）
- [p6-outbox-replay-payload-conflict](./p6-outbox-replay-payload-conflict.md)
- [p6-inbox-dead-letter-replay](./p6-inbox-dead-letter-replay.md)

## 边界 / 不做

- 不接收原始载荷正文，不展示凭据。
- 不做对象存储、补偿、Kafka、OIDC、独立 Inbox 操作台。
- 不把原 dead_letter 改回 received。
- 不改已入共享环境的旧迁移。

## 验收

- [x] 同键同哈希 `applied=false`；同键异哈希 `IDEMPOTENCY_CONFLICT`（保持）。
- [x] 同时提供合法 `payloadRef` + `payloadHash` 且引用同租户、同消费者 Inbox 时，新行使用该引用的 JSON 与哈希，messageId 仍不同。
- [x] 只给其中一个、hash 非法、引用不是 `inbox/{id}`、引用不存在或哈希不一致 → `VALIDATION_FORMAT` / `RESOURCE_NOT_FOUND`。
- [x] 死信页仍不提交载荷正文。
- [x] `pnpm --filter @logix/api test -- src/modules/lifecycle-control`、`pnpm --filter @logix/web test` 与 `pnpm repo:check` 通过。

## 方案

复用 Outbox 的 `assertReplayCommand` / `hashReplayRequest`。Inbox 特有：解析 `inbox/{id}`，拷贝源行 `payloadJson`。响应增加 `corrected`。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                   |
| ---------- | ------ | ---- | ------ | ---------------------- |
| 2026-09-13 | coding | —    | —      | 开工：Inbox 修正载荷   |
| 2026-09-13 | done   | —    | —      | 按 inbox/{id} 引用修正 |
