---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/provider-event-ingestion
verification: 本地验证（2026-09-18）：Prisma validate/generate；45 条迁移旧库追加与空库全链重放；真实 PostgreSQL 事务写读及清理；API 112 文件 / 515 项测试；API lint/typecheck/build；全库 format:check、repo:check、docs:check 均通过。无 HTTP/UI 变化，未运行 E2E。
---

# 任务：云当网原始接入、Inbox 幂等与来源权威裁决

## 目标

将云当网货柜动态以原始载荷留痕，通过通用 Inbox 消息键去重，并由 `ocean-port-visibility` Application 编排归一化与来源资格裁决。任何结果都不得直接写规范事件或推进生命周期。

## 权威入口

- [同步可靠性契约 V1](../../product/domain/SYNC_RELIABILITY_CONTRACT_V1.md) §4–5：Inbox 按 `consumerName + messageId` 幂等，业务提交与 processed 同事务。
- [证据与来源权威契约 V1](../../product/domain/EVIDENCE_SOURCE_AUTHORITY_CONTRACT_V1.md) §4–8：provider 不继承 authority；无策略、未知码和冲突必须复核。
- [货柜生命周期时间线契约 V1](../../product/domain/CONTAINER_LIFECYCLE_TIMELINE_CONTRACT_V1.md) §5–6：预计/实际分离、外部事件幂等及未知时区处理。
- [云当网事件候选归一化](./p6-trackingeyes-event-candidate.md)：本刀复用的领域候选与映射边界。

## 边界 / 不做

- 不新增 Webhook、轮询客户端、供应商凭据或公开 HTTP 接口。
- 不写 `canonical_event`、不调用 `lifecycle-control`、不生成生命周期 Outbox。
- 当前无已批准的云当网复合来源权威策略，也不能仅凭箱号确认内部 `containerId`；有效候选一律进入复核，不伪装成 confirmed。
- 原始载荷仅写受控数据库记录；日志和响应不返回正文。

## 验收

- [x] 原始载荷、哈希版本、供应商元数据、归一化结果和来源裁决可审计落库。
- [x] 同一 `consumerName + messageId` 同哈希幂等返回，异哈希明确冲突。
- [x] Inbox `processed` 与接入记录在同一事务提交。
- [x] 预计/供应商计算结果最多为 provisional；无策略、未知码、无时区均需复核。
- [x] 实现不依赖或调用生命周期推进能力。
- [x] Prisma validate/generate、目标测试、API lint/typecheck/build、仓库与文档检查通过。

## 方案

1. 新增来源权威裁决纯函数，消费现有归一化判别联合。
2. 新增 Application 接入用例与 Repository Port，内部计算规范化载荷哈希。
3. 新增 Prisma Adapter 与 append-only 接入表；Inbox 只保存受控引用和摘要。
4. 用单元测试覆盖成功、预计、复核、重复、冲突与事务写入。

## 数据与恢复

迁移只新增 `ocean_provider_event_ingestion`、索引和到 `inbox_message` 的限制删除外键，不改写已有数据。部署前备份；若必须回退代码，可保留新表不读。物理删除新表会丢失接入审计记录，只能在确认未产生记录或已完成备份恢复演练后执行。

## Review notes

领域与架构复核通过：`ocean-port-visibility` 只依赖本模块 Domain Port 和 Prisma Adapter；没有导入生命周期模块、写 `canonical_event` 或生成生命周期 Outbox。provider 与 authority 未混同；无已批准策略和内部货柜解析时固定进入复核。跨租户 Inbox 键碰撞、同键异载荷、未知码、无时区、预计和供应商计算路径均有明确结果。

## 进度 log

| 日期       | 阶段   | 负责  | commit | 说明                                         |
| ---------- | ------ | ----- | ------ | -------------------------------------------- |
| 2026-09-18 | coding | Codex | —      | 开始原始载荷、Inbox 与来源权威裁决接入实现。 |
| 2026-09-18 | done   | Codex | —      | 实现、迁移与风险相称门禁全部完成。           |
