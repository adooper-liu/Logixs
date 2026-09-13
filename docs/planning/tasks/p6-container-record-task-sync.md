---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：MicroWorkbench 5 项通过；web typecheck 通过；变更文件 eslint/prettier 通过。Playwright desktop-chromium「container record remains readable」通过。未执行：完整 pnpm validate、像素基线。
---

# 任务：一柜一档对象头露出任务和同步

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

一柜一档对象头在有事实时露出任务、同步：待办来自该柜 `GET /node-tasks?containerId=`，落账来自最近一页 `GET /client-operations`。没有事实保持隐藏，不写「无投影」。

## 权威入口

- [QUERY_PROJECTION_CONTRACT_V1](../../product/domain/QUERY_PROJECTION_CONTRACT_V1.md) §3
- [SYNC_RELIABILITY_CONTRACT_V1](../../product/domain/SYNC_RELIABILITY_CONTRACT_V1.md)
- [p6-container-list-sync-status](./p6-container-list-sync-status.md)
- [WORKSPACE_UI_INVENTORY](../../product/WORKSPACE_UI_INVENTORY.md) §4.4

## 边界 / 不做

- 不补风险、ETA、箱型、提单、地点。不恢复「最近操作已落账」演示文案。
- 不按柜新开操作查询。不改旧迁移，不更新像素基线，不 commit。

## 验收

- [x] 该柜有未完成任务则对象头显示待办人话。
- [x] 最近提交能挂到该柜则显示落账口径；挂不上保持隐藏。
- [x] 任务或操作接口失败不影响档案，不把 idle 写成已查空。
- [x] 相关 web 测试通过。

## 方案

复用 `attachOpenTasks` / `attachLatestSync`。任务按柜拉取；操作用已有租户页，并用该柜任务当旧记录提示。`showIdleTask` / `showIdleSync` 保持 false。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                 |
| ---------- | ------ | ---- | ------ | -------------------- |
| 2026-09-13 | coding | —    | —      | 开工：档案头任务同步 |
| 2026-09-13 | done   | —    | —      | 对象头接任务与落账   |
