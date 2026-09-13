---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：kpiProjection / KpiSignalStrip 7 项通过；web typecheck 通过；变更文件 eslint/prettier 通过。Playwright desktop-chromium「management-dashboard remains readable」「management dashboard stays a single scan」通过。未执行：完整 pnpm validate、像素基线。
---

# 任务：货柜页露出未落账数

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

货柜页在最近一页提交里确实有未落账货柜时，多挂一张「还没记下」。没有未落账、同步没查到，都不挂。不写「0 项」或「全部已落账」。

## 权威入口

- [SYNC_RELIABILITY_CONTRACT_V1](../../product/domain/SYNC_RELIABILITY_CONTRACT_V1.md)
- [QUERY_PROJECTION_CONTRACT_V1](../../product/domain/QUERY_PROJECTION_CONTRACT_V1.md) §3
- [p6-container-list-sync-status](./p6-container-list-sync-status.md)
- [WORKSPACE_UI_INVENTORY](../../product/WORKSPACE_UI_INVENTORY.md) §4.1

## 边界 / 不做

- 不补风险、费用、异常、流向扫描。
- 不把 idle 当成已查空。不恢复「待服务器确认数」。
- 不改旧迁移，不更新像素基线，不 commit。

## 验收

- [x] 默认可只有货柜数。
- [x] `syncReady` 且至少一柜最新提交未落账时出现「还没记下」，点去看提交。
- [x] 不出现「全部已落账」「0 项」「76%」。
- [x] 相关 web 测试通过。

## 方案

复用 catalog 已挂的 `syncStatus`。`createWorkspaceOverviewSignals` 增加可选 `syncReady`。列数跟信号数走，不再按五格空位排。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明               |
| ---------- | ------ | ---- | ------ | ------------------ |
| 2026-09-13 | coding | —    | —      | 开工：货柜未落账   |
| 2026-09-13 | done   | —    | —      | 有未落账才挂第二张 |
