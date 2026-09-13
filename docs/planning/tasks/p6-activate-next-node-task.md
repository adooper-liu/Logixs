---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-12）：pnpm --filter @logix/api test -- src/modules/lifecycle-control src/modules/work-execution 32 项通过；typecheck / lint / repo:check 通过。HTTP 冒烟：cargo_ready 于 seed 货柜 002 → activatedNodeCode=container_stuffing、任务 pending + 1 张工单；sailing 不建单。未执行：完整 pnpm validate、可选节点跳过、Outbox、前端。
---

# 任务：节点进入后激活下一道工单

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

规范事件完成节点后，由 `lifecycle-control` 经 `work-execution` **公开端口**为下一主链节点幂等创建 `NodeTask`。这是 MODULE_DEPENDENCIES 的反向触发，不是工单回头写流程。

## 权威入口

- [MODULE_DEPENDENCIES](../../architecture/MODULE_DEPENDENCIES.md)
- [TASK_WORK_ORDER_CONTRACT_V1](../../product/domain/TASK_WORK_ORDER_CONTRACT_V1.md)
- [LIFECYCLE_NODE_CATALOG](../../product/domain/LIFECYCLE_NODE_CATALOG_V1.md)

## 边界 / 不做

- 只激活「最远已完成节点」的下一序号节点；不完成的事件（如 `sailing`）不建单。
- 建单失败不回滚已应用事件。
- 不在激活时申请规范事件（避免 complete → apply → create → apply 环）。
- 不做可选节点跳过策略、Outbox、前端。

## 验收

- [x] `stuffed` 完成后创建 `shipment_dispatch` 任务（幂等）。
- [x] `sailing` 不创建任务。
- [x] 建单端口失败时事件仍已应用。
- [x] 模块循环仅用公开端口 + `forwardRef`；Domain/Controller 不互引内部路径。
- [x] `pnpm --filter @logix/api test -- src/modules/lifecycle-control src/modules/work-execution` 与 `pnpm repo:check` 通过。

## 方案

- `LifecycleRepository.ensureNode` 补下一节点实例。
- 导出 `CREATE_NODE_TASK` 端口；`ApplyLifecycleEventService` 在本地提交后调用。
- 跨模块端口用 `Symbol.for`，避免 barrel 循环把 token 变成 undefined。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                                       |
| ---------- | ------ | ---- | ------ | ------------------------------------------ |
| 2026-09-12 | coding | —    | —      | 开工：反向激活                             |
| 2026-09-12 | done   | —    | —      | 32 项单测 + HTTP：cargo_ready 激活装箱任务 |
