---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/api test -- src/modules/document-records 14 项通过；typecheck / lint / repo:check 通过。未执行：完整 pnpm validate、HTTP 冒烟、前端、已引用证据的事件回退。
---

# 任务：证据拒绝与撤销

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

在已有 append-only 裁决表上补 `rejected` / `revoked`。拒绝只从 `pending` 出发；撤销只从 `verified` 出发，并引用原核验决定。不合格证据仍不能被 `AssertEvidenceRefs` 放行。

## 权威入口

- [EVIDENCE_SOURCE_AUTHORITY_CONTRACT_V1](../../product/domain/EVIDENCE_SOURCE_AUTHORITY_CONTRACT_V1.md) §3.1 / §7 / §9
- [p6-evidence-verification-decision](./p6-evidence-verification-decision.md)（明确推迟本命令）

## 边界 / 不做

- 不做来源权威策略、对象存储、人工锁、密封、Outbox、前端。
- 撤销不另收一组新 evidenceRefs（正式撤销证据链下一刀）。
- 不重放已应用的生命周期事件；已引用被撤证据的历史事件不自动回退。

## 验收

- [x] `POST /api/evidence/:id/reject`：`pending → rejected`，追加决定；已 rejected 幂等。
- [x] `POST /api/evidence/:id/revoke`：`verified → revoked` 且 `validity=revoked`，`previousDecisionId` 指向原 verified 决定。
- [x] 非允许状态 → `BUSINESS_STATE_VIOLATION`；无原核验决定不可撤。
- [x] `pnpm --filter @logix/api test -- src/modules/document-records` 与 `pnpm repo:check` 通过。

## 方案

领域函数判定转换。Repository 同事务追加决定并更新状态。HTTP 身份头与 verify 相同。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                 |
| ---------- | ------ | ---- | ------ | -------------------- |
| 2026-09-13 | coding | —    | —      | 开工：拒绝与撤销证据 |
| 2026-09-13 | done   | —    | —      | 14 项单测通过；reject/revoke 命令 |
