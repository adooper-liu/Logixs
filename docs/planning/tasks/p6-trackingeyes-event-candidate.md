---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/provider-event-ingestion
verification: API 领域测试 10/10、format:check、lint、typecheck、build、repo:check、docs:check 均通过
---

# 任务：云当网事件候选归一化第一刀

## 目标

把云当网海运箱动态转换为可审计的 Logixs 规范事件候选，并显式保留供应商事件 ID、原始码、来源信号、预计/实际语义及映射版本。未知码、时区不明、供应商推断和删除动态不得静默应用或直接推进生命周期。

## 边界 / 不做

- 依赖正式 `EVENT_CODES`、`EVIDENCE_SOURCE_AUTHORITY_CONTRACT_V1` 和 `CONTAINER_LIFECYCLE_TIMELINE_CONTRACT_V1`；云当网码表仍是“参考，待联调复核”，不能直接升格为确认事实。
- 代码位于 `ocean-port-visibility` Domain，保持纯求值，不依赖 NestJS、Prisma 或供应商 HTTP 客户端。
- 本刀不新增数据库表、Webhook、订阅客户端、真实凭据、来源权威策略或生命周期自动应用。
- `deleteStatus[]` 只形成更正/撤回待复核意图，不猜测其业务含义，不原地改写历史。

## 验收

- [x] 已登记码形成带映射版本的规范事件候选，计划/预计/实际不混淆。
- [x] `sourceCd=4`、预计事件和待联调映射均不可自动推进生命周期。
- [x] 未知码、未知来源、无时区时间和删除动态形成明确待复核结果。
- [x] 幂等键按供应商事件 ID、`localKey` 组合键、载荷哈希顺序确定，缺失时明确失败。
- [x] API 单元测试、lint、typecheck、build 与仓库检查通过。

## 方案

1. 建立云当网海运事件候选类型、首组事件映射和纯归一化函数。
2. 用判别联合表达候选、待复核与拒绝，禁止布尔默认值掩盖原因。
3. 覆盖正常、预计、供应商推断、未知码、未知来源、无时区、删除和幂等降级路径。
4. 后续切片再将结果接入原始载荷持久化、Inbox、来源权威裁决和生命周期 Application 用例。

## Review notes

领域边界复核通过：实现只产出不可自动过站的候选或待复核结果；未引入供应商状态直写、无时区猜测、历史覆盖或基础设施依赖。待复核结果同样携带稳定幂等键，可供后续 Inbox / 复核队列去重。

## 进度 log

| 日期       | 阶段   | 负责  | commit | 说明                               |
| ---------- | ------ | ----- | ------ | ---------------------------------- |
| 2026-09-18 | coding | Codex | —      | 开始云当网事件候选归一化领域实现。 |
| 2026-09-18 | done   | Codex | —      | 领域实现及风险相称门禁全部完成。   |
