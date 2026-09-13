---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-12）：pnpm --filter @logix/api test -- src/modules/work-execution src/modules/lifecycle-control 35 项通过；typecheck / lint / repo:check 通过。HTTP：cargo_ready 激活装箱任务；幂等回放 stuffed/loaded 分别给出 shipment_dispatch 与 origin_departure 任务。本机 seed 货柜 003 已有更早冒烟事件，本次 stuffed/loaded 首次申请被时间单调拒绝，工单仍完成。未执行：完整 pnpm validate、干净库上的 8 态 shipped 冒烟、前端。
---

# 任务：出运任务完成后申请 loaded

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

把结果政策从装箱延伸到出运：`shipment_dispatch` 工单完成后申请 `loaded`。生命周期完成出运节点并激活下一节点 `origin_departure`。海关等专业事件仍不发。

## 权威入口

- [canonical-events.json](../../../packages/contracts/catalogs/v1/canonical-events.json)（`loaded.completionEligibleNodeCodes = [shipment_dispatch]`）
- [TASK_WORK_ORDER_CONTRACT_V1](../../product/domain/TASK_WORK_ORDER_CONTRACT_V1.md) §7

## 边界 / 不做

- 不开放 `departed` / 海关 / hold。
- 不改状态机守卫；8 态能否前进仍由 lifecycle 判定。
- 不做 Outbox、前端、booking-origin 专业模块。

## 验收

- [x] `shipment_dispatch` 完成申请 `loaded`；`customs_clearance` 仍为 none。
- [x] `loaded` 应用后激活 `origin_departure` 任务。
- [x] `pnpm --filter @logix/api test -- src/modules/work-execution src/modules/lifecycle-control` 与 `pnpm repo:check` 通过。

## 方案

在 `resultPolicyForNode` 增加 `shipment_dispatch → loaded`。激活链沿用已有 `nextLifecycleNode`。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                                 |
| ---------- | ------ | ---- | ------ | ------------------------------------ |
| 2026-09-12 | coding | —    | —      | 开工：出运申请 loaded                |
| 2026-09-12 | done   | —    | —      | 35 项单测通过；HTTP 激活链到离港任务 |
