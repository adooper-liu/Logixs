---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/api test -- src/modules/lifecycle-control 50 项通过；typecheck / lint / repo:check 通过；已 pnpm db:generate。未执行：完整 pnpm validate、迁移应用到本机库、SKIP LOCKED 集成测试、真实 broker、HTTP 冒烟、前端。
---

# 任务：Outbox 发布器第一刀

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

领取本租户 `pending`（及租约过期的 `publishing`）Outbox，用可过期租约标为 `publishing`，经占位投递后写入 `published` 与 broker reference。不在业务事务里先发后提交。

## 权威入口

- [SYNC_RELIABILITY_CONTRACT_V1](../../product/domain/SYNC_RELIABILITY_CONTRACT_V1.md) §6 / §7（GC-009）
- [p6-lifecycle-outbox-first-slice](./p6-lifecycle-outbox-first-slice.md)
- `packages/contracts/schemas/v1/client-operation.schema.json` `OutboxRecord` / `ProcessingLease`

## 边界 / 不做

- 不做真实 broker、Inbox、ClientOperation、死信、人工重放、版本化重试策略。
- 投递失败不改业务事实，只留下可过期 `publishing` 供接管。
- 不在 `ApplyLifecycleEvent` 提交后自动排空。
- 本刀只领取 `owner_module=lifecycle-control` 且 `X-Tenant-Id` 匹配的行。

## 验收

- [x] `POST /api/outbox/publish-batch`：领取后占位投递，成功则 `published` 且有 `brokerReference` / `publishedAt`。
- [x] 活跃租约不可被他人领取；过期租约可被接管。
- [x] 已 published 不再领取；投递失败不标 published。
- [x] `pnpm --filter @logix/api test -- src/modules/lifecycle-control` 与 `pnpm repo:check` 通过。

## 方案

领域函数判定可领取与 `publishing`/`published` 转换。Repository 用 `FOR UPDATE SKIP LOCKED` 原子领取。占位投递返回 `stub:{eventId}`。租约 owner 取 `X-Operator-Id`。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                     |
| ---------- | ------ | ---- | ------ | ------------------------ |
| 2026-09-13 | coding | —    | —      | 开工：Outbox 发布器第一刀 |
| 2026-09-13 | done   | —    | —      | 50 项单测通过；占位投递与租约领取 |
