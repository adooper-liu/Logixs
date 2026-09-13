---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-12）：pnpm --filter @logix/api test -- src/modules/work-execution src/modules/lifecycle-control 39 项通过；typecheck / lint / repo:check 通过。未执行：完整 pnpm validate、HTTP 冒烟、前端。
---

# 任务：工单完成响应带回激活任务

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

`POST /api/work-orders/:id/complete` 在申请规范事件成功或幂等回放后，把 lifecycle 已算出的 `activatedNodeCode` / `activatedNodeTaskId` 带回调用方。不再靠重放 lifecycle HTTP 猜测下一张任务。

## 权威入口

- [MODULE_DEPENDENCIES](../../architecture/MODULE_DEPENDENCIES.md)
- [TASK_WORK_ORDER_CONTRACT_V1](../../product/domain/TASK_WORK_ORDER_CONTRACT_V1.md)

## 边界 / 不做

- 不新发规范事件；不开放 `sailing` / `transit_arrived` / `arrived` / 海关。
- 不实现 `SetNodeApplicability`，不静默跳过 optional 节点（目录要求命令 + 权限 + 证据）。
- 不改激活算法；字段只透传公开端口已有结果。
- 申请跳过、拒绝或不适用时，激活字段为 null。
- 不做 Outbox、前端、按货柜列任务。

## 验收

- [x] 装箱完成且 lifecycle 返回激活任务时，complete 响应带出 `shipment_dispatch` 任务 id。
- [x] 清关完成、缺 containerId、lifecycle 拒绝时，激活字段为 null。
- [x] Domain / Controller 不引用 lifecycle 内部路径。
- [x] `pnpm --filter @logix/api test -- src/modules/work-execution src/modules/lifecycle-control` 与 `pnpm repo:check` 通过。

## 方案

扩大 complete 用例对 `ApplyLifecycleEvent` 返回值的读取，DTO 增加可空激活字段。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                             |
| ---------- | ------ | ---- | ------ | -------------------------------- |
| 2026-09-12 | coding | —    | —      | 开工：complete 带回激活任务      |
| 2026-09-12 | done   | —    | —      | 39 项单测通过；响应带激活任务 id |
