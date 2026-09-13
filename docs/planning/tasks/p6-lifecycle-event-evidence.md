---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-12）：pnpm --filter @logix/api test -- src/modules/lifecycle-control 32 项通过；src/modules/work-execution 38 项通过；typecheck / lint / repo:check 通过；已 pnpm db:generate。未执行：完整 pnpm validate、迁移应用到本机库、HTTP 冒烟、前端。
---

# 任务：规范事件与工单完成证据核验

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

申请规范事件必须带合格 `evidenceRefs`。装箱/出运/离港工单在会发事件时，先核验证据再落完成；不再无证据推进主链。

## 权威入口

- [EVIDENCE_SOURCE_AUTHORITY_CONTRACT_V1](../../product/domain/EVIDENCE_SOURCE_AUTHORITY_CONTRACT_V1.md) §12
- [CONTAINER_LIFECYCLE_STATE_MACHINE_CONTRACT_V1](../../product/domain/CONTAINER_LIFECYCLE_STATE_MACHINE_CONTRACT_V1.md)
- [PUBLIC_ERROR_CONTRACT_V1](../../product/domain/PUBLIC_ERROR_CONTRACT_V1.md)
- [p6-evidence-first-slice](./p6-evidence-first-slice.md)（明确推迟本接入）

## 边界 / 不做

- 不做来源权威策略、append-only 裁决表、对象存储、Outbox、前端。
- `resultPolicy=none` 的工单完成仍不强制证据。
- 无 `containerId` 仍 skip 发事件，不拦工单完成。
- 不把 `verified` 当成节点完成。

## 验收

- [x] `ApplyLifecycleEvent` 要求至少一条合格证据；缺/不合格 → `EVIDENCE_REQUIRED`，不写事件。
- [x] 事件流水账保存 `evidenceRefs`。
- [x] 会发事件的工单完成：无合格证据则拒绝，不落完成。
- [x] 幂等回放不重复核验。
- [x] `pnpm --filter @logix/api test -- src/modules/lifecycle-control src/modules/work-execution` 与 `pnpm repo:check` 通过。

## 方案

lifecycle 写入前走 `AssertEvidenceRefs`。work-execution 在 persist 前同样断言，再把 refs 传给公开事件端口。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                         |
| ---------- | ------ | ---- | ------ | ---------------------------- |
| 2026-09-12 | coding | —    | —      | 开工：事件与工单完成证据核验 |
| 2026-09-12 | done   | —    | —      | 70 项单测通过；发事件前核验证据 |
