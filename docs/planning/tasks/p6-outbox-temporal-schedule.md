---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/api test -- src/modules/workflow 5 项通过；pnpm --filter @logix/business-worker test 3 项通过；api/worker typecheck / lint 与 repo:check 通过。未执行：完整 pnpm validate、本机 Temporal 起 Schedule、HTTP 冒烟、跨租户排空。
---

# 任务：本租户 Outbox Temporal 周期调度

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

经 `workflow` 模块为本租户保证一条 Temporal Schedule；`business-worker` 的确定性工作流在 Activity 里 HTTP 调用已有 `POST /api/outbox/publish-due`。`lifecycle-control` 不引用 Temporal。

## 权威入口

- [ADR-004](../../architecture/decisions/ADR-004-temporal.md)（Workflow 确定性；业务写入经业务 API）
- [MODULE_DEPENDENCIES](../../architecture/MODULE_DEPENDENCIES.md) §1 / §2（仅 workflow / worker 引用 Temporal）
- [SYNC_RELIABILITY_CONTRACT_V1](../../product/domain/SYNC_RELIABILITY_CONTRACT_V1.md) §6 / §7（GC-009）
- [p6-outbox-publish-due](./p6-outbox-publish-due.md)

## 边界 / 不做

- 不在 Nest 进程里用 setInterval 冒充官方调度。
- 不跨租户排空、不做正式服务身份、不接真实 broker / Inbox。
- `lifecycle-control` 与其它业务模块不 import `@temporalio/*`。
- 不在 API 启动时偷偷创建 Schedule；由写接口显式保证。

## 验收

- [x] `POST /api/workflows/outbox-publish-due/schedule`：按当前 `X-Tenant-Id` 保证一条 Schedule；身份与其它写接口相同。
- [x] `intervalSeconds` 默认 30、范围 5–3600；同一租户再次调用更新规格，不新建第二条。
- [x] Worker 工作流只调 Activity；Activity 只 HTTP 调 `publish-due`，不直连业务库。
- [x] `pnpm --filter @logix/api test -- src/modules/workflow`、`pnpm --filter @logix/business-worker test` 与 `pnpm repo:check` 通过。

## 方案

领域函数解析间隔并生成 `outbox-publish-due:{tenantId}`。Application 经 Schedule 端口保证规格。Infrastructure 适配 Temporal。Worker Activity 用 `LOGIX_API_URL`（默认 `http://localhost:3000`）投递开发期身份头。重叠策略 SKIP。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                                          |
| ---------- | ------ | ---- | ------ | --------------------------------------------- |
| 2026-09-13 | coding | —    | —      | 开工：本租户 Temporal 周期调度                |
| 2026-09-13 | done   | —    | —      | API 5 项 + worker 3 项通过；Schedule 保证接口 |
