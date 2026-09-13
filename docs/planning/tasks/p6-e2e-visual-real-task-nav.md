---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/web test 30 文件 / 79 项通过；typecheck / lint / repo:check 通过。Playwright：shell-layout 三视口 11 通过 / 4 跳过；主导航语义断言三视口通过。视觉全量 32 通过 / 2 跳过 / 4 失败（task-queue 桌面+窄屏、operation-record 窄屏、container-record 移动）为区域内字体光栅 4–6%，不含侧栏，未改像素基线、未放宽容差。
---

# 任务：E2E 对齐真实任务导航

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

现场员工侧栏出现「真实任务」后，E2E 用语义断言锁住导航，不靠像素兜底。壳层溢出合同覆盖 `/real-tasks`。视觉快照只在超过既有 3% 容差时更新。

## 权威入口

- [UI_SYSTEM](../../product/UI_SYSTEM.md) §6
- [p6-task-workbench-complete-receipt](./p6-task-workbench-complete-receipt.md)
- [p6-e2e-dev-server-loopback](./p6-e2e-dev-server-loopback.md)
- `apps/web/e2e/visual-layout.spec.ts`：导航项增减不靠像素兜底

## 边界 / 不做

- 不改演示 `/tasks`、demo store、业务完成语义。
- 不把 `/real-tasks` 做成依赖实时 API 数据的像素基线。
- 不修空库迁移债、不改已入共享环境的旧迁移。
- 不跑完整 `pnpm validate`（除非本刀改动触发）。

## 验收

- [x] `/tasks` 侧栏有「真实任务」，没有「开发控制台」。
- [x] `/real-tasks` 进入共享壳，标题可见，主体不横向溢出。
- [x] 视觉项目在本机官方 Chromium 下跑完；仅更新确因导航变化超容差的快照（本刀无此类快照）。
- [x] `pnpm --filter @logix/web test` 与 `pnpm repo:check` 通过。

## 方案

扩展现有 visual / shell E2E。导航用 role=link 断言。必要时 `--update-snapshots` 只提交与侧栏相关的 PNG。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                           |
| ---------- | ------ | ---- | ------ | ------------------------------ |
| 2026-09-13 | coding | —    | —      | 开工：真实任务导航 E2E         |
| 2026-09-13 | done   | —    | —      | 语义断言 + 折叠导航 aria-label |
