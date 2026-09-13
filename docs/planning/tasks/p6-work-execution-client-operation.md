---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/api test -- src/modules/work-execution 7 文件 / 44 项通过；typecheck / lint / repo:check 通过。本机库 27 条迁移已齐。HTTP 冒烟：清关完成落 received/accepted/committed；同键重放 applied=false 且 clientOperationId 相同；装箱缺证据 422 并写拒绝。未执行：完整 pnpm validate。
---

# 任务：工单完成写入 ClientOperation

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

用户身份完成工单时，work-execution 写入自己的 ClientOperation：成功一次返回接收/裁决/提交三阶段；同键同哈希复用；同键异哈希冲突。业务拒绝保存 rejected，不标 committed。完成与成功回执同事务。

## 权威入口

- [TASK_WORK_ORDER_CONTRACT_V1](../../product/domain/TASK_WORK_ORDER_CONTRACT_V1.md) §13
- [SYNC_RELIABILITY_CONTRACT_V1](../../product/domain/SYNC_RELIABILITY_CONTRACT_V1.md) §2–§4（GC-009）
- [CONTEXT_MAP](../../product/domain/CONTEXT_MAP.md)（Work Execution 拥有 ClientOperation）
- [p6-inbox-consume-client-operation](./p6-inbox-consume-client-operation.md)

## 边界 / 不做

- 不改 `lifecycle.apply_event` 入口，不把工单动作接到 lifecycle-control 控制器。
- 不做任务台前端接线、补偿、OIDC、Kafka。
- 不改已入共享环境的旧迁移。
- 生命周期申请仍在工单提交之后，失败不回滚已完成工单。

## 验收

- [x] `POST /api/work-orders/:id/complete` 成功返回 `clientOperationId` 与 received/accepted/committed。
- [x] 同操作者同幂等键同哈希复用，不重复完成；同键异哈希 `IDEMPOTENCY_CONFLICT`。
- [x] 业务拒绝（非法状态、缺证据）写入 `businessDecisionState=rejected`，不标 committed。
- [x] 工单完成与成功 ClientOperation 同事务。
- [x] `pnpm --filter @logix/api test -- src/modules/work-execution` 与 `pnpm repo:check` 通过。

## 方案

`actionCode=work_execution.complete_work_order`。默认幂等键 `work-order:{id}:complete`。work-execution 自有仓储写同一 `client_operation` 表，不引用 lifecycle-control 内部实现。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                               |
| ---------- | ------ | ---- | ------ | ---------------------------------- |
| 2026-09-13 | coding | —    | —      | 开工：工单完成写入 ClientOperation |
| 2026-09-13 | done   | —    | —      | 完成响应带回执；同事务写入         |
