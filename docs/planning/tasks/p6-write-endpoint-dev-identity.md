---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-12）：pnpm --filter @logix/api test -- src/modules/work-execution src/modules/lifecycle-control src/modules/identity src/modules/integration-import 71 项通过；typecheck / lint / repo:check 通过。未执行：完整 pnpm validate、HTTP 401 冒烟、正式 OIDC、前端。
---

# 任务：工单与生命周期写接口开发期身份

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

写接口默认需要认证。把已有 `X-Tenant-Id` / `X-Operator-Id` 身份校验收到 `identity` 公开入口，并由各模块在 composition 层挂中间件（控制器不得引用其他模块）。套到 `work-execution` 与 `lifecycle-control` 的 HTTP 面。`SetNodeApplicability` 的 `actorId` 只取身份头，不信请求体。

## 权威入口

- [AGENTS.md](../../../AGENTS.md) §5
- [ACTION_PERMISSION_CONTRACT_V1](../../product/domain/ACTION_PERMISSION_CONTRACT_V1.md)
- [MODULE_DEPENDENCIES](../../architecture/MODULE_DEPENDENCIES.md)

## 边界 / 不做

- 不做正式 OIDC、能力模型、对象级授权、证据核验、Outbox。
- 不改导入批次既有身份语义，只改为消费 `identity` 公开中间件。
- 不覆盖 `health`、`workflows` 等本刀未点名的端点。
- 不新发规范事件，不做前端。

## 验收

- [x] 缺 `X-Tenant-Id` 或 `X-Operator-Id`（含空串）时拒绝 `AUTHENTICATION_REQUIRED`。
- [x] 工单、生命周期事件、适用性命令所在控制器经模块中间件挂上该校验。
- [x] 适用性命令 `actorId` 来自身份头；请求体不再带 `actorId`。
- [x] Domain / Controller 不引用 `integration-import` 内部路径。
- [x] `pnpm --filter @logix/api test -- src/modules/work-execution src/modules/lifecycle-control src/modules/identity` 与 `pnpm repo:check` 通过。

## 方案

身份解析进入 `identity`。`WorkExecutionModule` / `LifecycleControlModule` / `IntegrationImportModule` 在 `configure` 中 `apply(DevIdentityMiddleware)`。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                      |
| ---------- | ------ | ---- | ------ | ------------------------- |
| 2026-09-12 | coding | —    | —      | 开工：写接口开发期身份    |
| 2026-09-12 | done   | —    | —      | 71 项单测通过；中间件挂载 |
