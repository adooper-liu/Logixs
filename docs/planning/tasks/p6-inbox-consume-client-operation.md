---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm db:generate 成功；pnpm --filter @logix/api test -- src/modules/lifecycle-control src/modules/identity 30 文件 / 136 项通过；typecheck / lint / repo:check 通过。未执行：完整 pnpm validate、本机 db:migrate、SKIP LOCKED 集成测试、对照真实 HTTP 的冒烟。
---

# 任务：Inbox 消费 / 死信 与 ClientOperation 三阶段

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

同一申请生命周期事件命令走两条入口：用户身份 `ClientOperation` 一次返回接收/裁决/提交三阶段；服务身份 Inbox 消费同一载荷，业务更新、`processed` 与本地 Outbox 同事务。Inbox 暂时失败 `retry_wait`，不可重试或用尽则 `dead_letter`。

## 权威入口

- [SYNC_RELIABILITY_CONTRACT_V1](../../product/domain/SYNC_RELIABILITY_CONTRACT_V1.md) §2–§8（GC-009）
- [PUBLIC_ERROR_CONTRACT_V1](../../product/domain/PUBLIC_ERROR_CONTRACT_V1.md) §6
- [p6-inbox-process-first-slice](./p6-inbox-process-first-slice.md)
- [p6-outbox-retry-dead-letter](./p6-outbox-retry-dead-letter.md)

## 边界 / 不做

- 不做 Kafka / 真实 broker、Inbox 死信列表/重放 UI、补偿、OIDC。
- 不改已入共享环境的旧迁移。
- 本刀 `actionCode` 仅 `lifecycle.apply_event`。工单动作仍归 work-execution，后续再接。
- 节点完成与货柜 8 态仍按现有 apply 顺序；同事务保证覆盖规范事件 + Outbox + Inbox `processed`。

## 验收

- [x] `POST /api/client-operations`：成功一次返回 received/accepted/committed；同键同哈希复用；同键异哈希 `IDEMPOTENCY_CONFLICT`。
- [x] 业务拒绝保存 `businessDecisionState=rejected`，不标 committed。
- [x] Inbox 接收带载荷；`process-batch` 调用同一申请事件；成功则 event+Outbox+processed 同事务。
- [x] Inbox 可重试失败 `retry_wait`；不可重试/用尽 `dead_letter`。
- [x] `pnpm --filter @logix/api test -- src/modules/lifecycle-control src/modules/identity` 与 `pnpm repo:check` 通过。

## 方案

ClientOperation 持久化三阶段。Inbox 存 `payload_json`，哈希与 Outbox 规范化一致。消费复用 `ApplyLifecycleEvent`，`saveEvent` 可选同事务标 Inbox processed。失败复用已有失败分类，责任队列 `lifecycle-control-inbox`。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                                    |
| ---------- | ------ | ---- | ------ | --------------------------------------- |
| 2026-09-13 | coding | —    | —      | 开工：Inbox 消费/死信 + ClientOperation |
| 2026-09-13 | done   | —    | —      | 三阶段 + 同事务消费 + Inbox 重试/死信   |
