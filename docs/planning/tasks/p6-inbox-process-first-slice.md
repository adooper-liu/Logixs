---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm db:generate 成功；pnpm --filter @logix/api test -- src/modules/lifecycle-control src/modules/identity 27 文件 / 125 项通过；typecheck / lint / repo:check 通过。未执行：完整 pnpm validate、本机 db:migrate、SKIP LOCKED 集成测试、对照真实 HTTP 的 Inbox 冒烟。
---

# 任务：Inbox 占位消费第一刀

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

服务身份按租户领取 Inbox 后做占位消费，成功则在持有租约时标 `processed` 并写入 `processedAt`。消费失败不标完成，保留可过期 `processing` 供接管。本刀不写业务事实、不写 Outbox、不进死信。

## 权威入口

- [SYNC_RELIABILITY_CONTRACT_V1](../../product/domain/SYNC_RELIABILITY_CONTRACT_V1.md) §5（GC-009：业务更新、Inbox processed 与本地 Outbox 同事务；本刀无业务/无 Outbox，只提交 processed）
- `packages/contracts/schemas/v1/client-operation.schema.json` `InboxRecord`
- [p6-inbox-processing-lease](./p6-inbox-processing-lease.md)
- [p6-outbox-publisher-first-slice](./p6-outbox-publisher-first-slice.md)

## 边界 / 不做

- 不做 Kafka / 真实 broker、真实业务消费、Inbox 死信、retry_wait、ClientOperation。
- 不在 Nest 启动时自动领取或消费。
- 本刀只处理 `consumer_name=lifecycle-control-inbox` 且请求体 `tenantId` 匹配的行。
- 用户租户头不能调用。

## 验收

- [x] `POST /api/inbox/process-batch`：服务身份；占位消费成功则 `processed` 且有 `processedAt`。
- [x] 仅本人持有的 `processing` 租约可标完成；丢失租约且尚未 processed 则不改状态。
- [x] 消费失败不标 `processed`，保留 `processing`。
- [x] 用户身份拒绝。
- [x] `pnpm --filter @logix/api test -- src/modules/lifecycle-control src/modules/identity` 与 `pnpm repo:check` 通过。

## 方案

复用已有 `claimBatch`。领域函数裁决 `processed`。Repository 按 `id + processing + leaseOwner` 更新。占位消费不产生业务事件。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                               |
| ---------- | ------ | ---- | ------ | ---------------------------------- |
| 2026-09-13 | coding | —    | —      | 开工：Inbox 占位消费第一刀         |
| 2026-09-13 | done   | —    | —      | 占位消费标 processed；失败保留租约 |
