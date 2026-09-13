---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/api test -- src/modules/lifecycle-control 37 项通过；typecheck / lint / repo:check 通过；已 pnpm db:generate。未执行：完整 pnpm validate、迁移应用到本机库、真实库事务回滚集成测试、发布器、HTTP 冒烟、前端。
---

# 任务：生命周期事件 Outbox 第一刀

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

规范事件落账与 Outbox `pending` 在同一本地事务插入。本刀只做生产者侧原子写入，不发布、不消费。

## 权威入口

- [SYNC_RELIABILITY_CONTRACT_V1](../../product/domain/SYNC_RELIABILITY_CONTRACT_V1.md) §6 / §12（GC-009）
- [MODULE_DEPENDENCIES](../../architecture/MODULE_DEPENDENCIES.md) §2（跨事务经 Transactional Outbox）
- [CUSTOMS_DATABASE_MIGRATION_DESIGN_V1](../../product/domain/CUSTOMS_DATABASE_MIGRATION_DESIGN_V1.md) §5.2（物理形态参考）
- `packages/contracts/schemas/v1/client-operation.schema.json` `OutboxRecord`

## 边界 / 不做

- 不做发布器、broker、租约领取、重试策略、死信、Inbox、ClientOperation。
- 不做证据裁决、适用性决策、工单完成的 Outbox 行。
- 不把节点完成、货柜 8 态推进与事件写入收成一个大事务。
- 不接 HTTP 追踪头；本刀自生成 `traceId`。
- `payloadRef` 使用受控引用 `canonical-event/{eventId}`，不做对象存储。
- 单体共用 `outbox_message` + `owner_module`，不按模块拆物理表。

## 验收

- [x] 首次应用规范事件时，同事务插入 `canonical_event` 与 `state=pending` 的 Outbox。
- [x] `outbox_message.id` / `event_id` 等于该规范事件 id。
- [x] 幂等命中不插入第二条 Outbox。
- [x] `pnpm --filter @logix/api test -- src/modules/lifecycle-control` 与 `pnpm repo:check` 通过。

## 方案

领域函数构造 pending 行与 payload 哈希。`saveEvent` 用 Prisma 事务先写事件再写 Outbox。唯一键 `(tenant_id, owner_module, event_type, idempotency_key)`。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                               |
| ---------- | ------ | ---- | ------ | ---------------------------------- |
| 2026-09-13 | coding | —    | —      | 开工：生命周期事件 Outbox 第一刀   |
| 2026-09-13 | done   | —    | —      | 37 项单测通过；事件与 pending 同行 |
