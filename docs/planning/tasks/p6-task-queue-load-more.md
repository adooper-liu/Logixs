---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：useLiveWorkspace 4 项通过；web typecheck 通过；变更文件 eslint/prettier 通过。Playwright desktop-chromium「task queue keeps the live work list bounded」通过。未执行：完整 pnpm validate、像素基线。
---

# 任务：我的任务再看后面一页

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

我的任务在 `hasNextPage` 时可以再拉一页并接在后面。没有下一页不出现按钮。下一页失败不丢掉已经看到的任务。不假装第一页就是全部。

## 权威入口

- [QUERY_PROJECTION_CONTRACT_V1](../../product/domain/QUERY_PROJECTION_CONTRACT_V1.md) 游标分页
- [p6-list-node-tasks-by-tenant](./p6-list-node-tasks-by-tenant.md)
- [WORKSPACE_UI_INVENTORY](../../product/WORKSPACE_UI_INVENTORY.md) §4.5

## 边界 / 不做

- 不领取、不报异常、不改完成工单。
- 不改页大小契约（仍最大 200）。完成工单后重载回第一页可接受。
- 不改旧迁移，不更新像素基线，不 commit。

## 验收

- [x] 第一页 `hasNextPage` 时出现「再看后面」。
- [x] 再拉一页用 cursor，任务追加，不覆盖。
- [x] 新页里没有柜号的柜会补 `GET /containers/:id`；补失败仍保留任务。
- [x] 再拉失败写「后面的任务没能加载」，已有任务还在。
- [x] 相关 web 测试通过。

## 方案

`useLiveWorkspace` 记下 `nextCursor`。按钮放在任务台列表下，不改 TaskQueue 排序规则。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明               |
| ---------- | ------ | ---- | ------ | ------------------ |
| 2026-09-13 | coding | —    | —      | 开工：任务再看后面 |
| 2026-09-13 | done   | —    | —      | 游标追加下一页 |
