---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/web test 38 文件 / 95 项通过；web typecheck 通过；变更文件 eslint 通过；repo:check 通过；Playwright desktop-chromium 覆盖 task-workflow / shell-layout / visual-layout（含货柜表打开行），演示内容断言已去掉。未执行：完整 pnpm validate、narrow/mobile 全量 E2E、像素基线更新。
---

# 任务：前端运行时全部改为真实 API

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

产品路径不再读取演示仓库。`/tasks`、`/containers`、`/dashboard`、`/meso`、`/container/:id` 只消费已有查询 API；没有投影的费用、产能、RACI、异常、轨道与时间线保持空态或「无投影」，不编造。

## 权威入口

- [QUERY_PROJECTION_CONTRACT_V1](../../product/domain/QUERY_PROJECTION_CONTRACT_V1.md)
- [TASK_WORK_ORDER_CONTRACT_V1](../../product/domain/TASK_WORK_ORDER_CONTRACT_V1.md)
- [UI_SYSTEM.md](../../product/UI_SYSTEM.md) UI-D02 / UI-D05
- [UX_CONTAINER_WORKBENCH](../../product/UX_CONTAINER_WORKBENCH.md) §5.4

## 边界 / 不做

- 不把 `sample.ts` / `useDemoOperationsStore` 的演示规则写成业务权威。
- 不新增费用、异常、RACI、生命周期轨道查询契约。
- 不改已入共享环境的旧迁移，不执行补偿，不更新像素基线。
- `useDemoOperationsStore` / `useTaskWorkflow` 仅保留给单测 fixture。

## 验收

- [x] 运行时去掉 `?demo=1`；默认页不再出现演示柜号、演示任务标题或演示费用占比。
- [x] `/dashboard`、`/meso` 货柜来自 `GET /containers`；费用/产能/RACI/异常为空。
- [x] `/container/:id` 按列表投影找柜；无轨道时空态并链到 `/tasks?containerId=`。
- [x] E2E 改为真实页语义断言，不依赖 `task_1026` / `MSKU-5521087`。
- [x] `pnpm --filter @logix/web test` 与变更文件 lint / typecheck 通过。

## 方案（design 阶段填写）

`useTaskWorkspace` 只走 `useLiveWorkspace`。Dashboard / Meso / 货柜表共用 `useLiveCatalog`。KPI helpText 改为真实来源说明。视觉像素基线不改；依赖演示内容的截图断言退出产品路径。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                     |
| ---------- | ------ | ---- | ------ | ------------------------ |
| 2026-09-13 | coding | —    | —      | 开工：运行时去掉演示仓库 |
| 2026-09-13 | done   | —    | —      | 产品路径只吃真实 API     |
