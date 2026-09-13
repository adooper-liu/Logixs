---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/api test -- src/modules/lifecycle-control 43 文件 / 216 项通过；相关 web 测试 8 项通过；api/web typecheck 通过；变更源文件 eslint 与 prettier 通过；repo:check 通过。HTTP：本租户 GET /api/containers/:id/lifecycle-nodes 200（MSKU1234567 返回已落库 cargo_ready + shipment_dispatch，按 sequence 1/3，无未落库站点）；跨租户/缺失货柜 404 RESOURCE_NOT_FOUND；无身份头 401（中间件先于用例）。Playwright desktop-chromium「container record remains readable」通过（本机该柜有节点，断言空流程或轨道）。未执行：完整 pnpm validate、像素基线更新。
---

# 任务：按货柜列已落库节点

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

`GET /api/containers/:containerId/lifecycle-nodes` 返回该柜已持久化的 `FlowInstance` + `NodeInstance`。本租户可读；货柜不存在或跨租户 → `RESOURCE_NOT_FOUND`。一柜一档只画这些节点，不补齐 14 站、不编造计划/预计时间。

## 权威入口

- [LIFECYCLE_NODE_CATALOG_V1](../../product/domain/LIFECYCLE_NODE_CATALOG_V1.md)（GC-001 顺序与代码）
- [QUERY_PROJECTION_CONTRACT_V1](../../product/domain/QUERY_PROJECTION_CONTRACT_V1.md) §2 / §4（`nodes` 来自 lifecycle-control，不得重推导）
- [p6-list-lifecycle-events](./p6-list-lifecycle-events.md)
- [WORKSPACE_UI_INVENTORY](../../product/WORKSPACE_UI_INVENTORY.md) §4.4 / §6.1

## 边界 / 不做

- 不调用 `ensureFlow`（GET 不得写库）。
- 不拼完整 `ContainerOperationalViewV1`，不返回 `plannedAt` / `estimatedAt` / `taskProgress` / `activationNo`。
- 不把目录里尚未落库的节点画成「待发生」。
- 不改旧迁移，不更新像素基线，不 commit。

## 验收

- [x] 同租户：无流程 → `flow: null` + `nodes: []`；有流程 → 仅实例行，按目录 `sequence` 升序。
- [x] 缺少租户 → `AUTHORIZATION_SCOPE_DENIED`；不存在/跨租户 → `RESOURCE_NOT_FOUND`。
- [x] `/container/:id` 有节点则展示轨道，无流程保持人话空态；不出现「待发生」占位时间。
- [x] `pnpm --filter @logix/api test -- src/modules/lifecycle-control` 与相关 web 测试通过。

## 方案

`findContainerBase` 断言租户后 `findFlowByContainer`；领域函数按 `NODE_SEQUENCE` 投影。前端独立 live 轨道，不复用会写「待发生」的演示 `LifecycleRail`。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                 |
| ---------- | ------ | ---- | ------ | -------------------- |
| 2026-09-13 | coding | —    | —      | 开工：列节点实例     |
| 2026-09-13 | done   | —    | —      | 一柜一档接已落库轨道 |
