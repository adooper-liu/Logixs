---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：lifecycle-control application 110 项通过；相关 web 21 项通过；api/web typecheck 通过；变更文件 eslint/prettier 通过。HTTP：本租户 GET /api/lifecycle-nodes?containerIds=… 200（按 NODE_SEQUENCE 返回已落库节点）；他租户同 ID 200 空页；缺 containerIds 400 VALIDATION_REQUIRED。Playwright desktop-chromium「planning-workbench remains readable」「container-list remains readable」通过。未执行：完整 pnpm validate、像素基线。
---

# 任务：看档展示已落库迷你轨

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

`GET /api/lifecycle-nodes?containerIds=` 按本租户批量返回这些柜已有 `node_instance`。看档行下展示迷你轨：只画落库站点，当前站标出来。没有流程不画空轨。不补目录空站、不编造计划时间。

## 权威入口

- [LIFECYCLE_NODE_CATALOG_V1](../../product/domain/LIFECYCLE_NODE_CATALOG_V1.md)
- [QUERY_PROJECTION_CONTRACT_V1](../../product/domain/QUERY_PROJECTION_CONTRACT_V1.md) §2 / §3
- [p6-list-lifecycle-nodes](./p6-list-lifecycle-nodes.md)
- [p6-list-container-current-nodes](./p6-list-container-current-nodes.md)
- [WORKSPACE_UI_INVENTORY](../../product/WORKSPACE_UI_INVENTORY.md) §3 / §4.2

## 边界 / 不做

- 不调用 `ensureFlow`。不画 14 站空进度。
- 不恢复风险、ETA。不改干活表列。
- 他租户货柜 ID 直接省略，不泄露存在性。
- 不改旧迁移，不更新像素基线，不 commit。

## 验收

- [x] 本租户：只返回有流程的柜；节点按 `NODE_SEQUENCE`；最多 200 个 ID。
- [x] 缺少租户 → `AUTHORIZATION_SCOPE_DENIED`；空 ID → `VALIDATION_REQUIRED`。
- [x] 看档有落库节点才画轨；无流程不画；接口失败不假装查过。
- [x] 相关 api/web 测试通过。

## 方案

复用 `parseContainerIds` 与 `projectLifecycleNodes`。Repository 用 `container_record.tenant_id` 定界后读 `flow_instance` + `node_instance`。前端挂到 `rail`，只填已有名称/状态/当前站。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明             |
| ---------- | ------ | ---- | ------ | ---------------- |
| 2026-09-13 | coding | —    | —      | 开工：看档迷你轨 |
| 2026-09-13 | done   | —    | —      | 批量节点 + 看档迷你轨 |
