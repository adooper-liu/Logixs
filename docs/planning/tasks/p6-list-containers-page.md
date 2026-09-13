---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-12）：pnpm --filter @logix/api test -- src/modules/shipment-registry 14 项通过；web typecheck 通过；typecheck / lint / repo:check 通过。未执行：完整 pnpm validate、迁移应用到本机库、HTTP 冒烟、浏览器打开 /real-containers、翻页控件。
---

# 任务：货柜列表游标分页

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

`GET /api/containers` 从无界数组改为 GC-010 游标分页。默认排序 `updatedAt desc, id desc`。响应形状与节点任务列表一致。

## 权威入口

- [QUERY_PROJECTION_CONTRACT_V1](../../product/domain/QUERY_PROJECTION_CONTRACT_V1.md) §9
- [PUBLIC_ERROR_CONTRACT_V1](../../product/domain/PUBLIC_ERROR_CONTRACT_V1.md)
- [p6-list-containers-tenant-scope](./p6-list-containers-tenant-scope.md)（明确推迟本分页）

## 边界 / 不做

- 不实现 cursor 过期、权限裁剪、allowedActions、操作台投影。
- 不做翻页控件；薄真实前端只消费第一页 `items`。
- 不新发规范事件，不做证据核验、Outbox、OIDC。
- 非法 `pageSize`、损坏或租户不匹配的 cursor 明确失败，不退回第一页。

## 验收

- [x] 返回 `items` / `pageInfo` / `asOf` / `projectionVersion`；默认 `pageSize=50`，最大 200。
- [x] 稳定排序 `updatedAt desc, id desc`；`hasNextPage` 与 `nextCursor` 正确。
- [x] cursor 与请求租户不一致时拒绝。
- [x] 薄真实前端按分页信封取 `items`。
- [x] `pnpm --filter @logix/api test -- src/modules/shipment-registry` 与 `pnpm repo:check` 通过。

## 方案

Application 解析分页；Repository 按租户 + 游标查询；为 `(tenant_id, updated_at, id)` 补索引。cursor 绑定 `tenantId`。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                   |
| ---------- | ------ | ---- | ------ | ---------------------- |
| 2026-09-12 | coding | —    | —      | 开工：货柜列表游标分页 |
| 2026-09-12 | done   | —    | —      | 14 项单测通过；GC-010 分页信封 |
