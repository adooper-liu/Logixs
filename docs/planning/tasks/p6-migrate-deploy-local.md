---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm db:migrate（migrate deploy）成功，No pending；scripts/check-repository.test.mjs 14 项通过；repo:check 通过。未执行：空库从零重放、完整 pnpm validate。
---

# 任务：本地迁移改为 deploy 对齐

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

`pnpm db:migrate` 与 `db:setup` / `dev:all` 只应用已有迁移，不再走需要影子库的 `migrate dev`。已入共享环境的旧 SQL 不改。

## 权威入口

- [AGENTS](../../../AGENTS.md) §4（已入共享环境的迁移不可修改）
- [database/migrations](../../../database/migrations/README.md)

## 边界 / 不做

- 不改 `20260913011044_inbox` 等已提交迁移。
- 不做 `migrate reset`、不修空库重放该历史文件（需另开任务）。
- 不改业务代码。

## 验收

- [x] `db:migrate` 调用 `prisma migrate deploy`。
- [x] 本机 `pnpm db:migrate` 在已齐库上成功。
- [x] 脚本契约测试防止再改回 `migrate dev`。
- [x] `pnpm repo:check` 通过。

## 方案

根因：`20260913011044_inbox` 在时间序上早于 `outbox_replay_request` 建表，影子库重放失败。`migrate deploy` 只对真实库应用未登记迁移，不重放影子库。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                 |
| ---------- | ------ | ---- | ------ | -------------------- |
| 2026-09-13 | coding | —    | —      | 开工：migrate deploy |
| 2026-09-13 | done   | —    | —      | db:migrate 改为 deploy |
