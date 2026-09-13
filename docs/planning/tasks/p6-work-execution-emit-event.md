---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-12）：pnpm --filter @logix/api test -- src/modules/work-execution 24 项通过；lifecycle-control 4 项通过；typecheck / lint / repo:check 通过；迁移 20260912214500 已应用到 localhost:5433。HTTP 冒烟：container_stuffing + seed 货柜 003 → lifecycleApply=applied / stuffed，货柜 8 态仍为 not_shipped；customs_clearance → not_applicable。未执行：完整 pnpm validate、Outbox、booking-origin 专业模块、前端。
---

# 任务：work-execution 第二刀（结果政策发规范事件）

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

任务首次完成后，按结果政策决定是否向 `lifecycle-control` **公开端口**申请规范事件。工单/任务本地事务先提交；生命周期自己做守卫。work-execution 不写 `FlowInstance`。

## 权威入口

- [TASK_WORK_ORDER_CONTRACT_V1](../../product/domain/TASK_WORK_ORDER_CONTRACT_V1.md) §7 / §10
- [MODULE_DEPENDENCIES](../../architecture/MODULE_DEPENDENCIES.md)
- [canonical-events.json](../../../packages/contracts/catalogs/v1/canonical-events.json)

## 边界 / 不做

- 默认 `resultPolicy=none`。本刀只开放 `container_stuffing → stuffed`（catalog 中 `completionEligibleNodeCodes` 仅为该节点，且不推进货柜 8 态）。
- 海关/放行/hold 等专业事件禁止由工单按钮发出。
- 不直写 lifecycle 表，不引入分布式事务；lifecycle 拒绝不回滚已完成工单。
- 不做 Outbox、booking-origin 专业模块、前端。

## 验收

- [x] `container_stuffing` 完成且有 `containerId` 时调用 lifecycle 公开端口，事件码 `stuffed`，幂等键绑定任务。
- [x] 其他节点（如 `customs_clearance`）不调用 lifecycle。
- [x] 缺 `containerId` 或端口拒绝时，工单/任务/结果快照仍已提交。
- [x] 完成重放再次申请时走 lifecycle 幂等，不重复完成工单。
- [x] Domain / Controller 不引用 lifecycle 内部路径。
- [x] `pnpm --filter @logix/api test -- src/modules/work-execution` 与 `pnpm repo:check` 通过。

## 方案

- 导出 `APPLY_LIFECYCLE_EVENT` 为 lifecycle 公开端口。
- `NodeTask` 增加逻辑 `containerId`（无跨模块外键）。
- Application 在本地提交后调用端口；Controller 只转结果。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                                            |
| ---------- | ------ | ---- | ------ | ----------------------------------------------- |
| 2026-09-12 | coding | —    | —      | 开工：结果政策发事件                            |
| 2026-09-12 | done   | —    | —      | 24 项单测 + HTTP 冒烟：stuffed 已申请、8 态未变 |
