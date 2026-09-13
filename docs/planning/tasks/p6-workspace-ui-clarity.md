---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/web test 41 文件 / 105 项通过；web typecheck 通过；变更文件 eslint 通过；Playwright desktop-chromium 覆盖 visual-layout / shell-layout / task-workflow。未执行：完整 pnpm validate、narrow/mobile 全量 E2E。无浏览器 MCP，未做手工点击验收。
---

# 任务：作业壳信息架构与人话文案

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

产品页按现场任务命名和分层：干活、看柜、看档案、看提交、看失败。去掉没有数据的模块和工程黑话，空态只指向下一步。不编造费用、轨道、异常或演示样本。

## 权威入口

- [UI_SYSTEM.md](../../product/UI_SYSTEM.md) UI-D01 / UI-D02 / UI-D04 / UI-D06
- [UX_CONTAINER_WORKBENCH](../../product/UX_CONTAINER_WORKBENCH.md) §1.2 / §1.4
- [QUERY_PROJECTION_CONTRACT_V1](../../product/domain/QUERY_PROJECTION_CONTRACT_V1.md)

## 边界 / 不做

- 不新增查询 API、不填演示数据、不改迁移。
- 不改视觉令牌、不重画主题、不更新像素基线。
- 不收口 `/real-operations` 的补偿执行（仍只读）。
- 不改 leftover `/real-tasks` 调试页文件（已不进路由）。

## 验收

- [x] 侧栏与页题不再出现 PDCA、First Mile、API 接线、死信、查询投影、P6 阶段。
- [x] `/dashboard` 只展示已有货柜数，不渲染空 KPI / 空决策 / 空分析。
- [x] `/meso` 只保留货柜表并下钻一柜一档，不渲染空 RACI / 空计划。
- [x] `/containers` 表不展示无法填充的任务/同步/ETA/风险列。
- [x] `/container/:id` 空态是人话并链到该柜任务。
- [x] `pnpm --filter @logix/web test` 与变更文件 lint / typecheck 通过。

## 方案（design 阶段填写）

页间职责固定：货柜表 → 任务；总览/流转 → 档案；任务台柜号 → 档案。

文案按职务命名：总览、货柜流转、提交记录、失败消息。去掉装饰性 eyebrow。`StatusTriplet` 增加 `showIdleTask`，现场对象头只显示货柜状态。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                 |
| ---------- | ------ | ---- | ------ | -------------------- |
| 2026-09-13 | design | —    | —      | 人话 IA，隐藏空模块  |
| 2026-09-13 | coding | —    | —      | 开工改作业壳         |
| 2026-09-13 | done   | —    | —      | 人话 IA 与空模块下线 |
