---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-12）：pnpm --filter @logix/api test -- src/modules/document-records src/modules/lifecycle-control 39 项通过；typecheck / lint / repo:check 通过；已 pnpm db:generate。未执行：完整 pnpm validate、迁移应用到本机库、HTTP 冒烟、前端。
---

# 任务：证据登记与适用性核验第一刀

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

`document-records` 落最小 `evidence_record`。适用性命令的 `evidenceRefs` 必须指向同租户、同货柜、`verified` 且 `effective` 的证据，否则 `EVIDENCE_REQUIRED`。不再只校验 UUID 格式。

## 权威入口

- [EVIDENCE_SOURCE_AUTHORITY_CONTRACT_V1](../../product/domain/EVIDENCE_SOURCE_AUTHORITY_CONTRACT_V1.md) §3/§5/§7
- [CROSS_MODULE_REFERENCE_CONTRACT_V1](../../product/domain/CROSS_MODULE_REFERENCE_CONTRACT_V1.md) §3
- [PUBLIC_ERROR_CONTRACT_V1](../../product/domain/PUBLIC_ERROR_CONTRACT_V1.md)
- [p6-set-node-applicability](./p6-set-node-applicability.md)（明确推迟核验）

## 边界 / 不做

- 不做对象存储、恶意内容扫描、来源权威策略匹配、append-only 验证决定表、人工锁、密封、Outbox。
- 不把 `verified` 当成工单或节点完成；不发规范事件。
- 不改生命周期申请事件、工单完成；那些命令本刀仍不带证据核验。
- 不做前端、OIDC、能力模型。
- `verify` 本刀直接改 `verificationState`（偏离：正式裁决应追加不可变决定行）。

## 验收

- [x] `POST /api/evidence` 登记为 `pending`；`POST /api/evidence/:id/verify` 改为 `verified`。
- [x] 缺记录、跨租户、对象不匹配、未核验或非 effective → `EVIDENCE_REQUIRED` / `AUTHORIZATION_SCOPE_DENIED`。
- [x] `SetNodeApplicability` 写入前调用公开断言端口。
- [x] `pnpm --filter @logix/api test -- src/modules/document-records src/modules/lifecycle-control` 与 `pnpm repo:check` 通过。

## 方案

`document-records` 导出 `Symbol.for("logix.AssertEvidenceRefs")`。lifecycle Application 用本地端口注入，不从 barrel 取实现类。登记带开发期身份。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                            |
| ---------- | ------ | ---- | ------ | ------------------------------- |
| 2026-09-12 | coding | —    | —      | 开工：证据登记与适用性核验      |
| 2026-09-12 | done   | —    | —      | 39 项单测通过；适用性写入前核验 |
