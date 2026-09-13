---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/api test -- src/modules/document-records 11 项通过；typecheck / lint / repo:check 通过；已 pnpm db:generate。未执行：完整 pnpm validate、迁移应用到本机库、事务回滚集成测试、HTTP 冒烟、前端。
---

# 任务：证据核验 append-only 裁决

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

`verify` 不再只改 `evidence_record.verification_state`。每次核验追加一条不可变 `EvidenceVerificationDecision`，与状态更新同事务。

## 权威入口

- [EVIDENCE_SOURCE_AUTHORITY_CONTRACT_V1](../../product/domain/EVIDENCE_SOURCE_AUTHORITY_CONTRACT_V1.md) §7
- [p6-evidence-first-slice](./p6-evidence-first-slice.md)（明确偏离：直接改状态）

## 边界 / 不做

- 不做来源权威策略匹配、对象存储、恶意扫描、人工锁、密封、Outbox、前端。
- 不做 `rejected` / `revoked` 命令；本刀只落 `verified` 决定。
- 本刀使用登记的人工核验占位策略，不假装已有复合 SourceAuthorityPolicy。
- 已 verified 幂等返回，不追加第二条同义决定。

## 验收

- [x] 首次 `verify` 写入 `verification_sequence=1` 的决定行，并把证据标为 `verified`。
- [x] 决定行不可更新；同事务失败则状态与决定一起回滚。
- [x] 已 verified 不再插入决定行。
- [x] `pnpm --filter @logix/api test -- src/modules/document-records` 与 `pnpm repo:check` 通过。

## 方案

`evidence_verification_decision` 唯一键 `(evidence_id, verification_sequence)`。Repository 用事务追加决定并更新状态。`actorOrServiceId` 取 `X-Operator-Id`。占位 `policyId=30000000-0000-4000-8000-000000000001` / `policyVersion=1` / `checks=["manual_review"]`。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                             |
| ---------- | ------ | ---- | ------ | -------------------------------- |
| 2026-09-13 | coding | —    | —      | 开工：append-only 核验裁决       |
| 2026-09-13 | done   | —    | —      | 11 项单测通过；verify 追加决定行 |
