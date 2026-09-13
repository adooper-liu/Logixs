---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm db:generate 成功；pnpm --filter @logix/api test -- src/modules/lifecycle-control src/modules/identity 33 文件 / 153 项通过；pnpm --filter @logix/web test 26 文件 / 66 项通过；typecheck / lint / repo:check 通过。本机库 27 条迁移已齐（含 20260913120000 inbox 死信重放）。HTTP 冒烟：GET /api/inbox/dead-letters 200 空页；不存在的死信重放 404 RESOURCE_NOT_FOUND。未执行：完整 pnpm validate、Playwright、有真实 Inbox 死信时的重放。
---

# 任务：Inbox 死信列表与人工重放

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

计划/管理在现有死信页切换到 Inbox 队列：按租户列出 `dead_letter`，可人工重放。新 Inbox 行使用新 messageId，`causationId` 指向原消息，原死信不改。不新开 Inbox 操作台，不展示载荷正文。

## 权威入口

- [SYNC_RELIABILITY_CONTRACT_V1](../../product/domain/SYNC_RELIABILITY_CONTRACT_V1.md) §8（GC-009）
- [QUERY_PROJECTION_CONTRACT_V1](../../product/domain/QUERY_PROJECTION_CONTRACT_V1.md) §9（GC-010）
- [p6-inbox-consume-client-operation](./p6-inbox-consume-client-operation.md)
- [p6-dead-letter-ops-ui](./p6-dead-letter-ops-ui.md)

## 边界 / 不做

- 不做独立 Inbox 浏览台、修正载荷、补偿、Kafka / 真实 broker、OIDC。
- 不把死信放进现场员工默认导航。
- 工单动作仍归 work-execution，不绑 ClientOperation。
- 不改已入共享环境的旧迁移。

## 验收

- [x] `GET /api/inbox/dead-letters`：用户身份、本租户、GC-010 游标分页。
- [x] `POST /api/inbox/dead-letters/:id/replay`：新 `received` 行，messageId 不同，causationId=原 messageId。
- [x] 原死信行状态与载荷不变；非死信 / 跨租户拒绝；同键同哈希复用，同键异哈希冲突。
- [x] 现有 `/dead-letters` 可切换 Inbox 队列；不渲染载荷正文或凭据。
- [x] `pnpm --filter @logix/api test -- src/modules/lifecycle-control`、`pnpm --filter @logix/web test` 与 `pnpm repo:check` 通过。

## 方案

列表与重放走用户身份，与 Outbox 死信同一页。领域函数构造新 received。Repository 同事务插入 replay 记录与新 Inbox。前端只加队列切换，不新增路由。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                       |
| ---------- | ------ | ---- | ------ | -------------------------- |
| 2026-09-13 | coding | —    | —      | 开工：Inbox 死信列表与重放 |
| 2026-09-13 | done   | —    | —      | 并入现有死信页；新 messageId |
