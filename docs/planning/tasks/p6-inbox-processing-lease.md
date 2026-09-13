---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm db:generate 成功；pnpm --filter @logix/api test -- src/modules/lifecycle-control src/modules/identity 26 文件 / 118 项通过；typecheck / lint / repo:check 通过。未执行：完整 pnpm validate、本机 db:migrate、SKIP LOCKED 集成测试、对照真实 HTTP 的 Inbox 冒烟。
---

# 任务：Inbox processing 租约第一刀

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

服务身份按租户领取 `received`（及租约过期的 `processing`）Inbox，写入可过期租约并标为 `processing`。活跃租约不可被他人领取；过期租约可接管。本刀不处理业务、不标 `processed`、不进死信。

## 权威入口

- [SYNC_RELIABILITY_CONTRACT_V1](../../product/domain/SYNC_RELIABILITY_CONTRACT_V1.md) §5（GC-009）
- `packages/contracts/schemas/v1/client-operation.schema.json` `InboxRecord` / `ProcessingLease`
- [p6-inbox-first-slice](./p6-inbox-first-slice.md)
- [p6-outbox-publisher-first-slice](./p6-outbox-publisher-first-slice.md)

## 边界 / 不做

- 不做 Kafka / 真实 broker、业务消费、Inbox 死信、retry_wait、ClientOperation。
- 不在 Nest 启动时自动领取或消费。
- 本刀只领取 `consumer_name=lifecycle-control-inbox` 且请求体 `tenantId` 匹配的行。
- 用户租户头不能调用。

## 验收

- [x] `POST /api/inbox/claim-batch`：服务身份；领取后 `processing` 且有 `owner` / `lockedAt` / `expiresAt`。
- [x] 活跃租约不可被他人领取；过期租约可被接管。
- [x] `processed` / `dead_letter` 不再领取。
- [x] 用户身份拒绝。
- [x] `pnpm --filter @logix/api test -- src/modules/lifecycle-control src/modules/identity` 与 `pnpm repo:check` 通过。

## 方案

领域函数判定可领取与 `processing` 租约。Repository 用 `FOR UPDATE SKIP LOCKED` 原子领取。租约 owner 取服务 `actorId`。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                       |
| ---------- | ------ | ---- | ------ | -------------------------- |
| 2026-09-13 | coding | —    | —      | 开工：Inbox processing 租约 |
| 2026-09-13 | done   | —    | —      | 领取 received/过期租约；用户身份拒绝 |
