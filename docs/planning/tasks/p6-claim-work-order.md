---
status: review # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/claim-work-order
verification: |
  pnpm --filter @logix/api test -- src/modules/work-execution  # 60 passed
  pnpm --filter @logix/web test -- src/api/nodeTasks.test.ts src/data/claimReceiptContract.test.ts src/data/liveWorkspaceProjection.test.ts src/data/completeReceiptContract.test.ts src/data/clientOperationQueueContract.test.ts src/composables/useLiveWorkspace.test.ts src/views/RealTaskWorkbench.test.ts  # 34 passed
  pnpm --filter @logix/api typecheck
  pnpm --filter @logix/web typecheck
  pnpm db:generate && pnpm db:migrate  # 20260913210000_add_work_order_assignee applied
  POST /api/work-orders/:id/claim  # ready+unassigned → assigned+in_progress+assigneeId; 同键复用; 他人 409
---

# 任务：领取工单

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

现场操作者把 `ready` 且未分派（`unassigned` / `pool`）的工单领到自己名下：工单进入 `in_progress`、分派记为 `assigned` 并写下领取人。任务台只在可领时出现「领取」，不画空按钮。

## 权威入口

- [TASK_WORK_ORDER_CONTRACT_V1](../../product/domain/TASK_WORK_ORDER_CONTRACT_V1.md)（GC-005 §5.2 / §5.3）
- [SYNC_RELIABILITY_CONTRACT_V1](../../product/domain/SYNC_RELIABILITY_CONTRACT_V1.md)（GC-009）
- [QUERY_PROJECTION_CONTRACT_V1](../../product/domain/QUERY_PROJECTION_CONTRACT_V1.md)（GC-010）
- [UI_SYSTEM.md](../../product/UI_SYSTEM.md) UI-D09
- 样板：`complete-work-order.service.ts`

## 边界 / 不做

- 不改完成命令规则；不领取 `automatic`；不改派、不退领、不按团队领取。
- 不做正式 OIDC / 能力模型；仍用开发期 `X-Operator-Id`。
- 不执行补偿、不编风险/ETA、不补空领取按钮。
- 不改已入共享环境的旧迁移。

## 验收

- [x] `ready` + `unassigned`/`pool` 领取后 `assigned` + `in_progress`，记下 `assigneeId`。
- [x] 同一操作者重领同键同载荷复用回执；他人已领拒绝。
- [x] 任务台可领时只出「领取」；领完才出「完成工单」。
- [x] `pnpm --filter @logix/api test -- src/modules/work-execution` 与 `pnpm --filter @logix/web test` 相关文件通过。

## 方案

`POST /api/work-orders/:id/claim`。领域函数判定可领。持久化带条件更新防并发双领。ClientOperation `work_execution.claim_work_order`。工单增加 `assignee_id`。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit  | 说明                                           |
| ---------- | ------ | ---- | ------- | ---------------------------------------------- |
| 2026-09-13 | coding | —    | —       | 开工领取                                       |
| 2026-09-13 | coding | —    | —       | 命令+投影+任务台已接线，近端测试与本地领取通过 |
| 2026-09-13 | review | —    | d0761d9 | 实现已提交，进入评审；资源约束规划不在本刀     |
