---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-12）：pnpm --filter @logix/api test -- src/modules/work-execution src/modules/lifecycle-control 39 项通过；typecheck / lint / repo:check 通过。未执行：完整 pnpm validate、HTTP 冒烟、前端。
---

# 任务：离港任务完成后申请 departed

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

把结果政策从出运延伸到离港：`origin_departure` 工单完成后申请 `departed`。生命周期完成离港节点并激活下一节点 `ocean_transit`。海关等专业事件仍不发。

## 权威入口

- [canonical-events.json](../../../packages/contracts/catalogs/v1/canonical-events.json)（`departed.completionEligibleNodeCodes = [origin_departure]`）
- [TASK_WORK_ORDER_CONTRACT_V1](../../product/domain/TASK_WORK_ORDER_CONTRACT_V1.md) §7
- [MODULE_DEPENDENCIES](../../architecture/MODULE_DEPENDENCIES.md)

## 边界 / 不做

- 不开放 `sailing` / 海关 / hold。`ocean_transit` 任务本刀仍为 `resultPolicy=none`。
- 不新建 `ocean-port-visibility` 专业模块；本刀只把 catalog 已声明的完成事件经 lifecycle 公开端口申请。
- 不改状态机守卫；8 态能否前进仍由 lifecycle 判定（`departed` 映射为 `shipped`，已 shipped 时不回退）。
- 不做 Outbox、前端、可选节点跳过。

## 验收

- [x] `origin_departure` 完成申请 `departed`；`customs_clearance` 仍为 none。
- [x] `departed` 应用后激活 `ocean_transit` 任务。
- [x] `pnpm --filter @logix/api test -- src/modules/work-execution src/modules/lifecycle-control` 与 `pnpm repo:check` 通过。

## 方案

在 `resultPolicyForNode` 增加 `origin_departure → departed`。激活链沿用已有 `nextLifecycleNode`。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                            |
| ---------- | ------ | ---- | ------ | ------------------------------- |
| 2026-09-12 | coding | —    | —      | 开工：离港申请 departed         |
| 2026-09-12 | done   | —    | —      | 39 项单测通过；激活海运在途任务 |
