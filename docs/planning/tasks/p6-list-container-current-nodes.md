---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：lifecycle-control 45 文件 / 220 项通过；相关 web 14 项通过；api/web typecheck 通过；变更文件 eslint/prettier 通过；repo:check 通过。HTTP：本租户 GET /api/lifecycle-current-nodes?containerIds=… 200（MSKU 柜返回 shipment_dispatch / cargo_ready）；他租户同 ID 200 空页。Playwright desktop-chromium「container-list remains readable」通过。未执行：完整 pnpm validate、像素基线。
---

# 任务：列表展示已落库当前站

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

`GET /api/lifecycle-current-nodes?containerIds=` 按本租户返回这些柜已有流程的 `currentNodeCode`。干活表增加「当前站」；没有流程写「还没有流程」。不补 14 站、不编造计划时间。

## 权威入口

- [LIFECYCLE_NODE_CATALOG_V1](../../product/domain/LIFECYCLE_NODE_CATALOG_V1.md)
- [QUERY_PROJECTION_CONTRACT_V1](../../product/domain/QUERY_PROJECTION_CONTRACT_V1.md) §2 / §3
- [p6-list-lifecycle-nodes](./p6-list-lifecycle-nodes.md)
- [WORKSPACE_UI_INVENTORY](../../product/WORKSPACE_UI_INVENTORY.md) §3 / §4.3

## 边界 / 不做

- 不调用 `ensureFlow`。不拼完整 `nodes[]` / 迷你轨。
- 不恢复同步、ETA、风险列。
- 他租户货柜 ID 直接省略，不泄露存在性。
- 不改旧迁移，不更新像素基线，不 commit。

## 验收

- [x] 本租户：只返回有 `flow_instance` 的柜；最多 200 个 ID。
- [x] 缺少租户 → `AUTHORIZATION_SCOPE_DENIED`；空 ID → `VALIDATION_REQUIRED`。
- [x] 干活表有「当前站」；无流程「还没有流程」；接口失败不假装查过。
- [x] 相关 api/web 测试通过。

## 方案

Repository 用 `container_record.tenant_id` 定界后读 `flow_instance.current_node_code`。前端 `attachCurrentNodes` 只改 `currentNode`，八态仍走 `currentStatus`。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明              |
| ---------- | ------ | ---- | ------ | ----------------- |
| 2026-09-13 | coding | —    | —      | 开工：列表当前站  |
| 2026-09-13 | done   | —    | —      | 干活/看档接当前站 |
