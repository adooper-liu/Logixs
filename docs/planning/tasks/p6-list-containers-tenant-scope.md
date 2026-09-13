---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-12）：pnpm --filter @logix/api test -- src/modules/shipment-registry 7 项通过；web typecheck 通过；typecheck / lint / repo:check 通过。未执行：完整 pnpm validate、对运行中 API 的 HTTP 冒烟、db:seed 后浏览器点开 /real-containers、OIDC、分页。
---

# 任务：货柜列表租户范围

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

上一刀已对单货柜读写做对象级租户校验，但 `GET /api/containers` 仍返回全库。本刀按 `X-Tenant-Id` 过滤列表，并给该读接口挂上开发期身份。

## 权威入口

- [ACTION_PERMISSION_CONTRACT_V1](../../product/domain/ACTION_PERMISSION_CONTRACT_V1.md) §5
- [PUBLIC_ERROR_CONTRACT_V1](../../product/domain/PUBLIC_ERROR_CONTRACT_V1.md)
- [p6-tenant-container-scope](./p6-tenant-container-scope.md)（明确推迟本列表）

## 边界 / 不做

- 不做游标分页、稳定排序契约升级、能力模型、OIDC、对象级字段权限。
- 不改列表响应形状（仍为 `ContainerSummary[]`）。
- 不新发规范事件，不做操作台/工作台投影。
- 开发期身份与导入写路径对齐：`dev-tenant` / `dev-operator`。种子数据同步到该租户，避免薄真实列表被滤空。

## 验收

- [x] 缺身份头 → `AUTHENTICATION_REQUIRED`。
- [x] 列表只返回 `container_record.tenant_id = X-Tenant-Id` 的行。
- [x] 缺租户时服务拒绝 `AUTHORIZATION_SCOPE_DENIED`。
- [x] 薄真实前端列表带上开发期身份头。
- [x] `pnpm --filter @logix/api test -- src/modules/shipment-registry` 与 `pnpm repo:check` 通过。

## 方案

`ListContainersService` / `ContainerRepository.list(tenantId)` 按租户过滤。`ShipmentRegistryModule` 对 `ContainersController` 挂 `DevIdentityMiddleware`。`apps/web/src/api/containers.ts` 发送与导入相同的开发期身份头。`database/seed.ts` 的租户改为 `dev-tenant`。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                   |
| ---------- | ------ | ---- | ------ | ---------------------- |
| 2026-09-12 | coding | —    | —      | 开工：货柜列表租户范围 |
| 2026-09-12 | done   | —    | —      | 7 项单测通过；列表按租户过滤 |
