---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/web test 42 文件 / 108 项通过；Playwright desktop-chromium 覆盖 shell-layout 与 visual-layout（并行偶发后 2 worker 复跑通过）。未执行完整 pnpm validate。
---

# 任务：作业壳表面命名规范

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

页面、表格、按钮用「动作+对象」或「对象」。两张货柜表分别叫干活、看档。契约术语不上屏。

## 权威入口

- [UI_SYSTEM.md](../../product/UI_SYSTEM.md) 新增 UI-D09
- [WORKSPACE_UI_INVENTORY](../../product/WORKSPACE_UI_INVENTORY.md) 快照跟名

## 边界 / 不做

- 不改领域文档里的「已出运货柜列表」（那是数据入口口径，不是屏幕表名）。
- 不改 API 路径或数据库名。

## 验收

- [x] UI-D09 写入 UI_SYSTEM，并给出当前表面用名表。
- [x] `/containers` 表面为干活，`/meso` 表面为看档。
- [x] 变更文件测试与 web 单测通过。

## 方案（design 阶段填写）

侧栏、页题、表格 `aria-label` 同一用名。我的任务仍是干活台，不和干活表抢名。

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明         |
| ---------- | ------ | ---- | ------ | ------------ |
| 2026-09-13 | coding | —    | —      | 写规范并改名 |
| 2026-09-13 | done   | —    | —      | UI-D09 上屏  |
