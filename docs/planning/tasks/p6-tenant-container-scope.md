---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-12）：pnpm --filter @logix/api test -- src/modules/work-execution src/modules/lifecycle-control src/modules/shipment-registry 69 项通过；typecheck / lint / repo:check 通过。未执行：完整 pnpm validate、HTTP 跨租户冒烟、货柜列表租户过滤、OIDC、前端。
---

# 任务：货柜对象租户范围

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

认证之后补 GC-008 的租户校验：工单与生命周期对指定货柜的读写，必须匹配 `X-Tenant-Id` 与 `container_record.tenant_id`。跨租户返回 `AUTHORIZATION_SCOPE_DENIED`。

## 权威入口

- [ACTION_PERMISSION_CONTRACT_V1](../../product/domain/ACTION_PERMISSION_CONTRACT_V1.md) §5
- [PUBLIC_ERROR_CONTRACT_V1](../../product/domain/PUBLIC_ERROR_CONTRACT_V1.md)
- [MODULE_DEPENDENCIES](../../architecture/MODULE_DEPENDENCIES.md)

## 边界 / 不做

- 不做能力模型、组织/地点范围、证据核验、OIDC、Outbox。
- 不改 `GET /api/containers` 全量列表（仍无租户过滤，本刀不扩大到 shipment 列表）。
- 无 `containerId` 的任务完成暂不拦截（与现有发事件 skip 一致）。
- 不新发规范事件，不做前端。

## 验收

- [x] 货柜不存在 → `RESOURCE_NOT_FOUND`；租户不匹配 → `AUTHORIZATION_SCOPE_DENIED`。
- [x] 生命周期申请事件、适用性命令、按货柜列任务、完成/读取带 containerId 的任务均校验。
- [x] 幂等回放前先校验租户。
- [x] `pnpm --filter @logix/api test -- src/modules/work-execution src/modules/lifecycle-control src/modules/shipment-registry` 与 `pnpm repo:check` 通过。

## 方案

`shipment-registry` 导出货柜租户断言。lifecycle 用已有 `findContainerBase`。work-execution Application 经公开入口调用断言。控制器传入 `devIdentity.tenantId`。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                   |
| ---------- | ------ | ---- | ------ | ---------------------- |
| 2026-09-12 | coding | —    | —      | 开工：货柜对象租户范围 |
| 2026-09-12 | done   | —    | —      | 69 项单测通过；公开端口 AssertContainerTenant |
