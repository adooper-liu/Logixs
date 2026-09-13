---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/api test -- src/modules/workflow 8 项通过；pnpm --filter @logix/business-worker test 5 项通过；api/worker typecheck / lint 与 repo:check 通过。未执行：完整 pnpm validate、本机 Temporal 起系统 Schedule、HTTP 冒烟、OIDC。
---

# 任务：系统排空 Temporal 周期调度

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

经 `workflow` 模块用服务身份保证一条全库系统 Schedule；`business-worker` Activity 从运行环境读取服务凭据，HTTP 调用已有 `POST /api/outbox/system/publish-due`。凭据不进入 Temporal 工作流参数。

## 权威入口

- [ADR-004](../../architecture/decisions/ADR-004-temporal.md)
- [MODULE_DEPENDENCIES](../../architecture/MODULE_DEPENDENCIES.md) §1 / §2
- [p6-outbox-temporal-schedule](./p6-outbox-temporal-schedule.md)
- [p6-outbox-system-drain](./p6-outbox-system-drain.md)

## 边界 / 不做

- 不在 Nest 里 setInterval；不自动在 API 启动时创建 Schedule。
- 不把 `X-Service-Key` 写入 Schedule / Workflow args。
- 用户租户头不能保证系统 Schedule。
- 不做正式 OIDC、真实 broker、Inbox。

## 验收

- [x] `POST /api/workflows/outbox-system/schedule`：服务身份保证一条 `outbox-publish-due-system`；再次调用更新规格。
- [x] 仅有 `X-Tenant-Id` / `X-Operator-Id` 不能调用。
- [x] Worker 工作流只调 Activity；Activity 用环境变量服务头调系统排空，不直连业务库。
- [x] `pnpm --filter @logix/api test -- src/modules/workflow`、`pnpm --filter @logix/business-worker test` 与 `pnpm repo:check` 通过。

## 方案

复用已有 Schedule 端口与间隔解析。系统 Schedule 单独控制器，只挂服务身份中间件。Activity 读 `LOGIX_SERVICE_ID` / `LOGIX_SERVICE_KEY` / `LOGIX_API_URL`。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                                      |
| ---------- | ------ | ---- | ------ | ----------------------------------------- |
| 2026-09-13 | coding | —    | —      | 开工：系统排空 Temporal 调度              |
| 2026-09-13 | done   | —    | —      | API 8 项 + worker 5 项通过；系统 Schedule |
