---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm db:generate 成功；pnpm --filter @logix/api test -- src/modules/lifecycle-control src/modules/identity 24 文件 / 109 项通过；typecheck / lint / repo:check 通过。未执行：完整 pnpm validate、本机 db:migrate、对照真实 HTTP 的 Inbox 冒烟。
---

# 任务：Inbox 接收第一刀

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

提供服务身份 Inbox 接收：按 `consumerName + messageId` 幂等入库，状态为 `received`。同键同哈希返回原记录；同键异哈希 `IDEMPOTENCY_CONFLICT`。本刀不处理业务、不领取、不接外部 broker。

## 权威入口

- [SYNC_RELIABILITY_CONTRACT_V1](../../product/domain/SYNC_RELIABILITY_CONTRACT_V1.md) §4 / §5（GC-009）
- [ADR 索引](../../architecture/decisions/README.md)（引入 Kafka 须新 ADR；架构初期延后 Kafka）
- `packages/contracts/schemas/v1/client-operation.schema.json` `InboxRecord`
- [p6-lifecycle-outbox-first-slice](./p6-lifecycle-outbox-first-slice.md)

## 边界 / 不做

- 不做 Kafka / Redis / 真实 broker、processing 租约、业务消费、Inbox 死信、ClientOperation。
- 不在 Nest 启动时自动消费 Outbox。
- 单体共用 `inbox_message` + `consumer_name`；本刀只接受 `lifecycle-control-inbox`。

## 验收

- [x] `POST /api/inbox/messages`：服务身份；首次写入 `received`。
- [x] 同消费者同 `messageId` 同 `payloadHash` 幂等返回，不插第二行。
- [x] 同键异哈希 `IDEMPOTENCY_CONFLICT`。
- [x] 用户租户头不能调用。
- [x] `pnpm --filter @logix/api test -- src/modules/lifecycle-control src/modules/identity` 与 `pnpm repo:check` 通过。

## 方案

领域函数校验消费者、messageId、哈希并裁决幂等。Repository 只按唯一键查找/插入。系统路由只挂服务身份中间件。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                               |
| ---------- | ------ | ---- | ------ | ---------------------------------- |
| 2026-09-13 | coding | —    | —      | 开工：Inbox 接收第一刀             |
| 2026-09-13 | done   | —    | —      | 服务身份接收；同键幂等；异哈希冲突 |
