---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/api test -- src/modules/lifecycle-control 90 项通过；typecheck / lint / repo:check 通过。未执行：完整 pnpm validate、本机 db:migrate、HTTP 冒烟、Temporal 调度。
---

# 任务：本租户到期 Outbox 排空

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

提供本租户到期排空命令：循环调用已有发布批次，领取到期的 `pending` / `retry_wait` / 过期租约，直到本轮无人可领或达到轮次上限。不在业务模块接入 Temporal。

## 权威入口

- [SYNC_RELIABILITY_CONTRACT_V1](../../product/domain/SYNC_RELIABILITY_CONTRACT_V1.md) §6 / §7（GC-009）
- [MODULE_DEPENDENCIES](../../architecture/MODULE_DEPENDENCIES.md) §2（非 workflow 模块不得引用 Temporal）
- [p6-outbox-publisher-first-slice](./p6-outbox-publisher-first-slice.md)
- [p6-outbox-retry-dead-letter](./p6-outbox-retry-dead-letter.md)

## 边界 / 不做

- 不做 Temporal 周期调度、跨租户排空、真实 broker、Inbox。
- 不在 Nest 进程里用 setInterval 冒充官方调度。
- 仍只领取 `owner_module=lifecycle-control` 且 `X-Tenant-Id` 匹配的行。

## 验收

- [x] `POST /api/outbox/publish-due`：循环发布，直到某轮 `claimed=0` 或达到 `maxRounds`。
- [x] `maxRounds` 默认 5、最大 20；`limit` 与发布批次相同（默认 50、最大 200）。
- [x] 身份与租户范围与 `publish-batch` 相同。
- [x] `pnpm --filter @logix/api test -- src/modules/lifecycle-control` 与 `pnpm repo:check` 通过。

## 方案

领域函数解析轮次并判断是否继续。Application 复用 `PublishOutboxBatchService`，只汇总计数。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                   |
| ---------- | ------ | ---- | ------ | ---------------------- |
| 2026-09-13 | coding | —    | —      | 开工：本租户到期排空   |
| 2026-09-13 | done   | —    | —      | 90 项单测通过；publish-due 循环排空 |
