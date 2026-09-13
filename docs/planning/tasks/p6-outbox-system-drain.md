---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/api test -- src/modules/identity src/modules/lifecycle-control 102 项通过；typecheck / lint / repo:check 通过。未执行：完整 pnpm validate、本机 HTTP 冒烟、OIDC、Temporal 系统级 Schedule。
---

# 任务：服务身份跨租户 Outbox 系统排空

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

新增开发期服务身份（`actorType=service`），并提供系统排空命令：列出有到期 Outbox 的租户，再逐租户复用已有 `publish-due` 领取。用户租户头不能扫全库。领取语句仍带 `tenant_id`。

## 权威入口

- [ACTION_PERMISSION_CONTRACT_V1](../../product/domain/ACTION_PERMISSION_CONTRACT_V1.md) §3（GC-008：service 不模拟人工用户）
- [ADR-008](../../architecture/decisions/ADR-008-oidc-oauth.md)（服务身份；本刀不做 OIDC）
- [SYNC_RELIABILITY_CONTRACT_V1](../../product/domain/SYNC_RELIABILITY_CONTRACT_V1.md) §6 / §7（GC-009）
- [p6-outbox-publish-due](./p6-outbox-publish-due.md)

## 边界 / 不做

- 不做正式 OIDC / Keycloak、能力模型、跨租户无 `tenant_id` 的领取 SQL。
- 不改 `POST /api/outbox/publish-due` 的租户身份语义。
- 不做 Temporal 系统级 Schedule、真实 broker、Inbox。

## 验收

- [x] 系统排空要求 `X-Service-Id` + `X-Service-Key`；缺或错为 `AUTHENTICATION_REQUIRED`。
- [x] 仅有 `X-Tenant-Id` / `X-Operator-Id` 不能调用系统排空。
- [x] `POST /api/outbox/system/publish-due`：按到期租户逐个调用已有排空；`maxTenants` 默认 20、最大 100。
- [x] 领取仍按租户过滤；服务身份作为租约 owner，不写入业务状态机。
- [x] `pnpm --filter @logix/api test -- src/modules/identity src/modules/lifecycle-control` 与 `pnpm repo:check` 通过。

## 方案

`identity` 解析并恒定时间比较服务凭据。`lifecycle-control` 仓库只查出到期 `tenant_id`；Application 循环已有 `DrainDueOutboxService`。系统路由单独控制器，只挂服务身份中间件。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                             |
| ---------- | ------ | ---- | ------ | -------------------------------- |
| 2026-09-13 | coding | —    | —      | 开工：服务身份系统排空           |
| 2026-09-13 | done   | —    | —      | 102 项单测通过；服务身份系统排空 |
