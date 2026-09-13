---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/web test 29 文件 / 77 项通过；typecheck / lint / repo:check 通过。本机库 27 条迁移已齐。HTTP 冒烟见同日记录。浏览器冒烟（系统 Edge，http://localhost:5173）：/real-tasks 空闲无回执；清关 ready 工单点「完成工单」后动作旁显示三段并「已落账」；/real-containers 表内「任务」链到 /real-tasks?containerId=；现场员工导航有「真实任务」。未执行：完整 pnpm validate、官方 Playwright Chromium（下载超时）、视觉快照。
---

# 任务：任务台接真实完成与三段回执

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

作业员在真实任务台完成工单：调用 `POST /api/work-orders/:id/complete`，成功或业务拒绝后在**该动作附近**显示 ClientOperation 三段回执。不新开 ClientOperation 操作台，不替换演示 `/tasks`。

## 权威入口

- [UI_SYSTEM](../../product/UI_SYSTEM.md) §6（无操作不占位；动作附近三段回执）
- [TASK_WORK_ORDER_CONTRACT_V1](../../product/domain/TASK_WORK_ORDER_CONTRACT_V1.md) §13
- [p6-work-execution-client-operation](./p6-work-execution-client-operation.md)
- [p6-list-node-tasks-by-container](./p6-list-node-tasks-by-container.md)

## 边界 / 不做

- 不改演示 `/tasks` 与 demo store，以免拆现有 E2E。
- 不做独立操作记录台、OIDC、证据上传、无货柜的全量任务列表。
- 不做 Kafka、补偿、正式授权模型。

## 验收

- [x] 按货柜列出真实节点任务与工单。
- [x] 完成 ready 工单调用真实 complete，并把 received/accepted/committed 或 rejected 映到 `SubmissionProgress`。
- [x] 空闲不同步占位；回执贴在完成按钮旁。
- [x] `pnpm --filter @logix/web test` 与 `pnpm repo:check` 通过。

## 方案

新增 `/real-tasks`（对齐 `/real-containers`）。映射函数把 complete 响应变成 `SubmissionView`。可选证据引用仅作文本输入。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                                   |
| ---------- | ------ | ---- | ------ | -------------------------------------- |
| 2026-09-13 | coding | —    | —      | 开工：任务台真实完成三段回执           |
| 2026-09-13 | done   | —    | —      | /real-tasks 接 complete 并显示三段回执 |
