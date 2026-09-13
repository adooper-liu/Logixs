---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-12）：pnpm --filter @logix/api test -- src/modules/work-execution src/modules/lifecycle-control 61 项通过；typecheck / lint / repo:check 通过；已 pnpm db:generate。未执行：完整 pnpm validate、迁移应用到本机库、HTTP 冒烟、证据核验、前端。
---

# 任务：可选节点适用性（SetNodeApplicability 第一刀）

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

落地 `SetNodeApplicability`：只允许把 catalog 中的 optional 节点标为 `optional_applicable` / `optional_not_applicable`。规范事件完成后激活下一任务时，跳过已证明不适用的可选节点。

## 权威入口

- [LIFECYCLE_NODE_CATALOG_V1](../../product/domain/LIFECYCLE_NODE_CATALOG_V1.md) §4
- [CONTAINER_LIFECYCLE_STATE_MACHINE_CONTRACT_V1](../../product/domain/CONTAINER_LIFECYCLE_STATE_MACHINE_CONTRACT_V1.md) §6.3 / §7.9
- [lifecycle-nodes.json](../../../packages/contracts/catalogs/v1/lifecycle-nodes.json)

## 边界 / 不做

- 不静默跳过未经过命令确认的 optional 节点；默认仍为 `optional_applicable`。
- required 节点不得标不适用。节点已激活、或更后序节点已推进时拒绝，须走人工纠偏。
- 本刀保存 `evidenceRefs` / `actorId` / `reasonCode`，不核验证据模块、不做正式授权、不做 Outbox。
- 不新发海运/海关规范事件，不做前端。

## 验收

- [x] `transshipment` / `rail_transfer` 可标 `optional_not_applicable`；`ocean_transit` 等 required 拒绝。
- [x] 完成后激活跳过 N/A 的 `transshipment`，落到 `customs_clearance`。
- [x] 同 `idempotencyKey` 重放不重复写入；`expectedVersion` 冲突拒绝。
- [x] `pnpm --filter @logix/api test -- src/modules/work-execution src/modules/lifecycle-control` 与 `pnpm repo:check` 通过。

## 方案

Domain 判定可选性与下一适用节点。lifecycle 命令写 `node_instance.applicability` 与决策留痕。`activateFollowingTask` 按适用性行走。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                             |
| ---------- | ------ | ---- | ------ | -------------------------------- |
| 2026-09-12 | coding | —    | —      | 开工：SetNodeApplicability       |
| 2026-09-12 | done   | —    | —      | 61 项单测通过；中转 N/A 跳到清关 |
