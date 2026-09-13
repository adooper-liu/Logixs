---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/api test -- src/modules/lifecycle-control 33 文件 / 181 项通过；typecheck / lint / repo:check 通过。HTTP 冒烟：不存在补偿 404；state=not_required 400 VALIDATION_FORMAT。未执行：完整 pnpm validate、真实 pending→compensated 成功路径。
---

# 任务：补偿状态推进

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

已登记的补偿可推进：`pending → in_progress | compensated | failed | manual_review`；`in_progress` 到终态；`failed → manual_review`。原 `ClientOperation` 不改。本刀仍不执行反向事件。

## 权威入口

- [SYNC_RELIABILITY_CONTRACT_V1](../../product/domain/SYNC_RELIABILITY_CONTRACT_V1.md) §9
- [p6-compensation-first-slice](./p6-compensation-first-slice.md)

## 边界 / 不做

- 不回滚、不删除历史、不发反向生命周期事件。
- 不做对象存储、Kafka、OIDC、前端。
- 不改已入共享环境的旧迁移。

## 验收

- [x] 合法转换成功；同态重放 `applied=false`；非法转换 `BUSINESS_STATE_VIOLATION`。
- [x] `compensated` / `manual_review` 为终态；补偿失败可进人工复核。
- [x] 跨租户或路径上的原操作 id 不匹配拒绝；原操作不被更新。
- [x] `pnpm --filter @logix/api test -- src/modules/lifecycle-control` 与 `pnpm repo:check` 通过。

## 方案

Domain 保存转换表。`POST .../compensations/:compensationId/resolve`。Repository 只更新补偿行。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明               |
| ---------- | ------ | ---- | ------ | ------------------ |
| 2026-09-13 | coding | —    | —      | 开工：补偿状态推进 |
| 2026-09-13 | done   | —    | —      | resolve 推进终态   |
