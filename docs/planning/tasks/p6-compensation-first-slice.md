---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm db:generate 成功；migrate deploy 已应用 20260913130000_add_compensation_record；pnpm --filter @logix/api test -- src/modules/lifecycle-control 32 文件 / 169 项通过；typecheck / lint / repo:check 通过。HTTP 冒烟：不存在的原操作 404；空 reasonCode 400 VALIDATION_FORMAT。未执行：完整 pnpm validate、对真实已落账 apply_event 的成功登记、推进 compensated。
---

# 任务：补偿记录第一刀

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

对已落账的 `ClientOperation` 登记一条补偿事实：`pending`，新 `compensationId`。原操作状态与历史不改。没有补偿语义的动作明确拒绝。本刀不执行反向事件。

## 权威入口

- [SYNC_RELIABILITY_CONTRACT_V1](../../product/domain/SYNC_RELIABILITY_CONTRACT_V1.md) §9（GC-009）
- [CompensationRecord](../../../packages/contracts/schemas/v1/client-operation.schema.json)
- [p6-inbox-replay-payload-conflict](./p6-inbox-replay-payload-conflict.md)（明确推迟补偿）

## 边界 / 不做

- 不执行反向生命周期事件、不回滚、不删除历史。
- 不推进 `in_progress` / `compensated` / `failed` / `manual_review`（下一刀）。
- 不给 `work_execution.complete_work_order` 编造补偿（已发生物理事实）。
- 不做对象存储、Kafka、OIDC、前端操作台。
- 不改已入共享环境的旧迁移。

## 验收

- [x] 第一刀目录：`lifecycle.apply_event` → `lifecycle.compensate_apply_event`；其它动作拒绝。
- [x] 仅 `commitState=committed` 可登记；跨租户拒绝；原操作不被更新。
- [x] `POST /api/client-operations/:id/compensations`：同键同哈希复用，同键异哈希冲突。
- [x] `pnpm --filter @logix/api test -- src/modules/lifecycle-control` 与 `pnpm repo:check` 通过。

## 方案

Domain 保存目录与状态决策。新表 `compensation_record`。Repository 只持久化。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明             |
| ---------- | ------ | ---- | ------ | ---------------- |
| 2026-09-13 | coding | —    | —      | 开工：补偿第一刀 |
| 2026-09-13 | done   | —    | —      | pending 登记；不执行反向事件 |
